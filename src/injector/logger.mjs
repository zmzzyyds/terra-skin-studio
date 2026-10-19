import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 2 * 1024 * 1024;

export function createLogger(logDir, name = "controller.log") {
  mkdirSync(logDir, { recursive: true, mode: 0o700 });
  const file = join(logDir, name);
  function rotate() {
    try {
      if (!existsSync(file)) return;
      if (statSync(file).size < MAX_BYTES) return;
      renameSync(file, `${file}.1`);
    } catch {}
  }
  function write(level, message) {
    const line = `${new Date().toISOString()} [${level}] ${message}\n`;
    try {
      rotate();
      appendFileSync(file, line, { mode: 0o600 });
    } catch {}
    if (process.env.TERRA_DEBUG) process.stderr.write(line);
  }
  return {
    file,
    info: (message) => write("INFO", message),
    warn: (message) => write("WARN", message),
    error: (message) => write("ERROR", message),
  };
}
