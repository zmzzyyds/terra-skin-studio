import { execFile } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const THEMES_DIR = join(ROOT, "themes");
const FFMPEG = join(HERE, "bin", "ffmpeg.exe");
const FFPROBE = join(HERE, "bin", "ffprobe.exe");
const FONT_SOURCE = "C:\\Windows\\Fonts\\consola.ttf";
const FONT = join(HERE, "bin", "consola.ttf");

const PANEL = { x: 538, y: 324, w: 845, h: 432 };
const DURATION = 12;

async function fileExists(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function ffColor(hex, alpha = null) {
  const value = String(hex).replace("#", "0x");
  return alpha === null ? value : `${value}@${alpha}`;
}

function escapeText(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "")
    .replaceAll(":", " ")
    .replaceAll("%", " percent ");
}

function buildFilter(theme) {
  const accent = ffColor(theme.colors.accent, 0.9);
  const secondary = ffColor(theme.colors.secondary, 0.85);
  const text = ffColor(theme.colors.text, 0.9);
  const id = theme.id.toUpperCase();
  const series = String(theme.series ?? "terra").toUpperCase();
  const lines = [
    { time: 0.7, text: "TERRA OS 3.11  //  OPERATOR TERMINAL", color: accent, size: 24 },
    { time: 1.4, text: "> LINK ESTABLISHED ............. OK", color: text, size: 21 },
    { time: 2.0, text: `> OPERATOR ${id}  //  ${series}`, color: accent, size: 21 },
    { time: 2.7, text: "> VISUAL CORE SYNC ............ 100", color: text, size: 21 },
    { time: 3.4, text: "> CODEX RUNTIME ............... READY", color: text, size: 21 },
    { time: 4.1, text: "> SECURITY LOOPBACK ........... VERIFIED", color: text, size: 21 },
    { time: 4.8, text: "> HANDOFF ..................... ARMED", color: secondary, size: 21 },
  ];
  const video = [
    "[0:v]scale=2200:-2," +
      "zoompan=z='min(zoom+0.00035,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30",
    `drawbox=x=${PANEL.x}:y=${PANEL.y}:w=${PANEL.w}:h=${PANEL.h}:color=black@0.72:t=fill`,
    `drawbox=x=${PANEL.x}:y=${PANEL.y}:w=${PANEL.w}:h=${PANEL.h}:color=${ffColor(theme.colors.accent, 0.85)}:t=2`,
    `drawtext=fontfile=bin/consola.ttf:text='${escapeText(`TERMINAL // ${series}`)}':x=${PANEL.x + 24}:y=${PANEL.y + 14}:fontsize=14:fontcolor=${secondary}`,
    `drawbox=x=${PANEL.x + 24}:y=${PANEL.y + PANEL.h - 54}:w='min(${PANEL.w - 48},max(0,(t-0.5)/6.5*${PANEL.w - 48}))':h=3:color=${ffColor(theme.colors.accent, 0.8)}:t=fill:enable='between(t,0.5,7.0)'`,
    `drawtext=fontfile=bin/consola.ttf:text='_':x=${PANEL.x + 24}:y=${PANEL.y + PANEL.h - 86}:fontsize=22:fontcolor=${accent}:enable='lt(mod(t,0.7),0.35)'`,
  ];
  lines.forEach((line, index) => {
    video.push(
      `drawtext=fontfile=bin/consola.ttf:text='${escapeText(line.text)}':x=${PANEL.x + 24}:y=${PANEL.y + 50 + index * 30}:fontsize=${line.size}:fontcolor=${line.color}:enable='gte(t,${line.time})'`,
    );
  });
  video.push("eq=brightness='if(between(t,7.0,7.18),0.10,0)'");
  video.push("fade=t=in:st=0:d=0.5");
  video.push("fade=t=out:st=11.2:d=0.7");
  video.push("format=yuv420p[v]");
  const audio =
    "[1:a]volume=1.0[pad];" +
    "[2:a]volume=0.10,adelay=800|800[chime1];" +
    "[3:a]volume=0.06,adelay=1250|1250[chime2];" +
    "[pad][chime1][chime2]amix=inputs=3:duration=first:dropout_transition=0," +
    "afade=t=in:st=0:d=0.4,afade=t=out:st=11.0:d=0.9[a]";
  return `${video.join(",")};${audio}`;
}

async function renderTheme(theme, posterPath) {
  const output = join(theme.dir, "boot.mp4");
  const filter = buildFilter(theme);
  const args = [
    "-y",
    "-loop", "1", "-framerate", "30", "-t", String(DURATION), "-i", posterPath,
    "-f", "lavfi", "-t", String(DURATION), "-i",
    "aevalsrc=0.035*sin(2*PI*55*t)+0.015*sin(2*PI*82.5*t):s=48000:d=12",
    "-f", "lavfi", "-t", "1", "-i", "sine=frequency=880:duration=0.35:sample_rate=48000",
    "-f", "lavfi", "-t", "1", "-i", "sine=frequency=1320:duration=0.25:sample_rate=48000",
    "-filter_complex", filter,
    "-map", "[v]", "-map", "[a]",
    "-t", String(DURATION),
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "22",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    output,
  ];
  console.log(`[render] ${theme.id} -> ${output}`);
  await execFileAsync(FFMPEG, args, {
    cwd: HERE,
    timeout: 300000,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  const probe = await execFileAsync(FFPROBE, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_frame_rate,duration",
    "-show_entries", "format=duration,size",
    "-of", "json",
    output,
  ], { timeout: 30000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  console.log(`[ok] ${theme.id}`, probe.stdout.trim().replaceAll("\n", " "));
}

async function main() {
  if (!existsSync(FFMPEG)) throw new Error(`找不到 ffmpeg：${FFMPEG}`);
  if (!existsSync(FONT)) {
    if (!existsSync(FONT_SOURCE)) throw new Error("找不到 Consolas 字体");
    copyFileSync(FONT_SOURCE, FONT);
  }
  const only = process.argv[2] ?? null;
  const entries = (await readdir(THEMES_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
  for (const id of entries) {
    if (only && id !== only) continue;
    const themeDir = join(THEMES_DIR, id);
    const manifestPath = join(themeDir, "theme.json");
    const posterPath = join(themeDir, "poster.jpg");
    if (!(await fileExists(manifestPath)) || !(await fileExists(posterPath))) {
      console.log(`[skip] ${id}: 缺少 theme.json 或 poster.jpg`);
      continue;
    }
    const theme = JSON.parse(await readFile(manifestPath, "utf8"));
    theme.dir = themeDir;
    await renderTheme(theme, posterPath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
