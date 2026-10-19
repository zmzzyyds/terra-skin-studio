using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace Terra
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;

        public int Width { get { return Right - Left; } }
        public int Height { get { return Bottom - Top; } }

        public RECT(int left, int top, int width, int height)
        {
            Left = left;
            Top = top;
            Right = left + width;
            Bottom = top + height;
        }

        public bool IsEmpty { get { return Width <= 0 || Height <= 0; } }
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MONITORINFO
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct WINDOWPLACEMENT
    {
        public int length;
        public int flags;
        public int showCmd;
        public POINT ptMinPosition;
        public POINT ptMaxPosition;
        public RECT rcNormalPosition;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct WINDOWPOS
    {
        public IntPtr hwnd;
        public IntPtr hwndInsertAfter;
        public int x;
        public int y;
        public int cx;
        public int cy;
        public uint flags;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct THUMBNAIL_PROPERTIES
    {
        public uint dwFlags;
        public RECT rcDestination;
        public RECT rcSource;
        public byte opacity;
        [MarshalAs(UnmanagedType.Bool)] public bool fVisible;
        [MarshalAs(UnmanagedType.Bool)] public bool fSourceClientAreaOnly;
    }

    internal static class Native
    {
        public const int SW_HIDE = 0;
        public const int SW_SHOW = 5;
        public const int SW_SHOWNORMAL = 1;
        public const int SW_RESTORE = 9;
        public const int SW_MAXIMIZE = 3;
        public const int SW_SHOWNOACTIVATE = 4;

        public const int SM_XVIRTUALSCREEN = 76;
        public const int SM_YVIRTUALSCREEN = 77;
        public const int SM_CXVIRTUALSCREEN = 78;
        public const int SM_CYVIRTUALSCREEN = 79;

        public const uint SWP_NOSIZE = 0x0001;
        public const uint SWP_NOMOVE = 0x0002;
        public const uint SWP_NOZORDER = 0x0004;
        public const uint SWP_NOACTIVATE = 0x0010;
        public const uint SWP_SHOWWINDOW = 0x0040;
        public const uint SWP_NOSENDCHANGING = 0x0200;

        public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);

        public const int GWL_EXSTYLE = -20;
        public const int WS_EX_TOOLWINDOW = 0x00000080;
        public const uint GW_OWNER = 4;
        public const int DWMWA_CLOAKED = 14;
        public const uint MONITOR_DEFAULTTONEAREST = 2;

        public const uint TNP_RECTDESTINATION = 0x00000001;
        public const uint TNP_OPACITY = 0x00000004;
        public const uint TNP_VISIBLE = 0x00000008;
        public const uint TNP_SOURCECLIENTAREAONLY = 0x00000010;

        public const uint WM_CLOSE = 0x0010;
        public const uint WM_NULL = 0x0000;
        public const uint SMTO_ABORTIFHUNG = 0x0002;

        public const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool IsWindow(IntPtr hWnd);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern IntPtr FindWindow(string className, string windowName);
        [DllImport("user32.dll")]
        public static extern bool IsIconic(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool IsZoomed(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
        [DllImport("user32.dll")]
        public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
        [DllImport("user32.dll")]
        public static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);
        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        [DllImport("user32.dll")]
        public static extern IntPtr GetWindow(IntPtr hWnd, uint command);
        [DllImport("user32.dll")]
        public static extern int GetWindowLong(IntPtr hWnd, int index);
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int command);
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern void SwitchToThisWindow(IntPtr hWnd, bool altTab);
        [DllImport("user32.dll")]
        public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool attach);
        [DllImport("user32.dll")]
        public static extern bool BringWindowToTop(IntPtr hWnd);
        [DllImport("kernel32.dll")]
        public static extern uint GetCurrentThreadId();
        [DllImport("user32.dll")]
        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
        [DllImport("user32.dll")]
        public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
        [DllImport("user32.dll")]
        public static extern bool PostMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);
        [DllImport("user32.dll")]
        public static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);
        [DllImport("user32.dll")]
        public static extern IntPtr MonitorFromPoint(POINT point, uint flags);
        [DllImport("user32.dll")]
        public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);
        [DllImport("user32.dll")]
        public static extern bool GetCursorPos(out POINT point);
        [DllImport("user32.dll")]
        public static extern int GetSystemMetrics(int index);
        [DllImport("user32.dll")]
        public static extern bool GetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT placement);
        [DllImport("user32.dll")]
        public static extern bool SetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT placement);
        [DllImport("user32.dll")]
        public static extern uint GetDpiForWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool SetProcessDpiAwarenessContext(IntPtr context);

        [DllImport("dwmapi.dll")]
        public static extern int DwmRegisterThumbnail(IntPtr destination, IntPtr source, out IntPtr thumbnail);
        [DllImport("dwmapi.dll")]
        public static extern int DwmUpdateThumbnailProperties(IntPtr thumbnail, ref THUMBNAIL_PROPERTIES properties);
        [DllImport("dwmapi.dll")]
        public static extern int DwmUnregisterThumbnail(IntPtr thumbnail);
        [DllImport("dwmapi.dll")]
        public static extern int DwmGetWindowAttribute(IntPtr hWnd, int attribute, out int value, int size);

        [DllImport("kernel32.dll")]
        public static extern IntPtr OpenProcess(uint access, bool inherit, int processId);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        public static extern bool QueryFullProcessImageName(IntPtr process, uint flags, StringBuilder path, ref int length);
        [DllImport("kernel32.dll")]
        public static extern bool CloseHandle(IntPtr handle);

        public static void EnablePerMonitorDpi()
        {
            try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { }
        }

        public static RECT ClientBounds(IntPtr hWnd)
        {
            RECT client;
            POINT origin = new POINT();
            if (!GetClientRect(hWnd, out client)) return new RECT();
            if (!ClientToScreen(hWnd, ref origin)) return new RECT();
            return new RECT(origin.X, origin.Y, client.Width, client.Height);
        }

        public static bool Responsive(IntPtr hWnd)
        {
            IntPtr result;
            return hWnd != IntPtr.Zero
                && SendMessageTimeout(hWnd, WM_NULL, IntPtr.Zero, IntPtr.Zero, SMTO_ABORTIFHUNG, 80, out result) != IntPtr.Zero;
        }

        public static bool AlignClient(IntPtr hWnd, RECT desiredClient)
        {
            if (IsIconic(hWnd) || IsZoomed(hWnd)) ShowWindow(hWnd, SW_RESTORE);
            for (int attempt = 0; attempt < 2; attempt++)
            {
                RECT outer;
                RECT client = ClientBounds(hWnd);
                if (!GetWindowRect(hWnd, out outer) || client.Width <= 0 || client.Height <= 0) return false;
                int offsetX = client.Left - outer.Left;
                int offsetY = client.Top - outer.Top;
                int borderX = outer.Width - client.Width;
                int borderY = outer.Height - client.Height;
                RECT target = new RECT(
                    desiredClient.Left - offsetX,
                    desiredClient.Top - offsetY,
                    desiredClient.Width + borderX,
                    desiredClient.Height + borderY);
                if (!SetWindowPos(hWnd, IntPtr.Zero, target.Left, target.Top, target.Width, target.Height,
                    SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOSENDCHANGING)) return false;
            }
            RECT actual = ClientBounds(hWnd);
            return Math.Abs(actual.Left - desiredClient.Left) <= 2
                && Math.Abs(actual.Top - desiredClient.Top) <= 2
                && Math.Abs(actual.Width - desiredClient.Width) <= 2
                && Math.Abs(actual.Height - desiredClient.Height) <= 2;
        }

        public static IntPtr FindMainWindow(string[] processNames, string pathContains)
        {
            HashSet<int> pids = new HashSet<int>();
            for (int n = 0; n < processNames.Length; n++)
            {
                Process[] processes;
                try { processes = Process.GetProcessesByName(processNames[n]); }
                catch { continue; }
                for (int i = 0; i < processes.Length; i++)
                {
                    int pid = processes[i].Id;
                    try
                    {
                        string path = GetProcessPath(pid);
                        if (String.IsNullOrEmpty(pathContains)
                            || (path != null && path.IndexOf(pathContains, StringComparison.OrdinalIgnoreCase) >= 0))
                        {
                            pids.Add(pid);
                        }
                    }
                    finally
                    {
                        processes[i].Dispose();
                    }
                }
            }
            if (pids.Count == 0) return IntPtr.Zero;

            IntPtr found = IntPtr.Zero;
            EnumWindowsProc callback = delegate(IntPtr hWnd, IntPtr lParam)
            {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                if (!pids.Contains((int)pid)) return true;
                if (!IsWindowVisible(hWnd)) return true;
                if (GetWindow(hWnd, GW_OWNER) != IntPtr.Zero) return true;
                if ((GetWindowLong(hWnd, GWL_EXSTYLE) & WS_EX_TOOLWINDOW) != 0) return true;
                int cloaked;
                if (DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, 4) == 0 && cloaked != 0) return true;
                if (IsIconic(hWnd)) ShowWindow(hWnd, SW_RESTORE);
                RECT client = ClientBounds(hWnd);
                if (client.Width < 450 || client.Height < 280) return true;
                found = hWnd;
                return false;
            };
            EnumWindows(callback, IntPtr.Zero);
            GC.KeepAlive(callback);
            return found;
        }

        public static IntPtr FindCodexWindowLoose()
        {
            HashSet<int> pids = new HashSet<int>();
            Process[] processes;
            try { processes = Process.GetProcessesByName("ChatGPT"); }
            catch { return IntPtr.Zero; }
            for (int i = 0; i < processes.Length; i++)
            {
                pids.Add(processes[i].Id);
                processes[i].Dispose();
            }
            if (pids.Count == 0) return IntPtr.Zero;

            IntPtr best = IntPtr.Zero;
            long bestArea = 0;
            EnumWindowsProc callback = delegate(IntPtr hWnd, IntPtr lParam)
            {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                if (!pids.Contains((int)pid)) return true;
                if (!IsWindowVisible(hWnd)) return true;
                int cloaked;
                if (DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, 4) == 0 && cloaked != 0) return true;
                if (IsIconic(hWnd))
                {
                    if (best == IntPtr.Zero) best = hWnd;
                    return true;
                }
                RECT client = ClientBounds(hWnd);
                long area = (long)client.Width * client.Height;
                if (client.Width >= 400 && client.Height >= 300 && area > bestArea)
                {
                    bestArea = area;
                    best = hWnd;
                }
                return true;
            };
            EnumWindows(callback, IntPtr.Zero);
            GC.KeepAlive(callback);
            return best;
        }

        public static IntPtr FindChatGptWindowByProcess()
        {
            Process[] processes;
            try { processes = Process.GetProcessesByName("ChatGPT"); }
            catch { return IntPtr.Zero; }
            IntPtr found = IntPtr.Zero;
            for (int i = 0; i < processes.Length; i++)
            {
                try
                {
                    IntPtr handle = processes[i].MainWindowHandle;
                    if (handle != IntPtr.Zero)
                    {
                        found = handle;
                        break;
                    }
                }
                catch { }
                finally
                {
                    processes[i].Dispose();
                }
            }
            return found;
        }

        public static string GetProcessPath(int pid)
        {
            IntPtr process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
            if (process == IntPtr.Zero) return null;
            try
            {
                StringBuilder buffer = new StringBuilder(4096);
                int length = buffer.Capacity;
                if (QueryFullProcessImageName(process, 0, buffer, ref length)) return buffer.ToString();
                return null;
            }
            finally
            {
                CloseHandle(process);
            }
        }

        public static RECT GetMonitorRect(IntPtr hWnd)
        {
            IntPtr monitor = IntPtr.Zero;
            if (hWnd != IntPtr.Zero) monitor = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
            if (monitor == IntPtr.Zero)
            {
                POINT cursor;
                GetCursorPos(out cursor);
                monitor = MonitorFromPoint(cursor, MONITOR_DEFAULTTONEAREST);
            }
            if (monitor == IntPtr.Zero) return new RECT(0, 0, 1920, 1080);
            MONITORINFO info = new MONITORINFO();
            info.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
            if (!GetMonitorInfo(monitor, ref info)) return new RECT(0, 0, 1920, 1080);
            return info.rcMonitor;
        }

        public static WINDOWPLACEMENT SavePlacement(IntPtr hWnd)
        {
            WINDOWPLACEMENT placement = new WINDOWPLACEMENT();
            placement.length = Marshal.SizeOf(typeof(WINDOWPLACEMENT));
            GetWindowPlacement(hWnd, ref placement);
            return placement;
        }

        public static void RestorePlacement(IntPtr hWnd, WINDOWPLACEMENT placement)
        {
            if (hWnd == IntPtr.Zero) return;
            placement.length = Marshal.SizeOf(typeof(WINDOWPLACEMENT));
            SetWindowPlacement(hWnd, ref placement);
            SetForegroundWindow(hWnd);
        }

        public static void BringToForeground(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero) return;
            if (IsIconic(hWnd)) ShowWindow(hWnd, SW_RESTORE);
            IntPtr foreground = GetForegroundWindow();
            uint foregroundPid;
            uint foregroundThread = foreground == IntPtr.Zero
                ? 0
                : GetWindowThreadProcessId(foreground, out foregroundPid);
            uint currentThread = GetCurrentThreadId();
            bool attached = false;
            if (foregroundThread != 0 && foregroundThread != currentThread)
            {
                attached = AttachThreadInput(currentThread, foregroundThread, true);
            }
            BringWindowToTop(hWnd);
            SwitchToThisWindow(hWnd, true);
            SetForegroundWindow(hWnd);
            if (attached) AttachThreadInput(currentThread, foregroundThread, false);
        }

        public static void Maximize(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero) return;
            ShowWindow(hWnd, SW_MAXIMIZE);
            SetForegroundWindow(hWnd);
        }

        public static void CloseGracefully(List<int> processIds)
        {
            if (processIds == null || processIds.Count == 0) return;
            HashSet<int> wanted = new HashSet<int>(processIds);
            EnumWindowsProc callback = delegate(IntPtr hWnd, IntPtr lParam)
            {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                if (wanted.Contains((int)pid) && IsWindowVisible(hWnd))
                {
                    PostMessage(hWnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                }
                return true;
            };
            EnumWindows(callback, IntPtr.Zero);
            GC.KeepAlive(callback);
        }

        public static RECT FitRect(RECT container, int contentWidth, int contentHeight)
        {
            if (contentWidth <= 0 || contentHeight <= 0 || container.IsEmpty) return container;
            double scale = Math.Min(
                (double)container.Width / contentWidth,
                (double)container.Height / contentHeight);
            int width = (int)Math.Round(contentWidth * scale);
            int height = (int)Math.Round(contentHeight * scale);
            int left = container.Left + (container.Width - width) / 2;
            int top = container.Top + (container.Height - height) / 2;
            return new RECT(left, top, width, height);
        }

        public static double SmoothStep(double value)
        {
            if (value < 0) value = 0;
            if (value > 1) value = 1;
            return value * value * (3 - 2 * value);
        }

        public static ScreenFrame FrameAt(List<ScreenFrame> frames, double time)
        {
            if (frames == null || frames.Count == 0) return null;
            if (time <= frames[0].Time) return frames[0];
            for (int i = 1; i < frames.Count; i++)
            {
                if (time > frames[i].Time) continue;
                ScreenFrame a = frames[i - 1];
                ScreenFrame b = frames[i];
                double span = b.Time - a.Time;
                double u = span <= 0 ? 1 : (time - a.Time) / span;
                if (u < 0) u = 0;
                if (u > 1) u = 1;
                return new ScreenFrame
                {
                    Time = time,
                    X = a.X + (b.X - a.X) * u,
                    Y = a.Y + (b.Y - a.Y) * u,
                    Width = a.Width + (b.Width - a.Width) * u,
                    Height = a.Height + (b.Height - a.Height) * u
                };
            }
            return frames[frames.Count - 1];
        }

        public static RECT MapFrameToContent(RECT content, ScreenFrame frame, double alpha)
        {
            if (frame == null) return content;
            RECT mapped = new RECT(
                content.Left + (int)Math.Round(frame.X * content.Width),
                content.Top + (int)Math.Round(frame.Y * content.Height),
                Math.Max(1, (int)Math.Round(frame.Width * content.Width)),
                Math.Max(1, (int)Math.Round(frame.Height * content.Height)));
            return Lerp(mapped, content, SmoothStep(alpha));
        }

        public static RECT Lerp(RECT a, RECT b, double t)
        {
            return new RECT(
                (int)Math.Round(a.Left + (b.Left - a.Left) * t),
                (int)Math.Round(a.Top + (b.Top - a.Top) * t),
                Math.Max(1, (int)Math.Round(a.Width + (b.Width - a.Width) * t)),
                Math.Max(1, (int)Math.Round(a.Height + (b.Height - a.Height) * t)));
        }

        public static IntPtr GetForegroundWindow()
        {
            return GetForegroundWindowNative();
        }

        [DllImport("user32.dll", EntryPoint = "GetForegroundWindow")]
        private static extern IntPtr GetForegroundWindowNative();
    }
}
