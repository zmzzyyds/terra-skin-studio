using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Windows;

namespace Terra
{
    public sealed class Options
    {
        public string ThemeId;
        public int CdpPort = 9341;
        public int PanelPort = 9342;
        public bool CdpPortSet;
        public bool PanelPortSet;
        public bool Restart;
        public bool NoAlign;
        public bool NoSkin;
        public bool NoAnimation;
        public bool Preview;
        public bool External;
        public bool RequireReady;
        public bool RestartIfNeeded;
        public bool NoRestartIfNeeded;
        public bool RestartNoCdp;
        public bool NoSkip;
        public string SnapshotPath;
        public bool Mute;
        public bool SelfTest;
        public bool LaunchCodex;
        public bool EnableLoopback;
        public bool Help;

        public static Options Parse(string[] args)
        {
            Options options = new Options();
            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i];
                if (arg == "--theme") options.ThemeId = Next(args, ref i, arg);
                else if (arg == "--cdp-port") { options.CdpPort = ParsePort(Next(args, ref i, arg)); options.CdpPortSet = true; }
                else if (arg == "--panel-port") { options.PanelPort = ParsePort(Next(args, ref i, arg)); options.PanelPortSet = true; }
                else if (arg == "--restart") options.Restart = true;
                else if (arg == "--no-align") options.NoAlign = true;
                else if (arg == "--no-skin") options.NoSkin = true;
                else if (arg == "--no-animation") options.NoAnimation = true;
                else if (arg == "--preview") options.Preview = true;
                else if (arg == "--external") options.External = true;
                else if (arg == "--require-ready") options.RequireReady = true;
                else if (arg == "--restart-if-needed") options.RestartIfNeeded = true;
                else if (arg == "--no-restart-if-needed") options.NoRestartIfNeeded = true;
                else if (arg == "--no-skip") options.NoSkip = true;
                else if (arg == "--snapshot-overlay") options.SnapshotPath = Next(args, ref i, arg);
                else if (arg == "--mute") options.Mute = true;
                else if (arg == "--self-test") options.SelfTest = true;
                else if (arg == "--launch-codex") options.LaunchCodex = true;
                else if (arg == "--enable-loopback") options.EnableLoopback = true;
                else if (arg == "--help" || arg == "-h") options.Help = true;
                else throw new ArgumentException("未知参数：" + arg);
            }
            return options;
        }

        private static string Next(string[] args, ref int index, string name)
        {
            if (index + 1 >= args.Length) throw new ArgumentException(name + " 缺少参数");
            index++;
            return args[index];
        }

        private static int ParsePort(string value)
        {
            int port;
            if (!Int32.TryParse(value, out port) || port < 1024 || port > 65535)
            {
                throw new ArgumentException("端口必须是 1024 到 65535 的整数");
            }
            return port;
        }

        public static string Usage()
        {
            return "Arknights PRTS / 明日方舟 PRTS\n\n"
                + "  ArknightsPRTS.exe [--theme <id>] [--cdp-port 9341] [--restart]\n"
                + "               [--no-align] [--no-skin] [--no-animation] [--preview] [--external] [--mute]\n"
                + "               [--restart-if-needed | --no-restart-if-needed]\n"
                + "  ArknightsPRTS.exe --launch-codex [--restart] [--cdp-port 9341]\n"
                + "  ArknightsPRTS.exe --self-test\n"
                + "  ArknightsPRTS.exe --enable-loopback\n";
        }
    }

    internal static class Program
    {
        [STAThread]
        private static int Main(string[] args)
        {
            try { Console.OutputEncoding = Encoding.UTF8; } catch { }
            Native.EnablePerMonitorDpi();
            Options options;
            try
            {
                options = Options.Parse(args);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex.Message);
                Console.Error.WriteLine(Options.Usage());
                return 2;
            }
            if (options.Help)
            {
                Console.WriteLine(Options.Usage());
                return 0;
            }

            ThemeStore store = new ThemeStore();
            Logger logger = new Logger(store.LogDir);
            try
            {
                if (options.SelfTest) return SelfTest.Run(store, logger);
                if (options.EnableLoopback)
                {
                    return CodexActivation.EnableLoopback(logger) == 0 ? 0 : 1;
                }
                if (options.LaunchCodex) return RunLaunch(store, logger, options);
                return RunBoot(store, logger, options);
            }
            catch (Exception ex)
            {
                logger.Error("致命错误：" + ex);
                Console.Error.WriteLine(ex.Message);
                return 1;
            }
        }

        private static int RunBoot(ThemeStore store, Logger logger, Options options)
        {
            AppState state = store.LoadState();
            if (!String.IsNullOrWhiteSpace(options.ThemeId)) state.ActiveTheme = options.ThemeId;
            if (options.Mute) state.MuteBoot = true;
            if (options.CdpPortSet) state.CdpPort = options.CdpPort;
            if (options.PanelPortSet) state.PanelPort = options.PanelPort;

            if (!options.Preview
                && !options.Restart
                && CodexActivation.IsCodexRunning()
                && !CodexActivation.IsPortOpen(state.CdpPort, 300))
            {
                bool restart;
                if (options.RestartIfNeeded)
                {
                    restart = true;
                }
                else if (options.NoRestartIfNeeded)
                {
                    restart = false;
                }
                else
                {
                    MessageBoxResult answer = MessageBox.Show(
                        "Codex 已经在运行，但没有调试端口。\n\n"
                        + "为了应用主题和启动动画，需要关闭并重新打开 Codex。未发送的输入可能会丢失。\n\n"
                        + "现在重启 Codex 吗？",
                        "明日方舟 PRTS / Arknights PRTS",
                        MessageBoxButton.YesNo,
                        MessageBoxImage.Question,
                        MessageBoxResult.Yes);
                    restart = answer == MessageBoxResult.Yes;
                }
                if (restart)
                {
                    options.RestartNoCdp = true;
                    logger.Info("检测到旧 Codex 实例，启动时将重启以应用主题与动画");
                }
                else
                {
                    options.NoSkin = true;
                    logger.Warn("用户选择不重启 Codex；无法注入皮肤与应用内启动动画");
                }
            }

            if (!state.BootEnabled || options.NoAnimation)
            {
                logger.Info("启动动画已关闭，直接启动 Codex");
                return RunLaunchOnly(store, state, logger, options);
            }

            string error;
            ThemeInfo theme = store.GetTheme(state.ActiveTheme, out error);
            if (theme == null)
            {
                logger.Warn("主题加载失败：" + error);
                theme = store.GetTheme("si", out error);
            }
            if (theme == null)
            {
                logger.Error("没有可用主题：" + error);
                Console.Error.WriteLine("没有可用主题：" + error);
                return 1;
            }
            state.ActiveTheme = theme.Id;
            if (!options.NoSkin && !options.Preview)
            {
                state.SkinEnabled = true;
            }
            try { store.SaveState(state); } catch { }

            logger.Info("加载主题 " + theme.Id + " (" + theme.Name + ")，模式 " + theme.Manifest.Boot.Mode);
            if (!options.External && !options.Preview && String.IsNullOrWhiteSpace(options.SnapshotPath))
            {
                return RunInAppBoot(store, state, theme, logger, options);
            }
            Application app = new Application();
            app.ShutdownMode = ShutdownMode.OnMainWindowClose;
            BootWindow window = new BootWindow(store, state, theme, logger, options);
            app.Run(window);
            return 0;
        }

        private static int RunInAppBoot(ThemeStore store, AppState state, ThemeInfo theme, Logger logger, Options options)
        {
            int port = state.CdpPort;
            if (options.Restart)
            {
                LaunchResult restart = CodexActivation.RestartWithCdp(port, logger, true);
                logger.Info("重启并应用（应用内动画）：" + restart.Method + " " + (restart.Ok ? "OK" : restart.Error));
                if (!restart.Ok) return 1;
            }
            else if (options.RestartNoCdp)
            {
                bool closed = CodexActivation.CloseCodexGracefully(10, logger);
                if (!closed) closed = CodexActivation.ForceCloseGuiProcesses(logger);
                if (!closed)
                {
                    logger.Error("无法关闭 Codex，应用内启动动画取消");
                    return 1;
                }
                LaunchResult restart = CodexActivation.ActivateWithCdp(port);
                logger.Info("无 CDP 重启 Codex：" + restart.Method + " " + (restart.Ok ? "OK" : restart.Error));
                if (!restart.Ok) return 1;
            }
            else if (!CodexActivation.IsPortOpen(port, 300))
            {
                if (CodexActivation.IsCodexRunning())
                {
                    logger.Warn("Codex 已在运行但没有 CDP；无法注入应用内启动动画，请使用面板“重启并应用”");
                    return 1;
                }
                LaunchResult launch = CodexActivation.ActivateWithCdp(port);
                logger.Info("启动 Codex：" + launch.Method + " " + (launch.Ok ? "OK" : launch.Error));
                if (!launch.Ok) return 1;
            }
            else
            {
                logger.Info("Codex 已在运行，直接前置窗口");
            }

            bool focused = CodexActivation.PrepareCodexWindow(store, 20000);
            if (!focused && CodexActivation.IsPortOpen(port, 300))
            {
                LaunchResult activate = CodexActivation.ActivateWithCdp(port);
                logger.Info("窗口未找到，尝试激活 Codex：" + activate.Method + " " + (activate.Ok ? "OK" : activate.Error));
                focused = CodexActivation.PrepareCodexWindow(store, 5000);
            }
            if (!focused) logger.Warn("未能定位 Codex 主窗口，启动动画可能被后台节流");
            if (!options.NoSkin)
            {
                CodexActivation.StartController(store, state, logger);
            }
            bool splash = CodexActivation.StartSplash(store, theme.Id, port, logger);
            if (splash)
            {
                logger.Info("应用内启动动画已开始：" + theme.Id);
                return 0;
            }
            logger.Warn("应用内启动动画注入失败；可加 --external 使用独立动画窗口");
            return 1;
        }

        private static int RunLaunchOnly(ThemeStore store, AppState state, Logger logger, Options options)
        {
            if (!options.NoSkin)
            {
                state.SkinEnabled = true;
                try { store.SaveState(state); } catch { }
            }
            if (options.Restart)
            {
                LaunchResult restart = CodexActivation.RestartWithCdp(state.CdpPort, logger, true);
                logger.Info("重启并应用：" + restart.Method + " " + (restart.Ok ? "OK" : restart.Error));
                if (!restart.Ok) return 1;
                if (!options.NoSkin) CodexActivation.StartController(store, state, logger);
                return 0;
            }
            if (options.RestartNoCdp)
            {
                bool closed = CodexActivation.CloseCodexGracefully(10, logger);
                if (!closed) closed = CodexActivation.ForceCloseGuiProcesses(logger);
                if (!closed)
                {
                    logger.Error("无法关闭 Codex，跳过重启");
                    return 1;
                }
                LaunchResult restart = CodexActivation.ActivateWithCdp(state.CdpPort);
                logger.Info("无动画重启 Codex：" + restart.Method + " " + (restart.Ok ? "OK" : restart.Error));
                if (restart.Ok) CodexActivation.WaitForPort(state.CdpPort, 30000);
            }

            if (!CodexActivation.IsPortOpen(state.CdpPort, 300))
            {
                if (!CodexActivation.IsCodexRunning())
                {
                    LaunchResult result = CodexActivation.ActivateWithCdp(state.CdpPort);
                    logger.Info("启动 Codex：" + result.Method + " " + (result.Ok ? "OK" : result.Error));
                }
                else
                {
                    logger.Warn("Codex 已在运行但没有 CDP；可在面板使用“重启并应用”");
                }
            }
            if (!options.NoSkin)
            {
                CodexActivation.StartController(store, state, logger);
            }
            return 0;
        }

        private static int RunLaunch(ThemeStore store, Logger logger, Options options)
        {
            int port = options.CdpPort;
            LaunchResult result;
            if (options.Restart)
            {
                AppState launchState = store.LoadState();
                launchState.SkinEnabled = true;
                try { store.SaveState(launchState); } catch { }
                result = CodexActivation.RestartWithCdp(port, logger, true);
            }
            else if (CodexActivation.IsPortOpen(port, 300))
            {
                Console.WriteLine("{\"ok\":true,\"already\":true,\"method\":\"existing\"}");
                return 0;
            }
            else if (CodexActivation.IsCodexRunning())
            {
                Console.WriteLine("{\"ok\":true,\"already\":true,\"cdp\":false,\"method\":\"existing\"}");
                return 0;
            }
            else
            {
                result = CodexActivation.ActivateWithCdp(port);
            }
            string json = "{\"ok\":" + (result.Ok ? "true" : "false")
                + ",\"method\":\"" + EscapeJson(result.Method) + "\""
                + ",\"pid\":" + result.ProcessId
                + ",\"error\":\"" + EscapeJson(result.Error) + "\"}";
            Console.WriteLine(json);
            logger.Info("launch-codex " + json);
            return result.Ok ? 0 : 1;
        }

        private static string EscapeJson(string value)
        {
            if (value == null) return "";
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"")
                .Replace("\r", " ").Replace("\n", " ");
        }
    }

    internal static class SelfTest
    {
        public static int Run(ThemeStore store, Logger logger)
        {
            List<string> report = new List<string>();
            int errors = 0;
            report.Add("Arknights PRTS self-test");
            report.Add("appRoot=" + store.AppRoot);
            report.Add("dataDir=" + store.DataDir);
            report.Add("");

            List<ThemeInfo> themes = store.ListThemes();
            report.Add("themes=" + themes.Count);
            for (int i = 0; i < themes.Count; i++)
            {
                ThemeInfo info = themes[i];
                if (info.Error != null)
                {
                    errors++;
                    report.Add("[ERROR] " + info.Id + " : " + info.Error);
                    continue;
                }
                ThemeManifest m = info.Manifest;
                string video = store.ResolveAsset(m, m.Boot.Video);
                string poster = store.ResolveAsset(m, m.Boot.Poster);
                bool videoOk = !String.IsNullOrWhiteSpace(video) && File.Exists(video);
                bool posterOk = !String.IsNullOrWhiteSpace(poster) && File.Exists(poster);
                string mode = m.Boot.Mode;
                int frames = m.Boot.ScreenFrames == null ? 0 : m.Boot.ScreenFrames.Count;
                bool frameOk = true;
                if (m.Boot.ScreenFrames != null)
                {
                    double last = -1;
                    for (int f = 0; f < m.Boot.ScreenFrames.Count; f++)
                    {
                        ScreenFrame frame = m.Boot.ScreenFrames[f];
                        if (frame.Time <= last) frameOk = false;
                        last = frame.Time;
                        if (frame.X < 0 || frame.Y < 0 || frame.Width <= 0 || frame.Height <= 0
                            || frame.X + frame.Width > 1.001 || frame.Y + frame.Height > 1.001) frameOk = false;
                    }
                }
                bool ok = true;
                if (String.Equals(mode, "handoff", StringComparison.OrdinalIgnoreCase))
                {
                    if (!videoOk || frames < 2 || !frameOk) ok = false;
                }
                else if (String.Equals(mode, "fade", StringComparison.OrdinalIgnoreCase))
                {
                    if (!videoOk) ok = false;
                }
                else if (String.Equals(mode, "poster", StringComparison.OrdinalIgnoreCase))
                {
                    if (!posterOk) ok = false;
                }
                else
                {
                    ok = false;
                }
                if (!ok) errors++;
                report.Add((ok ? "[OK]    " : "[ERROR] ") + info.Id
                    + " name=" + m.Name
                    + " mode=" + mode
                    + " video=" + (videoOk ? "yes" : "no")
                    + " poster=" + (posterOk ? "yes" : "no")
                    + " frames=" + frames
                    + " frameOk=" + frameOk);
            }

            List<ScreenFrame> sample = new List<ScreenFrame>();
            sample.Add(new ScreenFrame { Time = 0, X = 0, Y = 0, Width = 0.4, Height = 0.4 });
            sample.Add(new ScreenFrame { Time = 1, X = 0, Y = 0, Width = 1, Height = 1 });
            ScreenFrame mid = Native.FrameAt(sample, 0.5);
            bool interpolationOk = mid != null && Math.Abs(mid.Width - 0.7) < 0.001;
            if (!interpolationOk) errors++;
            report.Add((interpolationOk ? "[OK]    " : "[ERROR] ") + "frame interpolation width=" + (mid == null ? "null" : mid.Width.ToString("0.000")));

            AppState state = store.LoadState();
            report.Add("[OK]    state activeTheme=" + state.ActiveTheme
                + " skinEnabled=" + state.SkinEnabled
                + " cdpPort=" + state.CdpPort);

            report.Add("");
            report.Add(errors == 0 ? "RESULT=OK" : "RESULT=ERROR errors=" + errors);
            string text = String.Join(Environment.NewLine, report.ToArray());
            Console.WriteLine(text);
            try
            {
                File.WriteAllText(Path.Combine(store.DataDir, "self-test.txt"), text, Encoding.UTF8);
            }
            catch { }
            logger.Info("self-test " + (errors == 0 ? "OK" : "ERROR " + errors));
            return errors == 0 ? 0 : 1;
        }
    }
}
