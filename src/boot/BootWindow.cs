using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using System.Windows.Threading;

namespace Terra
{
    public sealed class BootWindow : Window
    {
        private readonly ThemeStore store;
        private readonly AppState state;
        private readonly ThemeInfo theme;
        private readonly ThemeManifest manifest;
        private readonly BootConfig boot;
        private readonly Logger logger;
        private readonly Options options;

        private readonly Grid root;
        private readonly DispatcherTimer timer;
        private readonly Stopwatch wall = new Stopwatch();
        private readonly Brush accentBrush;
        private readonly Brush textBrush;

        private MediaElement media;
        private Image loadingPoster;
        private Image posterImage;
        private Rectangle fadeOverlay;
        private Rectangle thumbnailFrame;
        private TextBlock statusText;
        private Border statusBorder;
        private Button muteButton;
        private Button skipButton;
        private Grid handoffOverlay;
        private Rectangle[] wipeBands;
        private TextBlock wipeTitle;
        private TextBlock wipeSub;
        private bool wipeMode;

        private IntPtr hostHandle;
        private IntPtr codexHandle;
        private IntPtr restartOldHandle;
        private IntPtr thumbnail;
        private WINDOWPLACEMENT originalPlacement;
        private bool placementSaved;
        private SavedPlacement savedPlacement;
        private RECT wipeDestination;

        private bool mediaOpened;
        private bool holding;
        private bool startedFade;
        private bool handoffDone;
        private bool thumbnailFailed;
        private bool aligned;
        private bool ready;
        private bool posterMode;
        private bool posterBuilt;

        private double stableSince = -1;
        private double lastProbe = -10;
        private double posterStart = -1;
        private double readyWaitStart = -1;
        private double lastReadyCheck = -10;
        private bool readyFileFresh;
        private bool readinessTimedOut;
        private readonly bool readinessRequired;

        private RECT clientRect;
        private POINT clientOrigin;
        private RECT contentClient;
        private RECT contentScreen;
        private RECT bootRect;

        private const string ProcessName = "ChatGPT";
        private const string ProcessPathContains = "OpenAI.Codex_";

        public BootWindow(ThemeStore store, AppState state, ThemeInfo theme, Logger logger, Options options)
        {
            this.store = store;
            this.state = state;
            this.theme = theme;
            this.manifest = theme.Manifest;
            this.boot = manifest.Boot;
            this.logger = logger;
            this.options = options;

            Color accent = ParseColor(manifest.Colors.Accent, Color.FromRgb(242, 201, 76));
            Color text = ParseColor(manifest.Colors.Text, Color.FromRgb(234, 242, 246));
            accentBrush = new SolidColorBrush(accent);
            textBrush = new SolidColorBrush(text);

            Title = "TERRA TERMINAL // " + manifest.Name;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            ShowInTaskbar = false;
            Topmost = true;
            AllowsTransparency = false;
            Background = Brushes.Black;
            WindowStartupLocation = WindowStartupLocation.Manual;

            readinessRequired = state.SkinEnabled && !options.NoSkin
                && (!options.Preview || options.RequireReady);
            savedPlacement = store.LoadPlacement();

            root = new Grid();
            root.Background = Brushes.Black;
            Content = root;

            BuildBaseUi();

            timer = new DispatcherTimer(DispatcherPriority.Render);
            timer.Interval = TimeSpan.FromMilliseconds(16);
            timer.Tick += Tick;

            SourceInitialized += OnSourceInitialized;
            Loaded += OnLoaded;
            Closed += OnClosed;
            PreviewKeyDown += OnKeyDown;
        }

        private void BuildBaseUi()
        {
            string posterPath = store.ResolveAsset(manifest, boot.Poster);
            if (String.IsNullOrWhiteSpace(posterPath) && manifest.Background != null)
            {
                posterPath = store.ResolveAsset(manifest, manifest.Background.Image);
            }
            if (!String.IsNullOrWhiteSpace(posterPath) && File.Exists(posterPath)
                && !String.Equals(boot.Mode, "poster", StringComparison.OrdinalIgnoreCase))
            {
                BitmapImage bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.UriSource = new Uri(posterPath, UriKind.Absolute);
                bitmap.EndInit();
                loadingPoster = new Image();
                loadingPoster.Source = bitmap;
                loadingPoster.Stretch = Stretch.UniformToFill;
                loadingPoster.IsHitTestVisible = false;
                root.Children.Add(loadingPoster);
            }

            string videoPath = store.ResolveAsset(manifest, boot.Video);
            if (!String.IsNullOrWhiteSpace(videoPath) && File.Exists(videoPath)
                && !String.Equals(boot.Mode, "poster", StringComparison.OrdinalIgnoreCase))
            {
                media = new MediaElement();
                media.LoadedBehavior = MediaState.Manual;
                media.UnloadedBehavior = MediaState.Manual;
                media.Stretch = Stretch.Uniform;
                media.ScrubbingEnabled = true;
                media.Volume = state.MuteBoot ? 0 : boot.Volume;
                media.MediaOpened += OnMediaOpened;
                media.MediaEnded += OnMediaEnded;
                media.MediaFailed += OnMediaFailed;
                media.Opacity = 0;
                root.Children.Add(media);
            }

            thumbnailFrame = new Rectangle();
            thumbnailFrame.Stroke = accentBrush;
            thumbnailFrame.StrokeThickness = 2;
            thumbnailFrame.Fill = Brushes.Transparent;
            thumbnailFrame.IsHitTestVisible = false;
            thumbnailFrame.Visibility = Visibility.Collapsed;
            thumbnailFrame.HorizontalAlignment = HorizontalAlignment.Left;
            thumbnailFrame.VerticalAlignment = VerticalAlignment.Top;
            root.Children.Add(thumbnailFrame);

            Border label = new Border();
            label.Background = new SolidColorBrush(Color.FromArgb(180, 5, 8, 11));
            label.BorderBrush = accentBrush;
            label.BorderThickness = new Thickness(0, 0, 0, 1);
            label.Padding = new Thickness(12, 6, 12, 6);
            label.HorizontalAlignment = HorizontalAlignment.Left;
            label.VerticalAlignment = VerticalAlignment.Top;
            label.Margin = new Thickness(18);
            TextBlock labelText = new TextBlock();
            labelText.Text = "TERRA // " + manifest.Name.ToUpperInvariant();
            labelText.Foreground = accentBrush;
            labelText.FontFamily = new FontFamily("Consolas, Microsoft YaHei UI");
            labelText.FontSize = 12;
            labelText.FontWeight = FontWeights.Bold;
            label.Child = labelText;
            root.Children.Add(label);

            StackPanel buttons = new StackPanel();
            buttons.Orientation = Orientation.Horizontal;
            buttons.HorizontalAlignment = HorizontalAlignment.Right;
            buttons.VerticalAlignment = VerticalAlignment.Top;
            buttons.Margin = new Thickness(18);

            Button skip = new Button();
            skip.Content = "ESC 跳过";
            StyleButton(skip);
            skip.Click += delegate { HandOff(false, "skip"); };
            skipButton = skip;
            if (options.NoSkip) skip.Visibility = Visibility.Collapsed;
            buttons.Children.Add(skip);

            muteButton = new Button();
            muteButton.Content = state.MuteBoot ? "M 取消静音" : "M 静音";
            StyleButton(muteButton);
            muteButton.Margin = new Thickness(8, 0, 0, 0);
            muteButton.Click += delegate { ToggleMute(); };
            buttons.Children.Add(muteButton);

            root.Children.Add(buttons);

            statusText = new TextBlock();
            statusText.Text = "CODEX 正在启动…   ESC 跳过";
            statusText.Foreground = accentBrush;
            statusText.FontFamily = new FontFamily("Consolas, Microsoft YaHei UI");
            statusText.FontSize = 14;
            statusBorder = new Border();
            statusBorder.Background = new SolidColorBrush(Color.FromArgb(190, 5, 8, 11));
            statusBorder.BorderBrush = accentBrush;
            statusBorder.BorderThickness = new Thickness(1);
            statusBorder.Padding = new Thickness(16, 8, 16, 8);
            statusBorder.Child = statusText;
            statusBorder.HorizontalAlignment = HorizontalAlignment.Center;
            statusBorder.VerticalAlignment = VerticalAlignment.Bottom;
            statusBorder.Margin = new Thickness(0, 0, 0, 36);
            statusBorder.Visibility = Visibility.Collapsed;
            root.Children.Add(statusBorder);

            BuildHandoffOverlay();

            fadeOverlay = new Rectangle();
            fadeOverlay.Fill = Brushes.Black;
            fadeOverlay.Opacity = 0;
            fadeOverlay.IsHitTestVisible = false;
            root.Children.Add(fadeOverlay);
        }

        private void StyleButton(Button button)
        {
            button.Background = new SolidColorBrush(Color.FromArgb(180, 5, 8, 11));
            button.Foreground = accentBrush;
            button.BorderBrush = accentBrush;
            button.BorderThickness = new Thickness(1);
            button.Padding = new Thickness(12, 6, 12, 6);
            button.FontFamily = new FontFamily("Consolas, Microsoft YaHei UI");
            button.FontSize = 12;
            button.FontWeight = FontWeights.Bold;
            button.Opacity = 0.7;
            button.MouseEnter += delegate { button.Opacity = 1; };
            button.MouseLeave += delegate { button.Opacity = 0.7; };
        }

        private void BuildHandoffOverlay()
        {
            handoffOverlay = new Grid();
            handoffOverlay.Visibility = Visibility.Collapsed;
            handoffOverlay.IsHitTestVisible = false;
            handoffOverlay.ClipToBounds = true;

            SolidColorBrush paper = new SolidColorBrush(Color.FromRgb(233, 229, 218));
            SolidColorBrush ink = new SolidColorBrush(Color.FromRgb(18, 21, 24));
            Color accent = ParseColor(manifest.Colors.Accent, Color.FromRgb(242, 201, 76));
            SolidColorBrush accentSolid = new SolidColorBrush(accent);

            Grid bands = new Grid();
            double[] widths = new double[] { 55, 15, 10, 20 };
            Brush[] fills = new Brush[] { paper, ink, accentSolid, paper };
            wipeBands = new Rectangle[4];
            for (int i = 0; i < 4; i++)
            {
                ColumnDefinition column = new ColumnDefinition();
                column.Width = new GridLength(widths[i], GridUnitType.Star);
                bands.ColumnDefinitions.Add(column);
                Rectangle band = new Rectangle();
                band.Fill = fills[i];
                band.RenderTransform = new TranslateTransform();
                Grid.SetColumn(band, i);
                bands.Children.Add(band);
                wipeBands[i] = band;
            }
            handoffOverlay.Children.Add(bands);

            StackPanel copy = new StackPanel();
            copy.HorizontalAlignment = HorizontalAlignment.Left;
            copy.VerticalAlignment = VerticalAlignment.Top;
            copy.Margin = new Thickness(92, 148, 0, 0);
            wipeTitle = new TextBlock();
            wipeTitle.Text = "LINK ESTABLISHED";
            wipeTitle.Foreground = ink;
            wipeTitle.FontFamily = new FontFamily("Bahnschrift, Arial, sans-serif");
            wipeTitle.FontSize = 64;
            wipeTitle.FontWeight = FontWeights.Bold;
            wipeSub = new TextBlock();
            wipeSub.Text = "TERRA TERMINAL // " + manifest.Name.ToUpperInvariant()
                + " // " + (manifest.Subtitle ?? "");
            wipeSub.Foreground = new SolidColorBrush(Color.FromArgb(190, 18, 21, 24));
            wipeSub.FontFamily = new FontFamily("Consolas, Microsoft YaHei UI");
            wipeSub.FontSize = 19;
            wipeSub.Margin = new Thickness(0, 18, 0, 0);
            Rectangle line = new Rectangle();
            line.Fill = accentSolid;
            line.Width = 420;
            line.Height = 4;
            line.HorizontalAlignment = HorizontalAlignment.Left;
            line.Margin = new Thickness(0, 26, 0, 0);
            copy.Children.Add(wipeTitle);
            copy.Children.Add(wipeSub);
            copy.Children.Add(line);
            handoffOverlay.Children.Add(copy);

            TextBlock serial = new TextBlock();
            serial.Text = "CODEX // " + (manifest.Series ?? "terra").ToUpperInvariant()
                + " // " + DateTime.Now.ToString("yyyy.MM.dd");
            serial.Foreground = new SolidColorBrush(Color.FromArgb(140, 18, 21, 24));
            serial.FontFamily = new FontFamily("Consolas");
            serial.FontSize = 12;
            serial.HorizontalAlignment = HorizontalAlignment.Left;
            serial.VerticalAlignment = VerticalAlignment.Bottom;
            serial.Margin = new Thickness(92, 0, 0, 72);
            handoffOverlay.Children.Add(serial);

            root.Children.Add(handoffOverlay);
        }

        private void StartWipeHandoff()
        {
            wipeMode = true;
            if (skipButton != null) skipButton.Visibility = Visibility.Collapsed;
            if (muteButton != null) muteButton.Visibility = Visibility.Collapsed;
            if (statusBorder != null) statusBorder.Visibility = Visibility.Collapsed;
            if (thumbnailFrame != null) thumbnailFrame.Visibility = Visibility.Collapsed;
            if (!placementSaved)
            {
                originalPlacement = Native.SavePlacement(codexHandle);
                placementSaved = true;
            }
            wipeDestination = clientRect;
            if (!options.Preview)
            {
                bool maximize = String.Equals(state.Handoff, "maximize", StringComparison.OrdinalIgnoreCase);
                if (maximize)
                {
                    Native.Maximize(codexHandle);
                    logger.Info("擦除目标窗口：最大化");
                }
                else
                {
                    WINDOWPLACEMENT target;
                    if (savedPlacement != null && savedPlacement.IsUsable())
                    {
                        target = savedPlacement.ToNative();
                    }
                    else if (placementSaved)
                    {
                        target = originalPlacement;
                    }
                    else
                    {
                        target = Native.SavePlacement(codexHandle);
                    }
                    Native.RestorePlacement(codexHandle, target);
                    logger.Info("擦除目标窗口 " + target.rcNormalPosition.Width + "x" + target.rcNormalPosition.Height
                        + " @ " + target.rcNormalPosition.Left + "," + target.rcNormalPosition.Top);
                }
            }
            RegisterThumbnail();
            if (thumbnail != IntPtr.Zero)
            {
                THUMBNAIL_PROPERTIES props = new THUMBNAIL_PROPERTIES();
                props.dwFlags = Native.TNP_RECTDESTINATION | Native.TNP_OPACITY
                    | Native.TNP_VISIBLE;
                props.rcDestination = wipeDestination;
                props.opacity = 255;
                props.fVisible = true;
                props.fSourceClientAreaOnly = false;
                int hr = Native.DwmUpdateThumbnailProperties(thumbnail, ref props);
                if (hr != 0)
                {
                    logger.Warn("DWM 全屏交接失败 0x" + hr.ToString("X8"));
                    UnregisterThumbnail();
                    thumbnailFailed = true;
                }
            }
            if (handoffOverlay != null)
            {
                handoffOverlay.Visibility = Visibility.Visible;
                handoffOverlay.UpdateLayout();
                UpdateWipe(0);
            }
            logger.Info("平面擦除交接开始");
        }

        private void UpdateWipe(double progress)
        {
            if (handoffOverlay == null || wipeBands == null) return;
            double p = Clamp01(progress);
            double e0 = Native.SmoothStep(Clamp01(p / 0.72));
            double e1 = Native.SmoothStep(Clamp01((p - 0.08) / 0.68));
            double e2 = Native.SmoothStep(Clamp01((p - 0.18) / 0.64));
            double e3 = Native.SmoothStep(Clamp01((p - 0.04) / 0.70));
            double scale = GetDpiScale();
            double w0 = wipeBands[0].ActualWidth;
            double h1 = wipeBands[1].ActualHeight;
            double w2 = wipeBands[2].ActualWidth;
            double h3 = wipeBands[3].ActualHeight;
            if (w0 <= 0) w0 = clientRect.Width / scale * 0.55;
            if (h1 <= 0) h1 = clientRect.Height / scale;
            if (w2 <= 0) w2 = clientRect.Width / scale * 0.10;
            if (h3 <= 0) h3 = clientRect.Height / scale;
            TranslateTransform t0 = wipeBands[0].RenderTransform as TranslateTransform;
            TranslateTransform t1 = wipeBands[1].RenderTransform as TranslateTransform;
            TranslateTransform t2 = wipeBands[2].RenderTransform as TranslateTransform;
            TranslateTransform t3 = wipeBands[3].RenderTransform as TranslateTransform;
            if (t0 != null) t0.X = -e0 * (w0 + 4);
            if (t1 != null) t1.Y = -e1 * (h1 + 4);
            if (t2 != null) t2.X = e2 * (w2 + 4);
            if (t3 != null) t3.Y = e3 * (h3 + 4);
            double fade = 1 - Native.SmoothStep(Clamp01(p / 0.45));
            if (wipeTitle != null) wipeTitle.Opacity = fade;
            if (wipeSub != null) wipeSub.Opacity = fade;
        }

        private void RenderOverlaySnapshot()
        {
            try
            {
                if (skipButton != null) skipButton.Visibility = Visibility.Collapsed;
                if (muteButton != null) muteButton.Visibility = Visibility.Collapsed;
                if (statusBorder != null) statusBorder.Visibility = Visibility.Collapsed;
                if (handoffOverlay != null)
                {
                    handoffOverlay.Visibility = Visibility.Visible;
                    handoffOverlay.UpdateLayout();
                    UpdateWipe(0.18);
                }
                UpdateLayout();
                int width = Math.Max(1, (int)Math.Round(ActualWidth));
                int height = Math.Max(1, (int)Math.Round(ActualHeight));
                RenderTargetBitmap bitmap = new RenderTargetBitmap(
                    width, height, 96, 96, PixelFormats.Pbgra32);
                bitmap.Render(root);
                PngBitmapEncoder encoder = new PngBitmapEncoder();
                encoder.Frames.Add(BitmapFrame.Create(bitmap));
                using (FileStream stream = File.Create(options.SnapshotPath))
                {
                    encoder.Save(stream);
                }
                logger.Info("擦除层快照：" + options.SnapshotPath);
            }
            catch (Exception ex)
            {
                logger.Error("擦除层快照失败：" + ex.Message);
            }
            finally
            {
                Close();
            }
        }

        private double GetDpiScale()
        {
            PresentationSource source = PresentationSource.FromVisual(this);
            if (source != null && source.CompositionTarget != null)
            {
                double scale = source.CompositionTarget.TransformToDevice.M11;
                if (scale > 0) return scale;
            }
            return 1.0;
        }

        private static double Clamp01(double value)
        {
            if (value < 0) return 0;
            if (value > 1) return 1;
            return value;
        }

        private void OnSourceInitialized(object sender, EventArgs e)
        {
            hostHandle = new WindowInteropHelper(this).Handle;
            codexHandle = Native.FindMainWindow(new string[] { ProcessName }, ProcessPathContains);
            if (codexHandle != IntPtr.Zero)
            {
                SavedPlacement captured = SavedPlacement.FromNative(Native.SavePlacement(codexHandle));
                if (captured.IsUsable())
                {
                    savedPlacement = captured;
                    try { store.SavePlacement(captured); } catch { }
                    logger.Info("记录 Codex 窗口大小 " + (captured.Right - captured.Left)
                        + "x" + (captured.Bottom - captured.Top));
                }
            }
            bootRect = ComputeBootRect();
            Native.SetWindowPos(hostHandle, Native.HWND_TOPMOST,
                bootRect.Left, bootRect.Top, bootRect.Width, bootRect.Height,
                Native.SWP_SHOWWINDOW);
            HwndSource source = HwndSource.FromHwnd(hostHandle);
            if (source != null) source.AddHook(WndProc);
            logger.Info("启动器窗口 " + bootRect.Width + "x" + bootRect.Height
                + " @ " + bootRect.Left + "," + bootRect.Top);
        }

        private RECT ComputeBootRect()
        {
            if (savedPlacement != null && savedPlacement.IsUsable())
            {
                return ClampBootRect(savedPlacement.ToNative().rcNormalPosition);
            }
            RECT monitor = Native.GetMonitorRect(IntPtr.Zero);
            int width = Math.Min(1280, Math.Max(640, monitor.Width - 120));
            int height = Math.Min(800, Math.Max(400, monitor.Height - 120));
            return new RECT(
                monitor.Left + (monitor.Width - width) / 2,
                monitor.Top + (monitor.Height - height) / 2,
                width,
                height);
        }

        private RECT ClampBootRect(RECT rect)
        {
            int width = Math.Max(640, Math.Min(rect.Width, 2560));
            int height = Math.Max(400, Math.Min(rect.Height, 1600));
            int vx = Native.GetSystemMetrics(Native.SM_XVIRTUALSCREEN);
            int vy = Native.GetSystemMetrics(Native.SM_YVIRTUALSCREEN);
            int vw = Native.GetSystemMetrics(Native.SM_CXVIRTUALSCREEN);
            int vh = Native.GetSystemMetrics(Native.SM_CYVIRTUALSCREEN);
            int left = rect.Left;
            int top = rect.Top;
            if (left < vx || top < vy || left + width > vx + vw || top + height > vy + vh)
            {
                RECT monitor = Native.GetMonitorRect(IntPtr.Zero);
                left = monitor.Left + Math.Max(0, (monitor.Width - width) / 2);
                top = monitor.Top + Math.Max(0, (monitor.Height - height) / 2);
            }
            return new RECT(left, top, width, height);
        }

        private IntPtr WndProc(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            if (message == 0x0046 && !handoffDone && lParam != IntPtr.Zero)
            {
                WINDOWPOS pos = (WINDOWPOS)Marshal.PtrToStructure(lParam, typeof(WINDOWPOS));
                pos.x = bootRect.Left;
                pos.y = bootRect.Top;
                pos.cx = bootRect.Width;
                pos.cy = bootRect.Height;
                pos.flags &= ~(Native.SWP_NOSIZE | Native.SWP_NOMOVE);
                Marshal.StructureToPtr(pos, lParam, false);
                handled = true;
            }
            return IntPtr.Zero;
        }

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (!String.IsNullOrWhiteSpace(options.SnapshotPath))
            {
                RenderOverlaySnapshot();
                return;
            }
            wall.Start();
            RECT raw;
            Native.GetClientRect(hostHandle, out raw);
            clientRect = new RECT(0, 0, raw.Width, raw.Height);
            clientOrigin = new POINT();
            Native.ClientToScreen(hostHandle, ref clientOrigin);
            contentClient = Native.FitRect(clientRect, boot.Width, boot.Height);
            contentScreen = new RECT(
                clientOrigin.X + contentClient.Left,
                clientOrigin.Y + contentClient.Top,
                contentClient.Width,
                contentClient.Height);

            LaunchAndConnect();
            StartMedia();
            timer.Start();
            Native.SetForegroundWindow(hostHandle);
        }

        private void LaunchAndConnect()
        {
            codexHandle = Native.FindMainWindow(new string[] { ProcessName }, ProcessPathContains);
            if (options.Preview)
            {
                logger.Info("预览模式：不启动/不移动 Codex");
                return;
            }
            if (options.RestartNoCdp)
            {
                restartOldHandle = codexHandle;
                logger.Info("后台重启 Codex 以应用主题");
                ThreadPool.QueueUserWorkItem(delegate
                {
                    bool closed = CodexActivation.CloseCodexGracefully(10, logger);
                    if (!closed) closed = CodexActivation.ForceCloseGuiProcesses(logger);
                    if (closed)
                    {
                        LaunchResult result = CodexActivation.ActivateWithCdp(state.CdpPort);
                        logger.Info("后台重启 Codex：" + result.Method + " " + (result.Ok ? "OK" : result.Error));
                        if (result.Ok) CodexActivation.WaitForPort(state.CdpPort, 30000);
                    }
                    else
                    {
                        logger.Warn("后台重启失败：Codex 未退出");
                    }
                });
                if (!options.NoSkin)
                {
                    CodexActivation.StartController(store, state, logger);
                }
                return;
            }
            if (codexHandle == IntPtr.Zero)
            {
                LaunchResult result = CodexActivation.ActivateWithCdp(state.CdpPort);
                logger.Info("启动 Codex：" + result.Method
                    + (result.Ok ? " OK" : " FAIL " + result.Error));
            }
            else
            {
                logger.Info("Codex 已在运行");
                if (!CodexActivation.IsPortOpen(state.CdpPort, 300))
                {
                    logger.Warn("Codex 已在运行但没有 CDP 端口；皮肤不会注入，可在面板使用“重启并应用”");
                }
            }
            if (!options.NoSkin)
            {
                CodexActivation.StartController(store, state, logger);
            }
        }

        private void StartMedia()
        {
            if (media != null)
            {
                string videoPath = store.ResolveAsset(manifest, boot.Video);
                if (!String.IsNullOrWhiteSpace(videoPath) && File.Exists(videoPath))
                {
                    try
                    {
                        media.Source = new Uri(videoPath, UriKind.Absolute);
                        media.Play();
                        logger.Info("播放启动视频：" + videoPath);
                        return;
                    }
                    catch (Exception ex)
                    {
                        logger.Warn("视频启动失败：" + ex.Message);
                    }
                }
            }
            StartPosterIntro();
        }

        private void StartPosterIntro()
        {
            if (posterMode) return;
            posterMode = true;
            if (loadingPoster != null) loadingPoster.Visibility = Visibility.Collapsed;
            if (media != null)
            {
                try { media.Stop(); } catch { }
                media.Visibility = Visibility.Collapsed;
            }
            if (!posterBuilt) BuildPosterUi();
            posterStart = wall.Elapsed.TotalSeconds;
            logger.Info("使用海报动画作为启动动画");
        }

        private void BuildPosterUi()
        {
            posterBuilt = true;
            string posterPath = store.ResolveAsset(manifest, boot.Poster);
            if (!String.IsNullOrWhiteSpace(posterPath) && File.Exists(posterPath))
            {
                BitmapImage bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.UriSource = new Uri(posterPath, UriKind.Absolute);
                bitmap.EndInit();
                posterImage = new Image();
                posterImage.Source = bitmap;
                posterImage.Stretch = Stretch.UniformToFill;
                posterImage.RenderTransformOrigin = new Point(0.5, 0.5);
                ScaleTransform scale = new ScaleTransform(1, 1);
                posterImage.RenderTransform = scale;
                root.Children.Insert(0, posterImage);
                DoubleAnimation zoom = new DoubleAnimation(1.0, 1.08, TimeSpan.FromSeconds(5));
                zoom.FillBehavior = FillBehavior.HoldEnd;
                scale.BeginAnimation(ScaleTransform.ScaleXProperty, zoom);
                scale.BeginAnimation(ScaleTransform.ScaleYProperty, zoom);
            }
            else
            {
                LinearGradientBrush gradient = new LinearGradientBrush(
                    ParseColor(manifest.Colors.Surface, Color.FromRgb(10, 15, 20)),
                    Colors.Black,
                    135);
                Rectangle background = new Rectangle();
                background.Fill = gradient;
                root.Children.Insert(0, background);
            }

            Rectangle scanlines = new Rectangle();
            GeometryDrawing line = new GeometryDrawing(
                new SolidColorBrush(Color.FromArgb(34, 0, 0, 0)),
                null,
                new RectangleGeometry(new Rect(0, 0, 1, 1)));
            DrawingBrush scanBrush = new DrawingBrush(line);
            scanBrush.TileMode = TileMode.Tile;
            scanBrush.Viewport = new Rect(0, 0, 1, 4);
            scanBrush.ViewportUnits = BrushMappingMode.Absolute;
            scanBrush.Stretch = Stretch.None;
            scanlines.Fill = scanBrush;
            scanlines.IsHitTestVisible = false;
            root.Children.Insert(1, scanlines);

            StackPanel title = new StackPanel();
            title.HorizontalAlignment = HorizontalAlignment.Left;
            title.VerticalAlignment = VerticalAlignment.Center;
            title.Margin = new Thickness(96, 0, 0, 0);
            TextBlock brand = new TextBlock();
            brand.Text = manifest.Copy.Brand;
            brand.Foreground = accentBrush;
            brand.FontFamily = new FontFamily("Bahnschrift, Consolas, Microsoft YaHei UI");
            brand.FontSize = 18;
            brand.FontWeight = FontWeights.Bold;
            TextBlock headline = new TextBlock();
            headline.Text = manifest.Copy.Headline;
            headline.Foreground = textBrush;
            headline.FontFamily = new FontFamily("Bahnschrift, Microsoft YaHei UI");
            headline.FontSize = 92;
            headline.FontWeight = FontWeights.Bold;
            headline.Margin = new Thickness(0, 18, 0, 0);
            TextBlock tagline = new TextBlock();
            tagline.Text = manifest.Copy.Tagline;
            tagline.Foreground = textBrush;
            tagline.FontFamily = new FontFamily("Microsoft YaHei UI, Consolas");
            tagline.FontSize = 20;
            tagline.Opacity = 0.8;
            tagline.Margin = new Thickness(0, 12, 0, 0);
            title.Children.Add(brand);
            title.Children.Add(headline);
            title.Children.Add(tagline);
            root.Children.Insert(2, title);
        }

        private void OnMediaOpened(object sender, RoutedEventArgs e)
        {
            mediaOpened = true;
            media.Volume = state.MuteBoot ? 0 : boot.Volume;
            if (media.NaturalDuration.HasTimeSpan)
            {
                logger.Info("视频已打开，时长 " + media.NaturalDuration.TimeSpan.TotalSeconds.ToString("0.00") + "s");
            }
            if (!posterMode)
            {
                if (loadingPoster != null) loadingPoster.Visibility = Visibility.Collapsed;
                DoubleAnimation fade = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(220));
                media.BeginAnimation(UIElement.OpacityProperty, fade);
            }
            Native.SetForegroundWindow(hostHandle);
        }

        private void OnMediaEnded(object sender, RoutedEventArgs e)
        {
            if (handoffDone) return;
            if (holding) return;
            HandOff(true, "media-ended");
        }

        private void OnMediaFailed(object sender, ExceptionRoutedEventArgs e)
        {
            logger.Warn("视频播放失败：" + e.ErrorException.Message);
            StartPosterIntro();
            mediaOpened = false;
        }

        private void Tick(object sender, EventArgs e)
        {
            if (handoffDone) return;
            double now = wall.Elapsed.TotalSeconds;
            Probe(now);

            if (now > boot.MaxWaitSeconds + 25 && !startedFade)
            {
                HandOff(false, "timeout");
                return;
            }

            if (posterMode)
            {
                TickPoster(now);
                return;
            }

            if (media != null && !mediaOpened)
            {
                if (now > 20)
                {
                    logger.Warn("视频打开超时");
                    StartPosterIntro();
                }
                return;
            }

            double t = media != null ? media.Position.TotalSeconds : now;
            bool readinessOk = CheckReadiness(now);
            if (!readinessOk && ready && !readinessTimedOut)
            {
                if (readyWaitStart < 0) readyWaitStart = now;
                if (now - readyWaitStart > 20)
                {
                    readinessTimedOut = true;
                    logger.Warn("等待皮肤就绪超时，继续交接");
                }
            }
            bool appReady = ready && (readinessOk || readinessTimedOut);

            double loopStart = boot.LoopStart > 0 ? boot.LoopStart : boot.HoldAt;
            double loopEnd = boot.LoopEnd > loopStart ? boot.LoopEnd : loopStart + 2.0;

            if (!appReady && !startedFade && t >= loopStart)
            {
                if (!holding)
                {
                    holding = true;
                    try
                    {
                        media.Position = TimeSpan.FromSeconds(loopStart);
                        media.Play();
                    }
                    catch { }
                    if (statusText != null)
                    {
                        statusText.Text = ready ? "正在同步主题…   ESC 跳过" : "CODEX 正在启动…   ESC 跳过";
                    }
                    ShowStatus();
                    logger.Info(ready ? "等待皮肤就绪，循环播放 " + loopStart.ToString("0.00") + "-" + loopEnd.ToString("0.00") + "s"
                        : "等待 Codex 窗口，循环播放 " + loopStart.ToString("0.00") + "-" + loopEnd.ToString("0.00") + "s");
                }
                if (media != null && media.Position.TotalSeconds >= loopEnd)
                {
                    try
                    {
                        media.Position = TimeSpan.FromSeconds(loopStart);
                        media.Play();
                    }
                    catch { }
                }
                return;
            }

            if (holding && appReady)
            {
                holding = false;
                HideStatus();
                try
                {
                    media.Position = TimeSpan.FromSeconds(loopStart);
                    media.Play();
                }
                catch { }
                if (readinessTimedOut)
                {
                    logger.Warn("皮肤就绪等待超时，按窗口就绪继续；交接后可能没有背景");
                }
                else
                {
                    logger.Info("Codex 窗口和皮肤就绪，继续播放");
                }
            }

            if (appReady && t >= boot.HoldAt && !aligned)
            {
                if (!placementSaved)
                {
                    originalPlacement = Native.SavePlacement(codexHandle);
                    placementSaved = true;
                }
                if (!options.NoAlign && !options.Preview
                    && !String.Equals(boot.HandoffStyle, "wipe", StringComparison.OrdinalIgnoreCase))
                {
                    bool ok = Native.AlignClient(codexHandle, contentScreen);
                    logger.Info(ok ? "Codex 客户区已对齐" : "Codex 客户区对齐不精确");
                }
                aligned = true;
                Native.SetForegroundWindow(hostHandle);
            }

            if (appReady && t >= boot.TransitionStart)
            {
                double span = boot.TransitionEnd - boot.TransitionStart;
                if (span <= 0) span = 0.001;
                double alpha = Native.SmoothStep((t - boot.TransitionStart) / span);
                if (!startedFade)
                {
                    startedFade = true;
                    HideStatus();
                    if (String.Equals(boot.HandoffStyle, "wipe", StringComparison.OrdinalIgnoreCase))
                    {
                        StartWipeHandoff();
                    }
                    else
                    {
                        RegisterThumbnail();
                    }
                    logger.Info("开始交接，t=" + t.ToString("0.00") + " style=" + boot.HandoffStyle);
                }
                if (wipeMode)
                {
                    UpdateWipe(alpha);
                }
                else
                {
                    if (thumbnail != IntPtr.Zero)
                    {
                        ScreenFrame frame = Native.FrameAt(boot.ScreenFrames, t);
                        RECT destination = Native.MapFrameToContent(contentClient, frame, alpha);
                        THUMBNAIL_PROPERTIES props = new THUMBNAIL_PROPERTIES();
                        props.dwFlags = Native.TNP_RECTDESTINATION | Native.TNP_OPACITY
                            | Native.TNP_VISIBLE | Native.TNP_SOURCECLIENTAREAONLY;
                        props.rcDestination = destination;
                        props.opacity = (byte)Math.Round(255 * alpha);
                        props.fVisible = true;
                        props.fSourceClientAreaOnly = true;
                        int hr = Native.DwmUpdateThumbnailProperties(thumbnail, ref props);
                        if (hr != 0)
                        {
                            logger.Warn("DWM 更新失败 0x" + hr.ToString("X8"));
                            UnregisterThumbnail();
                            thumbnailFailed = true;
                        }
                        else
                        {
                            UpdateThumbnailFrame(destination);
                        }
                    }
                    if (thumbnailFailed)
                    {
                        try
                        {
                            Opacity = 1 - alpha;
                        }
                        catch { }
                    }
                }
            }

            if (String.Equals(boot.Mode, "handoff", StringComparison.OrdinalIgnoreCase)
                && t >= boot.TransitionEnd && boot.TransitionEnd > 0)
            {
                HandOff(true, "complete");
            }
        }

        private void TickPoster(double now)
        {
            double t = posterStart >= 0 ? now - posterStart : now;
            bool readinessOk = CheckReadiness(now);
            if (!readinessOk && ready && !readinessTimedOut)
            {
                if (readyWaitStart < 0) readyWaitStart = now;
                if (now - readyWaitStart > 20)
                {
                    readinessTimedOut = true;
                    logger.Warn("等待皮肤就绪超时，继续交接");
                }
            }
            bool appReady = ready && (readinessOk || readinessTimedOut);
            if (!appReady)
            {
                ShowStatus();
            }
            else
            {
                HideStatus();
            }
            double target = boot.TransitionEnd > 0 ? Math.Max(boot.TransitionEnd, 2.8) : 3.6;
            if (t >= target)
            {
                if (appReady)
                {
                    HandOff(true, "poster");
                }
                else if (now > boot.MaxWaitSeconds + 25)
                {
                    HandOff(false, "timeout");
                }
            }
        }

        private bool CheckReadiness(double now)
        {
            if (!readinessRequired) return true;
            if (now - lastReadyCheck < 0.4) return readyFileFresh;
            lastReadyCheck = now;
            readyFileFresh = false;
            try
            {
                string path = System.IO.Path.Combine(store.DataDir, "ready.json");
                if (!File.Exists(path)) return false;
                ReadyState readyState = ThemeStore.ReadJson<ReadyState>(path);
                if (readyState == null || !readyState.Ready) return false;
                DateTime applied;
                if (!DateTime.TryParse(readyState.AppliedAt, CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind, out applied)) return false;
                double age = (DateTime.UtcNow - applied.ToUniversalTime()).TotalSeconds;
                if (age >= -5 && age <= 15) readyFileFresh = true;
            }
            catch
            {
            }
            return readyFileFresh;
        }

        private void Probe(double now)
        {
            if (now - lastProbe < 0.25) return;
            lastProbe = now;

            if (options.RestartNoCdp && !CodexActivation.IsPortOpen(state.CdpPort, 150))
            {
                ready = false;
                stableSince = -1;
                return;
            }

            if (codexHandle == IntPtr.Zero || !Native.IsWindow(codexHandle))
            {
                IntPtr found = Native.FindMainWindow(new string[] { ProcessName }, ProcessPathContains);
                if (found != IntPtr.Zero)
                {
                    if (options.RestartNoCdp && restartOldHandle != IntPtr.Zero && found == restartOldHandle)
                    {
                        ready = false;
                        return;
                    }
                    codexHandle = found;
                    stableSince = now;
                    ready = false;
                    logger.Info("找到 Codex 窗口");
                }
                else
                {
                    ready = false;
                    return;
                }
            }

            if (Native.IsIconic(codexHandle)) Native.ShowWindow(codexHandle, Native.SW_RESTORE);

            if (Native.Responsive(codexHandle))
            {
                if (stableSince < 0)
                {
                    stableSince = now;
                    ready = false;
                }
                else if (now - stableSince >= 0.6)
                {
                    if (!ready) logger.Info("Codex 窗口稳定可用");
                    ready = true;
                }
            }
            else
            {
                ready = false;
                stableSince = -1;
            }
        }

        private void RegisterThumbnail()
        {
            if (thumbnail != IntPtr.Zero || thumbnailFailed || codexHandle == IntPtr.Zero) return;
            IntPtr registered;
            int hr = Native.DwmRegisterThumbnail(hostHandle, codexHandle, out registered);
            if (hr != 0 || registered == IntPtr.Zero)
            {
                thumbnailFailed = true;
                logger.Warn("DWM 注册失败 0x" + hr.ToString("X8"));
                return;
            }
            thumbnail = registered;
            logger.Info("DWM 缩略图已连接");
        }

        private void UnregisterThumbnail()
        {
            if (thumbnailFrame != null) thumbnailFrame.Visibility = Visibility.Collapsed;
            if (thumbnail == IntPtr.Zero) return;
            try { Native.DwmUnregisterThumbnail(thumbnail); } catch { }
            thumbnail = IntPtr.Zero;
        }

        private void UpdateThumbnailFrame(RECT destination)
        {
            if (thumbnailFrame == null) return;
            double scale = 1;
            PresentationSource source = PresentationSource.FromVisual(this);
            if (source != null && source.CompositionTarget != null)
            {
                scale = source.CompositionTarget.TransformToDevice.M11;
                if (scale <= 0) scale = 1;
            }
            thumbnailFrame.Margin = new Thickness(destination.Left / scale, destination.Top / scale, 0, 0);
            thumbnailFrame.Width = Math.Max(1, destination.Width / scale);
            thumbnailFrame.Height = Math.Max(1, destination.Height / scale);
            thumbnailFrame.Visibility = Visibility.Visible;
        }

        private void HandOff(bool success, string reason)
        {
            if (handoffDone) return;
            handoffDone = true;
            timer.Stop();
            if (media != null)
            {
                try { media.Stop(); } catch { }
            }
            UnregisterThumbnail();

            IntPtr app = codexHandle;
            if (app == IntPtr.Zero || !Native.IsWindow(app))
            {
                app = Native.FindMainWindow(new string[] { ProcessName }, ProcessPathContains);
            }
            if (app != IntPtr.Zero)
            {
                if (!options.Preview)
                {
                    if (success)
                    {
                        if (String.Equals(state.Handoff, "maximize", StringComparison.OrdinalIgnoreCase))
                        {
                            Native.Maximize(app);
                        }
                        else if (savedPlacement != null && savedPlacement.IsUsable())
                        {
                            Native.RestorePlacement(app, savedPlacement.ToNative());
                        }
                        else if (placementSaved)
                        {
                            Native.RestorePlacement(app, originalPlacement);
                        }
                    }
                    else if (placementSaved)
                    {
                        Native.RestorePlacement(app, originalPlacement);
                    }
                }
                Hide();
                Native.SetForegroundWindow(app);
            }
            logger.Info("交接结束：" + reason + " success=" + success);
            Close();
        }

        private void ToggleMute()
        {
            state.MuteBoot = !state.MuteBoot;
            if (media != null)
            {
                media.Volume = state.MuteBoot ? 0 : boot.Volume;
                media.IsMuted = state.MuteBoot;
            }
            if (muteButton != null)
            {
                muteButton.Content = state.MuteBoot ? "M 取消静音" : "M 静音";
            }
            try { store.SaveState(state); } catch { }
        }

        private void OnKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Escape)
            {
                e.Handled = true;
                if (!options.NoSkip) HandOff(false, "escape");
            }
            else if (e.Key == Key.M)
            {
                e.Handled = true;
                ToggleMute();
            }
        }

        private void ShowStatus()
        {
            if (statusBorder != null) statusBorder.Visibility = Visibility.Visible;
        }

        private void HideStatus()
        {
            if (statusBorder != null) statusBorder.Visibility = Visibility.Collapsed;
        }

        private void OnClosed(object sender, EventArgs e)
        {
            timer.Stop();
            if (media != null)
            {
                try { media.Stop(); } catch { }
            }
            UnregisterThumbnail();
            logger.Info("启动器已关闭");
        }

        private static Color ParseColor(string value, Color fallback)
        {
            if (String.IsNullOrWhiteSpace(value)) return fallback;
            string text = value.Trim();
            if (text.StartsWith("#", StringComparison.Ordinal)) text = text.Substring(1);
            if (text.Length != 6) return fallback;
            try
            {
                byte r = Convert.ToByte(text.Substring(0, 2), 16);
                byte g = Convert.ToByte(text.Substring(2, 2), 16);
                byte b = Convert.ToByte(text.Substring(4, 2), 16);
                return Color.FromRgb(r, g, b);
            }
            catch
            {
                return fallback;
            }
        }
    }
}
