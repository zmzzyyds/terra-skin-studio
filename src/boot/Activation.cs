using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace Terra
{
    [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IApplicationActivationManager
    {
        [PreserveSig]
        int ActivateApplication(
            [In, MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
            [In, MarshalAs(UnmanagedType.LPWStr)] string arguments,
            [In] int options,
            [Out] out uint processId);

        [PreserveSig]
        int ActivateForFile(
            [In, MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
            [In] IntPtr itemArray,
            [In, MarshalAs(UnmanagedType.LPWStr)] string verb,
            [Out] out uint processId);

        [PreserveSig]
        int ActivateForProtocol(
            [In, MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
            [In] IntPtr itemArray,
            [Out] out uint processId);
    }

    [ComImport, Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
    internal class ApplicationActivationManager
    {
    }

    public sealed class LaunchResult
    {
        public bool Ok;
        public string Method;
        public uint ProcessId;
        public string Error;
    }

    public static class CodexActivation
    {
        private const string FallbackFamilyName = "OpenAI.Codex_2p2nqsd0c76g0";
        private static string cachedFamilyName = null;

        public static string GetPackageFamilyName()
        {
            if (!String.IsNullOrWhiteSpace(cachedFamilyName)) return cachedFamilyName;
            try
            {
                ProcessStartInfo info = new ProcessStartInfo("powershell.exe");
                info.Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"(Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue).PackageFamilyName\"";
                info.UseShellExecute = false;
                info.CreateNoWindow = true;
                info.RedirectStandardOutput = true;
                info.RedirectStandardError = true;
                using (Process process = Process.Start(info))
                {
                    string output = process.StandardOutput.ReadToEnd();
                    process.WaitForExit(10000);
                    output = output.Replace("﻿", "").Trim();
                    if (!String.IsNullOrWhiteSpace(output))
                    {
                        cachedFamilyName = output;
                        return cachedFamilyName;
                    }
                }
            }
            catch { }
            cachedFamilyName = FallbackFamilyName;
            return cachedFamilyName;
        }

        public static string GetAumid()
        {
            return GetPackageFamilyName() + "!App";
        }

        public static bool IsPortOpen(int port, int timeoutMs)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect("127.0.0.1", port, null, null);
                    bool connected = result.AsyncWaitHandle.WaitOne(timeoutMs, false);
                    if (!connected) return false;
                    try { client.EndConnect(result); } catch { return false; }
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        public static bool WaitForPort(int port, int timeoutMs)
        {
            Stopwatch watch = Stopwatch.StartNew();
            while (watch.ElapsedMilliseconds < timeoutMs)
            {
                if (IsPortOpen(port, 400)) return true;
                Thread.Sleep(350);
            }
            return false;
        }

        public static bool WaitForPortClosed(int port, int timeoutMs)
        {
            Stopwatch watch = Stopwatch.StartNew();
            while (watch.ElapsedMilliseconds < timeoutMs)
            {
                if (!IsPortOpen(port, 300)) return true;
                Thread.Sleep(350);
            }
            return !IsPortOpen(port, 300);
        }

        public static List<int> GetGuiProcessIds()
        {
            List<int> ids = new List<int>();
            Process[] processes;
            try { processes = Process.GetProcessesByName("ChatGPT"); }
            catch { return ids; }
            for (int i = 0; i < processes.Length; i++)
            {
                int pid = processes[i].Id;
                try
                {
                    string path = Native.GetProcessPath(pid);
                    if (path != null && path.IndexOf("OpenAI.Codex_", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        ids.Add(pid);
                    }
                }
                finally
                {
                    processes[i].Dispose();
                }
            }
            return ids;
        }

        public static bool IsCodexRunning()
        {
            return GetGuiProcessIds().Count > 0;
        }

        public static List<int> GetCodexHelperProcessIds()
        {
            List<int> ids = new List<int>();
            string[] names = new string[] { "codex", "node" };
            for (int n = 0; n < names.Length; n++)
            {
                Process[] processes;
                try { processes = Process.GetProcessesByName(names[n]); }
                catch { continue; }
                for (int i = 0; i < processes.Length; i++)
                {
                    int pid = processes[i].Id;
                    try
                    {
                        string path = Native.GetProcessPath(pid);
                        if (path != null
                            && path.IndexOf("\\OpenAI\\Codex\\", StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            ids.Add(pid);
                        }
                    }
                    finally
                    {
                        processes[i].Dispose();
                    }
                }
            }
            return ids;
        }

        public static LaunchResult ActivateWithCdp(int port)
        {
            string aumid = GetAumid();
            string arguments = "--remote-debugging-address=127.0.0.1 --remote-debugging-port=" + port;
            LaunchResult result = new LaunchResult();
            try
            {
                IApplicationActivationManager manager = (IApplicationActivationManager)new ApplicationActivationManager();
                uint pid;
                int hr = manager.ActivateApplication(aumid, arguments, 2, out pid);
                if (hr == 0)
                {
                    result.Ok = true;
                    result.Method = "activation";
                    result.ProcessId = pid;
                    return result;
                }
                result.Error = "ActivateApplication HRESULT 0x" + hr.ToString("X8");
            }
            catch (Exception ex)
            {
                result.Error = ex.Message;
            }

            try
            {
                ProcessStartInfo info = new ProcessStartInfo("explorer.exe", "shell:AppsFolder\\" + aumid);
                info.UseShellExecute = true;
                Process.Start(info);
                result.Ok = true;
                result.Method = "explorer";
                result.Error = null;
                return result;
            }
            catch (Exception ex)
            {
                result.Ok = false;
                result.Error = (result.Error == null ? "" : result.Error + "; ") + ex.Message;
                return result;
            }
        }

        public static bool CloseCodexGracefully(int timeoutSeconds, Logger logger)
        {
            List<int> pids = GetGuiProcessIds();
            if (pids.Count == 0) return true;
            logger.Info("请求 Codex 正常退出（" + pids.Count + " 个 GUI 进程）");
            Native.CloseGracefully(pids);
            Stopwatch watch = Stopwatch.StartNew();
            while (watch.ElapsedMilliseconds < timeoutSeconds * 1000L)
            {
                if (GetGuiProcessIds().Count == 0) return true;
                Thread.Sleep(300);
            }
            return GetGuiProcessIds().Count == 0;
        }

        public static bool ForceCloseGuiProcesses(Logger logger)
        {
            HashSet<int> all = new HashSet<int>(GetGuiProcessIds());
            List<int> helpers = GetCodexHelperProcessIds();
            for (int i = 0; i < helpers.Count; i++) all.Add(helpers[i]);
            if (all.Count == 0) return true;
            logger.Warn("正常退出超时，强制结束 Codex GUI/辅助进程（用户已确认重启）");
            List<int> pids = new List<int>(all);
            for (int i = 0; i < pids.Count; i++)
            {
                try
                {
                    Process process = Process.GetProcessById(pids[i]);
                    process.Kill();
                    process.WaitForExit(3000);
                    process.Dispose();
                }
                catch (Exception ex)
                {
                    logger.Warn("结束 PID " + pids[i] + " 失败：" + ex.Message);
                }
            }
            Stopwatch watch = Stopwatch.StartNew();
            while (watch.ElapsedMilliseconds < 10000)
            {
                if (GetGuiProcessIds().Count == 0 && GetCodexHelperProcessIds().Count == 0) return true;
                Thread.Sleep(300);
            }
            return GetGuiProcessIds().Count == 0 && GetCodexHelperProcessIds().Count == 0;
        }

        public static LaunchResult RestartWithCdp(int port, Logger logger, bool allowForce = false)
        {
            bool closed = CloseCodexGracefully(10, logger);
            if (!closed && allowForce)
            {
                logger.Warn("正常关闭超时，强制结束 Codex GUI/辅助进程");
                closed = ForceCloseGuiProcesses(logger);
            }
            else if (allowForce && GetCodexHelperProcessIds().Count > 0)
            {
                logger.Warn("GUI 已退出，但仍有 Codex 辅助进程，清理后重启");
                closed = ForceCloseGuiProcesses(logger);
            }
            if (!closed)
            {
                return new LaunchResult
                {
                    Ok = false,
                    Method = "restart",
                    Error = allowForce
                        ? "Codex 强制结束后仍在运行，请手动关闭后重试"
                        : "Codex 没有在 10 秒内退出，请手动关闭后重试（不会强制结束进程）"
                };
            }
            if (!WaitForPortClosed(port, 15000))
            {
                return new LaunchResult
                {
                    Ok = false,
                    Method = "restart",
                    Error = "旧 Codex 的调试端口 " + port + " 仍被占用，已取消重启以避免新窗口闪退。请手动退出 Codex 后重试。"
                };
            }
            LaunchResult result = ActivateWithCdp(port);
            if (result.Ok)
            {
                if (!WaitForPort(port, 60000))
                {
                    result.Ok = false;
                    result.Error = "Codex 启动后调试端口未开放";
                }
            }
            return result;
        }

        public static int EnableLoopback(Logger logger)
        {
            string pfn = GetPackageFamilyName();
            string exe = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "System32", "CheckNetIsolation.exe");
            try
            {
                ProcessStartInfo info = new ProcessStartInfo(exe);
                info.Arguments = "LoopbackExempt -a -n=" + pfn;
                info.UseShellExecute = true;
                info.Verb = "runas";
                info.WindowStyle = ProcessWindowStyle.Hidden;
                using (Process process = Process.Start(info))
                {
                    if (process == null) return 1;
                    process.WaitForExit();
                    logger.Info("CheckNetIsolation 退出码 " + process.ExitCode);
                    return process.ExitCode;
                }
            }
            catch (Exception ex)
            {
                logger.Error("启用回环豁免失败：" + ex.Message);
                return 1;
            }
        }

        private static bool ResolveNodeAndCli(ThemeStore store, out string node, out string cli)
        {
            node = Path.Combine(store.AppRoot, "runtime", "node.exe");
            if (!File.Exists(node)) node = "node.exe";
            string[] cliCandidates = new string[]
            {
                Path.Combine(store.AppRoot, "node", "cli.mjs"),
                Path.Combine(store.AppRoot, "src", "injector", "cli.mjs"),
                Path.Combine(store.AppRoot, "..", "..", "src", "injector", "cli.mjs")
            };
            cli = null;
            for (int i = 0; i < cliCandidates.Length; i++)
            {
                if (File.Exists(cliCandidates[i])) { cli = Path.GetFullPath(cliCandidates[i]); break; }
            }
            return cli != null;
        }

        public static bool StartController(ThemeStore store, AppState state, Logger logger)
        {
            if (IsPortOpen(state.PanelPort, 250)) return false;

            string node;
            string cli;
            if (!ResolveNodeAndCli(store, out node, out cli))
            {
                logger.Warn("找不到控制器 cli.mjs，跳过皮肤启动");
                return false;
            }
            try
            {
                ProcessStartInfo info = new ProcessStartInfo(node);
                info.Arguments = "\"" + cli + "\" panel --headless --no-open --port "
                    + state.CdpPort + " --panel-port " + state.PanelPort;
                info.UseShellExecute = false;
                info.CreateNoWindow = true;
                info.WorkingDirectory = store.AppRoot;
                info.WindowStyle = ProcessWindowStyle.Hidden;
                Process process = Process.Start(info);
                if (process != null)
                {
                    logger.Info("控制器已启动 PID " + process.Id);
                    process.Dispose();
                    return true;
                }
            }
            catch (Exception ex)
            {
                logger.Warn("控制器启动失败：" + ex.Message);
            }
            return false;
        }

        public static bool StartSplash(ThemeStore store, string themeId, int port, Logger logger)
        {
            string node;
            string cli;
            if (!ResolveNodeAndCli(store, out node, out cli))
            {
                logger.Warn("找不到启动动画 cli.mjs");
                return false;
            }
            try
            {
                ProcessStartInfo info = new ProcessStartInfo(node);
                info.Arguments = "\"" + cli + "\" splash \"" + themeId + "\" --port " + port;
                info.UseShellExecute = false;
                info.CreateNoWindow = true;
                info.WorkingDirectory = store.AppRoot;
                info.WindowStyle = ProcessWindowStyle.Hidden;
                Process process = Process.Start(info);
                if (process != null)
                {
                    logger.Info("启动动画注入进程 PID " + process.Id);
                    process.Dispose();
                    return true;
                }
            }
            catch (Exception ex)
            {
                logger.Warn("启动动画注入进程启动失败：" + ex.Message);
            }
            return false;
        }

        public static bool PrepareCodexWindow(ThemeStore store, int timeoutMs)
        {
            SavedPlacement saved = store.LoadPlacement();
            Stopwatch watch = Stopwatch.StartNew();
            while (watch.ElapsedMilliseconds < timeoutMs)
            {
                IntPtr hwnd = Native.FindCodexWindowLoose();
                if (hwnd == IntPtr.Zero)
                {
                    hwnd = Native.FindMainWindow(
                        new string[] { "ChatGPT" },
                        "OpenAI.Codex_");
                }
                if (hwnd == IntPtr.Zero) hwnd = Native.FindChatGptWindowByProcess();
                if (hwnd != IntPtr.Zero)
                {
                    if (saved != null && saved.IsUsable())
                    {
                        Native.RestorePlacement(hwnd, saved.ToNative());
                        Native.BringToForeground(hwnd);
                    }
                    else
                    {
                        Native.BringToForeground(hwnd);
                    }
                    return true;
                }
                Thread.Sleep(300);
            }
            return false;
        }

        public static bool BringCodexToFront(int timeoutMs)
        {
            Stopwatch watch = Stopwatch.StartNew();
            while (watch.ElapsedMilliseconds < timeoutMs)
            {
                IntPtr hwnd = Native.FindCodexWindowLoose();
                if (hwnd == IntPtr.Zero)
                {
                    hwnd = Native.FindMainWindow(
                        new string[] { "ChatGPT" },
                        "OpenAI.Codex_");
                }
                if (hwnd == IntPtr.Zero) hwnd = Native.FindChatGptWindowByProcess();
                if (hwnd != IntPtr.Zero)
                {
                    Native.BringToForeground(hwnd);
                    return true;
                }
                Thread.Sleep(120);
            }
            return false;
        }
    }
}
