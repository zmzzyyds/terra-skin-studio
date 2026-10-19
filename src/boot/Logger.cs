using System;
using System.IO;
using System.Text;

namespace Terra
{
    public sealed class Logger
    {
        private readonly object sync = new object();
        private readonly string file;
        private const long MaxBytes = 2 * 1024 * 1024;

        public Logger(string logDir)
        {
            try { Directory.CreateDirectory(logDir); } catch { }
            file = Path.Combine(logDir, "boot.log");
        }

        public string FilePath { get { return file; } }

        public void Info(string message) { Write("INFO", message); }
        public void Warn(string message) { Write("WARN", message); }
        public void Error(string message) { Write("ERROR", message); }

        private void Write(string level, string message)
        {
            try
            {
                lock (sync)
                {
                    Rotate();
                    string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                        + " [" + level + "] " + message + Environment.NewLine;
                    File.AppendAllText(file, line, Encoding.UTF8);
                }
            }
            catch
            {
            }
        }

        private void Rotate()
        {
            try
            {
                if (!File.Exists(file)) return;
                FileInfo info = new FileInfo(file);
                if (info.Length < MaxBytes) return;
                string backup = file + ".1";
                if (File.Exists(backup)) File.Delete(backup);
                File.Move(file, backup);
            }
            catch
            {
            }
        }
    }
}
