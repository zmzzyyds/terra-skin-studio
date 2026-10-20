using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;

namespace Terra
{
    [DataContract]
    public sealed class ScreenFrame
    {
        [DataMember(Name = "time")] public double Time { get; set; }
        [DataMember(Name = "x")] public double X { get; set; }
        [DataMember(Name = "y")] public double Y { get; set; }
        [DataMember(Name = "width")] public double Width { get; set; }
        [DataMember(Name = "height")] public double Height { get; set; }
    }

    [DataContract]
    public sealed class ThemeColors
    {
        [DataMember(Name = "accent")] public string Accent { get; set; }
        [DataMember(Name = "secondary")] public string Secondary { get; set; }
        [DataMember(Name = "surface")] public string Surface { get; set; }
        [DataMember(Name = "text")] public string Text { get; set; }
        [DataMember(Name = "mode")] public string Mode { get; set; }

        public void Normalize()
        {
            if (String.IsNullOrWhiteSpace(Accent)) Accent = "#F2C94C";
            if (String.IsNullOrWhiteSpace(Secondary)) Secondary = "#7FE7FF";
            if (String.IsNullOrWhiteSpace(Surface)) Surface = "#0A0F14";
            if (String.IsNullOrWhiteSpace(Text)) Text = "#EAF2F6";
            if (String.IsNullOrWhiteSpace(Mode)) Mode = "dark";
        }
    }

    [DataContract]
    public sealed class ThemeCopy
    {
        [DataMember(Name = "brand")] public string Brand { get; set; }
        [DataMember(Name = "headline")] public string Headline { get; set; }
        [DataMember(Name = "tagline")] public string Tagline { get; set; }

        public void Normalize(string name)
        {
            if (String.IsNullOrWhiteSpace(Brand)) Brand = "TERRA TERMINAL // 泰拉终端";
            if (String.IsNullOrWhiteSpace(Headline)) Headline = name;
            if (String.IsNullOrWhiteSpace(Tagline)) Tagline = "PROTOCOL READY";
        }
    }

    [DataContract]
    public sealed class FocusPoint
    {
        [DataMember(Name = "x")] public int X { get; set; }
        [DataMember(Name = "y")] public int Y { get; set; }

        public FocusPoint()
        {
            X = 50;
            Y = 50;
        }
    }

    [DataContract]
    public sealed class BackgroundConfig
    {
        [DataMember(Name = "image")] public string Image { get; set; }
        [DataMember(Name = "focus")] public FocusPoint Focus { get; set; }
        [DataMember(Name = "tint")] public string Tint { get; set; }
        [DataMember(Name = "tintOpacity")] public double TintOpacity { get; set; }

        public void Normalize()
        {
            if (Focus == null) Focus = new FocusPoint();
            if (String.IsNullOrWhiteSpace(Tint)) Tint = "#0A0F14";
            if (TintOpacity < 0 || TintOpacity > 1) TintOpacity = 0.3;
        }
    }

    [DataContract]
    public sealed class BootConfig
    {
        [DataMember(Name = "mode")] public string Mode { get; set; }
        [DataMember(Name = "video")] public string Video { get; set; }
        [DataMember(Name = "poster")] public string Poster { get; set; }
        [DataMember(Name = "width")] public int Width { get; set; }
        [DataMember(Name = "height")] public int Height { get; set; }
        [DataMember(Name = "holdAt")] public double HoldAt { get; set; }
        [DataMember(Name = "transitionStart")] public double TransitionStart { get; set; }
        [DataMember(Name = "transitionEnd")] public double TransitionEnd { get; set; }
        [DataMember(Name = "maxWaitSeconds")] public double MaxWaitSeconds { get; set; }
        [DataMember(Name = "volume")] public double Volume { get; set; }
        [DataMember(Name = "handoffStyle")] public string HandoffStyle { get; set; }
        [DataMember(Name = "loopStart")] public double LoopStart { get; set; }
        [DataMember(Name = "loopEnd")] public double LoopEnd { get; set; }
        [DataMember(Name = "screenFrames")] public List<ScreenFrame> ScreenFrames { get; set; }

        public void Normalize(BackgroundConfig background)
        {
            if (Width <= 0) Width = 1920;
            if (Height <= 0) Height = 1080;
            if (MaxWaitSeconds <= 0) MaxWaitSeconds = 60;
            if (Volume < 0 || Volume > 1) Volume = 0.75;
            if (HoldAt < 0) HoldAt = 0;
            if (TransitionStart < HoldAt) TransitionStart = HoldAt;
            if (TransitionEnd < TransitionStart) TransitionEnd = TransitionStart;
            if (String.IsNullOrWhiteSpace(HandoffStyle)) HandoffStyle = "wipe";
            if (LoopStart <= 0) LoopStart = HoldAt;
            if (LoopEnd <= LoopStart) LoopEnd = LoopStart + 2.0;
            if (String.IsNullOrWhiteSpace(Mode))
            {
                Mode = String.IsNullOrWhiteSpace(Video) ? "poster" : "fade";
            }
            if (String.IsNullOrWhiteSpace(Poster) && background != null) Poster = background.Image;
            if (String.Equals(Mode, "handoff", StringComparison.OrdinalIgnoreCase)
                && (ScreenFrames == null || ScreenFrames.Count < 2))
            {
                Mode = String.IsNullOrWhiteSpace(Video) ? "poster" : "fade";
            }
            if ((String.Equals(Mode, "handoff", StringComparison.OrdinalIgnoreCase)
                 || String.Equals(Mode, "fade", StringComparison.OrdinalIgnoreCase))
                && String.IsNullOrWhiteSpace(Video))
            {
                Mode = "poster";
            }
            if (String.Equals(Mode, "poster", StringComparison.OrdinalIgnoreCase)
                && String.IsNullOrWhiteSpace(Poster) && background != null)
            {
                Poster = background.Image;
            }
            if (ScreenFrames != null)
            {
                ScreenFrames.Sort(delegate(ScreenFrame a, ScreenFrame b) { return a.Time.CompareTo(b.Time); });
                for (int i = 0; i < ScreenFrames.Count; i++)
                {
                    ScreenFrame frame = ScreenFrames[i];
                    frame.X = Clamp01(frame.X);
                    frame.Y = Clamp01(frame.Y);
                    frame.Width = Clamp01(frame.Width);
                    frame.Height = Clamp01(frame.Height);
                    if (frame.X + frame.Width > 1) frame.Width = Math.Max(0.001, 1 - frame.X);
                    if (frame.Y + frame.Height > 1) frame.Height = Math.Max(0.001, 1 - frame.Y);
                }
            }
        }

        private static double Clamp01(double value)
        {
            if (value < 0) return 0;
            if (value > 1) return 1;
            return value;
        }
    }

    [DataContract]
    public sealed class ThemeManifest
    {
        [DataMember(Name = "schemaVersion")] public int SchemaVersion { get; set; }
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "name")] public string Name { get; set; }
        [DataMember(Name = "subtitle")] public string Subtitle { get; set; }
        [DataMember(Name = "series")] public string Series { get; set; }
        [DataMember(Name = "colors")] public ThemeColors Colors { get; set; }
        [DataMember(Name = "copy")] public ThemeCopy Copy { get; set; }
        [DataMember(Name = "background")] public BackgroundConfig Background { get; set; }
        [DataMember(Name = "decor")] public string Decor { get; set; }
        [DataMember(Name = "boot")] public BootConfig Boot { get; set; }
        [DataMember(Name = "preview")] public string Preview { get; set; }

        public string Directory { get; set; }
        public bool Builtin { get; set; }

        public void Normalize()
        {
            if (SchemaVersion <= 0) SchemaVersion = 1;
            if (String.IsNullOrWhiteSpace(Id)) Id = "custom";
            if (String.IsNullOrWhiteSpace(Name)) Name = Id;
            if (String.IsNullOrWhiteSpace(Subtitle)) Subtitle = "";
            if (String.IsNullOrWhiteSpace(Series)) Series = "custom";
            if (Colors == null) Colors = new ThemeColors();
            Colors.Normalize();
            if (Copy == null) Copy = new ThemeCopy();
            Copy.Normalize(Name);
            if (Background == null) Background = new BackgroundConfig();
            Background.Normalize();
            if (String.IsNullOrWhiteSpace(Decor)) Decor = "custom";
            if (Boot == null) Boot = new BootConfig();
            Boot.Normalize(Background);
        }
    }

    [DataContract]
    public sealed class ReadyState
    {
        [DataMember(Name = "schemaVersion")] public int SchemaVersion { get; set; }
        [DataMember(Name = "ready")] public bool Ready { get; set; }
        [DataMember(Name = "theme")] public string Theme { get; set; }
        [DataMember(Name = "appliedAt")] public string AppliedAt { get; set; }
        [DataMember(Name = "pid")] public int Pid { get; set; }
    }

    [DataContract]
    public sealed class SavedPlacement
    {
        [DataMember(Name = "flags")] public int Flags { get; set; }
        [DataMember(Name = "showCmd")] public int ShowCmd { get; set; }
        [DataMember(Name = "left")] public int Left { get; set; }
        [DataMember(Name = "top")] public int Top { get; set; }
        [DataMember(Name = "right")] public int Right { get; set; }
        [DataMember(Name = "bottom")] public int Bottom { get; set; }

        public static SavedPlacement FromNative(WINDOWPLACEMENT placement)
        {
            return new SavedPlacement
            {
                Flags = placement.flags,
                ShowCmd = placement.showCmd == Native.SW_MAXIMIZE
                    || placement.showCmd <= 0
                    ? Native.SW_SHOWNORMAL
                    : placement.showCmd,
                Left = placement.rcNormalPosition.Left,
                Top = placement.rcNormalPosition.Top,
                Right = placement.rcNormalPosition.Right,
                Bottom = placement.rcNormalPosition.Bottom
            };
        }

        public WINDOWPLACEMENT ToNative()
        {
            WINDOWPLACEMENT placement = new WINDOWPLACEMENT();
            placement.length = Marshal.SizeOf(typeof(WINDOWPLACEMENT));
            placement.flags = Flags;
            placement.showCmd = ShowCmd > 0 ? ShowCmd : Native.SW_SHOWNORMAL;
            placement.rcNormalPosition = new RECT(Left, Top, Right - Left, Bottom - Top);
            return placement;
        }

        public bool IsUsable()
        {
            int width = Right - Left;
            int height = Bottom - Top;
            if (width < 200 || height < 150) return false;
            int vx = Native.GetSystemMetrics(Native.SM_XVIRTUALSCREEN);
            int vy = Native.GetSystemMetrics(Native.SM_YVIRTUALSCREEN);
            int vw = Native.GetSystemMetrics(Native.SM_CXVIRTUALSCREEN);
            int vh = Native.GetSystemMetrics(Native.SM_CYVIRTUALSCREEN);
            return Right > vx && Bottom > vy && Left < vx + vw && Top < vy + vh;
        }
    }

    [DataContract]
    public sealed class AppState
    {
        [DataMember(Name = "schemaVersion")] public int SchemaVersion { get; set; }
        [DataMember(Name = "activeTheme")] public string ActiveTheme { get; set; }
        [DataMember(Name = "skinEnabled")] public bool SkinEnabled { get; set; }
        [DataMember(Name = "bootEnabled")] public bool BootEnabled { get; set; }
        [DataMember(Name = "cdpPort")] public int CdpPort { get; set; }
        [DataMember(Name = "panelPort")] public int PanelPort { get; set; }
        [DataMember(Name = "opacity")] public double Opacity { get; set; }
        [DataMember(Name = "clarity")] public double Clarity { get; set; }
        [DataMember(Name = "muteBoot")] public bool MuteBoot { get; set; }
        [DataMember(Name = "readability")] public string Readability { get; set; }
        [DataMember(Name = "appearance")] public string Appearance { get; set; }
        [DataMember(Name = "handoff")] public string Handoff { get; set; }

        public AppState()
        {
            SchemaVersion = 1;
            ActiveTheme = "si";
            SkinEnabled = true;
            BootEnabled = true;
            CdpPort = 9341;
            PanelPort = 9342;
            Opacity = 0.88;
            Clarity = 0.6;
            MuteBoot = false;
            Readability = "auto";
            Appearance = "dark";
            Handoff = "restore";
        }

        public void Normalize()
        {
            if (SchemaVersion <= 0) SchemaVersion = 1;
            if (String.IsNullOrWhiteSpace(ActiveTheme)) ActiveTheme = "si";
            if (CdpPort < 1024 || CdpPort > 65535) CdpPort = 9341;
            if (PanelPort < 1024 || PanelPort > 65535) PanelPort = 9342;
            if (Opacity < 0.5 || Opacity > 1) Opacity = 0.88;
            if (Clarity < 0 || Clarity > 1) Clarity = 0.6;
            if (String.IsNullOrWhiteSpace(Readability)) Readability = "auto";
            if (Appearance != "paper") Appearance = "dark";
            if (Handoff != "maximize") Handoff = "restore";
        }
    }

    public sealed class ThemeInfo
    {
        public string Id;
        public string Name;
        public string Directory;
        public bool Builtin;
        public ThemeManifest Manifest;
        public string Error;
    }

    public sealed class ThemeStore
    {
        public readonly string AppRoot;
        public readonly string DataDir;
        public readonly string BuiltinThemesDir;
        public readonly string CustomThemesDir;
        public readonly string LogDir;
        public readonly string StateFile;
        public string PlacementFile { get { return Path.Combine(DataDir, "codex-window.json"); } }

        public ThemeStore()
        {
            AppRoot = AppDomain.CurrentDomain.BaseDirectory;
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            DataDir = Path.Combine(local, "TerraStudio");
            BuiltinThemesDir = Path.Combine(AppRoot, "themes");
            CustomThemesDir = Path.Combine(DataDir, "themes");
            LogDir = Path.Combine(DataDir, "logs");
            StateFile = Path.Combine(DataDir, "state.json");
            EnsureDirectories();
        }

        public void EnsureDirectories()
        {
            try { Directory.CreateDirectory(DataDir); } catch { }
            try { Directory.CreateDirectory(CustomThemesDir); } catch { }
            try { Directory.CreateDirectory(LogDir); } catch { }
        }

        public AppState LoadState()
        {
            if (!File.Exists(StateFile))
            {
                AppState defaults = new AppState();
                SaveState(defaults);
                return defaults;
            }
            try
            {
                AppState state = ReadJson<AppState>(StateFile);
                if (state == null) state = new AppState();
                state.Normalize();
                return state;
            }
            catch
            {
                return new AppState();
            }
        }

        public void SaveState(AppState state)
        {
            state.Normalize();
            WriteJson<AppState>(StateFile, state);
        }

        public SavedPlacement LoadPlacement()
        {
            try
            {
                if (!File.Exists(PlacementFile)) return null;
                SavedPlacement placement = ReadJson<SavedPlacement>(PlacementFile);
                return placement != null && placement.IsUsable() ? placement : null;
            }
            catch
            {
                return null;
            }
        }

        public void SavePlacement(SavedPlacement placement)
        {
            try
            {
                if (placement != null && placement.IsUsable())
                {
                    WriteJson<SavedPlacement>(PlacementFile, placement);
                }
            }
            catch
            {
            }
        }

        public ThemeInfo GetTheme(string id, out string error)
        {
            error = null;
            if (String.IsNullOrWhiteSpace(id)) id = "si";
            string safe = SafeId(id);
            if (safe == null)
            {
                error = "主题 id 不合法";
                return null;
            }
            string[] roots = new string[] { BuiltinThemesDir, CustomThemesDir };
            for (int r = 0; r < roots.Length; r++)
            {
                string dir = Path.Combine(roots[r], safe);
                string manifestPath = Path.Combine(dir, "theme.json");
                if (!File.Exists(manifestPath)) continue;
                try
                {
                    ThemeManifest manifest = ReadJson<ThemeManifest>(manifestPath);
                    if (manifest == null) throw new Exception("theme.json 为空");
                    manifest.Normalize();
                    manifest.Id = safe;
                    manifest.Directory = dir;
                    manifest.Builtin = r == 0;
                    return new ThemeInfo
                    {
                        Id = safe,
                        Name = manifest.Name,
                        Directory = dir,
                        Builtin = r == 0,
                        Manifest = manifest
                    };
                }
                catch (Exception ex)
                {
                    error = ex.Message;
                    return null;
                }
            }
            error = "找不到主题：" + safe;
            return null;
        }

        public List<ThemeInfo> ListThemes()
        {
            List<ThemeInfo> result = new List<ThemeInfo>();
            AddThemes(result, BuiltinThemesDir, true);
            AddThemes(result, CustomThemesDir, false);
            return result;
        }

        private void AddThemes(List<ThemeInfo> result, string root, bool builtin)
        {
            if (!Directory.Exists(root)) return;
            string[] dirs = Directory.GetDirectories(root);
            Array.Sort(dirs, StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < dirs.Length; i++)
            {
                string name = Path.GetFileName(dirs[i]);
                if (name.StartsWith("_", StringComparison.Ordinal)) continue;
                if (SafeId(name) == null) continue;
                ThemeInfo info = new ThemeInfo();
                info.Id = name;
                info.Name = name;
                info.Directory = dirs[i];
                info.Builtin = builtin;
                try
                {
                    string manifestPath = Path.Combine(dirs[i], "theme.json");
                    ThemeManifest manifest = ReadJson<ThemeManifest>(manifestPath);
                    if (manifest == null) throw new Exception("theme.json 为空");
                    manifest.Normalize();
                    manifest.Id = name;
                    manifest.Directory = dirs[i];
                    manifest.Builtin = builtin;
                    info.Manifest = manifest;
                    info.Name = manifest.Name;
                }
                catch (Exception ex)
                {
                    info.Error = ex.Message;
                }
                result.Add(info);
            }
        }

        public string ResolveAsset(ThemeManifest manifest, string relative)
        {
            if (manifest == null || String.IsNullOrWhiteSpace(relative)) return null;
            string root = Path.GetFullPath(manifest.Directory);
            string combined = Path.GetFullPath(Path.Combine(root, relative.Replace('/', '\\')));
            if (!combined.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) return null;
            return combined;
        }

        public static string SafeId(string id)
        {
            if (String.IsNullOrWhiteSpace(id)) return null;
            if (id.Length > 41) return null;
            for (int i = 0; i < id.Length; i++)
            {
                char c = id[i];
                bool ok = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-';
                if (!ok) return null;
            }
            if (id[0] == '-') return null;
            return id;
        }

        public static T ReadJson<T>(string path) where T : class
        {
            DataContractJsonSerializer serializer = new DataContractJsonSerializer(typeof(T));
            using (FileStream stream = File.OpenRead(path))
            {
                return serializer.ReadObject(stream) as T;
            }
        }

        public static void WriteJson<T>(string path, T value) where T : class
        {
            string dir = Path.GetDirectoryName(path);
            if (!String.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            string temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            DataContractJsonSerializer serializer = new DataContractJsonSerializer(typeof(T));
            using (FileStream stream = File.Create(temp))
            {
                serializer.WriteObject(stream, value);
            }
            if (File.Exists(path))
            {
                try
                {
                    File.Replace(temp, path, null);
                }
                catch
                {
                    File.Delete(path);
                    File.Move(temp, path);
                }
            }
            else
            {
                File.Move(temp, path);
            }
        }
    }
}
