import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const THEMES_DIR = join(ROOT, "themes");
const FFMPEG = join(HERE, "bin", "ffmpeg.exe");
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fileExists(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (await fileExists(candidate)) return candidate;
  }
  throw new Error("找不到 Chrome/Edge，请设置 CHROME_PATH。");
}

function themeCss(theme) {
  const c = theme.colors;
  const accent = c.accent;
  const secondary = c.secondary;
  const surface = c.surface;
  const text = c.text;
  return `
    :root { --accent: ${accent}; --secondary: ${secondary}; --surface: ${surface}; --text: ${text}; }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #030507; }
    body { font-family: Bahnschrift, "Microsoft YaHei UI", "Segoe UI", sans-serif; color: var(--text); }
    .stage { position: relative; width: 1920px; height: 1080px; overflow: hidden;
      background:
        radial-gradient(ellipse at 52% 42%, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 48%),
        radial-gradient(ellipse at 80% 20%, color-mix(in srgb, var(--secondary) 12%, transparent) 0%, transparent 38%),
        linear-gradient(135deg, var(--surface) 0%, #05080b 58%, #020304 100%);
    }
    .planes { position: absolute; inset: -12%; opacity: .26; transform: skewY(-6deg) scale(1.03); }
    .plane { position: absolute; }
    .plane.a { left: -12%; top: -22%; width: 64%; height: 156%;
      background: linear-gradient(116deg, transparent 0 41%, var(--accent) 41% 42.2%, transparent 42.2% 100%);
      transform: perspective(1200px) rotateY(18deg) rotateZ(-5deg); opacity: .42; }
    .plane.b { right: -14%; top: 2%; width: 58%; height: 130%;
      background: linear-gradient(72deg, transparent 0 54%, var(--secondary) 54% 55.2%, transparent 55.2% 100%);
      transform: perspective(1400px) rotateY(-22deg) rotateZ(4deg); opacity: .30; }
    .plane.c { left: 20%; bottom: -32%; width: 78%; height: 62%;
      background: linear-gradient(0deg, color-mix(in srgb, var(--accent) 55%, transparent) 0%, transparent 68%);
      transform: perspective(900px) rotateX(58deg); opacity: .20; filter: blur(2px); }
    .horizon { position: absolute; left: 0; right: 0; top: 59%; height: 1px;
      background: linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent) 65%, transparent) 44%, transparent 100%);
      opacity: .45; }
    .orbit { position: absolute; left: 52%; top: 50%; width: 980px; height: 980px;
      transform: translate(-50%, -50%) rotate(-10deg); border: 1px solid color-mix(in srgb, var(--accent) 38%, transparent);
      border-radius: 50%; opacity: .22; }
    .orbit.two { width: 640px; height: 640px; left: 58%; top: 48%; opacity: .14; }
    .art-backdrop { display: none; }
    .paper-mode .stage {
      background:
        radial-gradient(ellipse at 54% 36%, color-mix(in srgb, var(--accent) 14%, transparent) 0%, transparent 55%),
        #E9E5DA;
    }
    .paper-mode .art-backdrop {
      display: block; position: absolute; left: 32%; top: -6%; width: 74%; height: 112%;
      z-index: 0; background: linear-gradient(155deg, var(--surface) 0%, #05080b 78%);
      clip-path: polygon(9% 0, 100% 0, 100% 100%, 0 100%);
    }
    .paper-mode .planes { opacity: .18; }
    .paper-mode .shade {
      background:
        linear-gradient(90deg, #E9E5DA 0%, #E9E5DA 24%, transparent 54%),
        linear-gradient(0deg, #E9E5DA 0%, transparent 34%);
    }
    .paper-mode .vignette {
      background: radial-gradient(ellipse at 55% 40%, transparent 36%, rgba(233,229,218,.55) 100%);
    }
    .paper-mode .brand { color: #121518; }
    .paper-mode .rail { color: color-mix(in srgb, #121518 46%, transparent); }
    .paper-mode .stripes { opacity: .18; }
    .paper-mode .scanlines { opacity: .04; }
    .paper-mode .art-wrap { left: 50%; }
    .art-blur { position: absolute; left: 50%; bottom: -18%; height: 136%; width: auto;
      transform: translateX(-50%) scale(1.06); opacity: .30;
      filter: blur(30px) saturate(1.15); }
    .art-wrap { position: absolute; left: 50%; bottom: -12%; height: 126%; width: 82%;
      transform: translateX(-50%); }
    .art-wrap.poster { left: 58%; width: 78%; }
    .art { position: absolute; right: 0; bottom: 0; height: 100%; width: auto;
      filter: drop-shadow(0 30px 60px rgba(0,0,0,.55)); }
    .scanlines { position: absolute; inset: 0; opacity: .08;
      background: repeating-linear-gradient(0deg, rgba(0,0,0,.6) 0 1px, transparent 1px 5px); }
    .vignette { position: absolute; inset: 0;
      background: radial-gradient(ellipse at 52% 40%, transparent 30%, rgba(0,0,0,.52) 100%); }
    .shade { position: absolute; inset: 0;
      background:
        linear-gradient(90deg, var(--surface) 0%, color-mix(in srgb, var(--surface) 88%, transparent) 28%, transparent 60%),
        linear-gradient(0deg, color-mix(in srgb, var(--surface) 96%, transparent) 0%, transparent 40%); }
    .stripes { position: absolute; left: 0; right: 0; height: 10px; opacity: .30;
      background: repeating-linear-gradient(45deg, var(--accent) 0 14px, transparent 14px 28px);
      mask-image: linear-gradient(90deg, #000 0%, #000 55%, transparent 92%); }
    .stripes.top { top: 0; }
    .stripes.bottom { bottom: 0; }
    .corner { position: absolute; width: 34px; height: 34px; border-color: var(--accent); border-style: solid; opacity: .62; }
    .corner.tl { top: 34px; left: 42px; border-width: 2px 0 0 2px; }
    .corner.tr { top: 34px; right: 42px; border-width: 2px 2px 0 0; }
    .corner.bl { bottom: 34px; left: 42px; border-width: 0 0 2px 2px; }
    .corner.br { bottom: 34px; right: 42px; border-width: 0 2px 2px 0; }
    .content { position: absolute; left: 96px; top: 126px; width: 760px; }
    .brand { display: flex; align-items: center; gap: 14px; font: 700 18px/1 Consolas, monospace;
      letter-spacing: 4px; color: var(--accent); text-transform: uppercase; }
    .diamond { width: 13px; height: 13px; background: var(--accent); transform: rotate(45deg); box-shadow: 0 0 16px var(--accent); }
    .series { margin-top: 40px; font: 700 15px/1 Consolas, monospace; letter-spacing: 5px; color: color-mix(in srgb, var(--text) 58%, transparent); }
    .headline { margin-top: 16px; font-size: 150px; line-height: .9; font-weight: 800; letter-spacing: 3px;
      color: var(--text); text-shadow: 0 0 42px color-mix(in srgb, var(--accent) 26%, transparent); }
    .headline.latin { font-size: 92px; letter-spacing: 7px; }
    .subtitle { margin-top: 22px; font: 600 22px/1.3 Consolas, monospace; letter-spacing: 3px; color: var(--accent); }
    .tagline { margin-top: 26px; font: 500 24px/1.5 "Microsoft YaHei UI", sans-serif; color: color-mix(in srgb, var(--text) 78%, transparent); max-width: 620px; }
    .divider { margin-top: 32px; width: 300px; height: 2px; background: linear-gradient(90deg, var(--accent), transparent); }
    .data { position: absolute; left: 96px; bottom: 92px; width: 760px; font: 600 14px/1.9 Consolas, monospace;
      letter-spacing: 2px; color: color-mix(in srgb, var(--text) 54%, transparent); }
    .data b { color: var(--accent); font-weight: 700; }
    .barcode { display: inline-block; width: 156px; height: 22px; vertical-align: middle; margin-left: 16px; opacity: .5;
      background: repeating-linear-gradient(90deg, var(--accent) 0 2px, transparent 2px 4px, var(--accent) 4px 7px, transparent 7px 11px); }
    .rail { position: absolute; right: 34px; top: 50%; transform: translateY(-50%);
      writing-mode: vertical-rl; font: 700 13px/1 Consolas, monospace; letter-spacing: 7px;
      color: color-mix(in srgb, var(--text) 46%, transparent); text-transform: uppercase; }
    .index { position: absolute; right: 84px; top: 42px; font: 800 112px/1 Bahnschrift, sans-serif;
      color: transparent; -webkit-text-stroke: 1px color-mix(in srgb, var(--accent) 42%, transparent); opacity: .55; }
    .seal { position: absolute; right: 118px; bottom: 72px; width: 88px; height: 88px; border: 2px solid var(--accent);
      border-radius: 50%; display: grid; place-items: center; transform: rotate(-12deg); opacity: .30;
      font: 700 16px/1 "Microsoft YaHei UI", serif; letter-spacing: 2px; color: var(--accent); }
    .bokeh { position: absolute; inset: 0; opacity: .32; background-image:
      radial-gradient(circle at 16% 22%, color-mix(in srgb, var(--accent) 55%, transparent) 0 2px, transparent 3px),
      radial-gradient(circle at 78% 14%, color-mix(in srgb, var(--secondary) 45%, transparent) 0 2px, transparent 3px),
      radial-gradient(circle at 88% 68%, color-mix(in srgb, var(--accent) 35%, transparent) 0 3px, transparent 4px),
      radial-gradient(circle at 36% 82%, color-mix(in srgb, var(--secondary) 35%, transparent) 0 2px, transparent 3px);
      background-size: 260px 260px; }
    .ticks { position: absolute; right: 120px; bottom: 180px; display: flex; gap: 7px; align-items: flex-end; opacity: .35; }
    .ticks i { display: block; width: 1px; background: var(--accent); }
    .decor-endfield .stripes { opacity: .36; }
    .decor-rhodes .stripes { opacity: .10; }
    .decor-sui .planes { opacity: .18; }
    .decor-sui .seal { border-radius: 8px; font-size: 30px; letter-spacing: 0; opacity: .28; }
    .decor-goldenglow .stripes { opacity: .06; }
    .decor-goldenglow .seal { display: none; }
    .hero-only .content { top: 70px; bottom: auto; width: auto; }
    .hero-only .headline, .hero-only .subtitle, .hero-only .tagline, .hero-only .divider,
    .hero-only .series, .hero-only .data, .hero-only .index { display: none; }
    .hero-only .brand { opacity: .78; }
    .hero-only .art-wrap { left: 50%; }
    .hero-only .shade { background:
      radial-gradient(ellipse at 50% 42%, transparent 30%, color-mix(in srgb, var(--surface) 92%, transparent) 100%),
      linear-gradient(0deg, color-mix(in srgb, var(--surface) 94%, transparent) 0%, transparent 36%); }
  `;
}

function ticksHtml() {
  const widths = [10, 18, 26, 14, 34, 22, 42, 16, 30, 20, 38, 12];
  return widths.map((height) => `<i style="height:${height}px"></i>`).join("");
}

function buildHtml(theme, artDataUrl, { hero, paper = false }) {
  const decor = `decor-${theme.decor ?? "custom"}`;
  const headlineClass = /^[A-Za-z0-9\s.\-]+$/.test(theme.name) ? "headline latin" : "headline";
  const index = String(theme.index ?? 1).padStart(2, "0");
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>${escapeHtml(theme.name)}</title><style>${themeCss(theme)}</style></head>
<body class="${decor} ${hero ? "hero-only" : ""} ${paper ? "paper-mode" : ""}">
  <div class="stage">
    <div class="planes" aria-hidden="true"><i class="plane a"></i><i class="plane b"></i><i class="plane c"></i></div>
    <div class="orbit" aria-hidden="true"></div>
    <div class="orbit two" aria-hidden="true"></div>
    <div class="horizon" aria-hidden="true"></div>
    <div class="art-backdrop" aria-hidden="true"></div>
    <img class="art-blur" alt="" src="${artDataUrl}">
    <div class="art-wrap ${hero ? "" : "poster"}"><img class="art" alt="" src="${artDataUrl}"></div>
    <div class="scanlines"></div>
    <div class="shade"></div>
    <div class="vignette"></div>
    <div class="stripes top"></div>
    <div class="stripes bottom"></div>
    ${theme.decor === "goldenglow" ? '<div class="bokeh"></div>' : ""}
    <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
    <div class="index">${index}</div>
    <div class="rail">${escapeHtml(theme.series?.toUpperCase() ?? "PRTS")} // OPERATOR // ${escapeHtml(theme.id.toUpperCase())}</div>
    <div class="ticks" aria-hidden="true">${ticksHtml()}</div>
    <div class="content">
      <div class="brand"><i class="diamond"></i>${escapeHtml(theme.copy?.brand ?? "PRTS")}</div>
      <div class="series">${escapeHtml(theme.subtitle ?? "")}</div>
      <div class="${headlineClass}">${escapeHtml(theme.name)}</div>
      <div class="subtitle">${escapeHtml(theme.subtitle ?? "")}</div>
      <div class="tagline">${escapeHtml(theme.copy?.tagline ?? "")}</div>
      <div class="divider"></div>
    </div>
    <div class="data">
      <div>&gt; OPERATOR LINK <b>ESTABLISHED</b>  //  SYNC <b>100%</b><span class="barcode"></span></div>
      <div>&gt; CHANNEL ${escapeHtml(theme.series?.toUpperCase() ?? "PRTS")}-${index}  //  LAT 31.2304  LON 121.4737</div>
    </div>
    <div class="seal">${escapeHtml(theme.name)}</div>
  </div>
</body></html>`;
}

async function chromeScreenshot(chrome, htmlPath, pngPath, profileDir) {
  await mkdir(profileDir, { recursive: true });
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--force-device-scale-factor=1",
    "--window-size=1920,1080",
    "--virtual-time-budget=4000",
    `--user-data-dir=${profileDir}`,
    `--screenshot=${pngPath}`,
    pathToFileURL(htmlPath).href,
  ];
  await execFileAsync(chrome, args, { timeout: 90000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
}

async function encodeJpeg(input, output, width = null) {
  const args = ["-y", "-i", input];
  if (width) args.push("-vf", `scale=${width}:-2`);
  args.push("-q:v", "3", output);
  await execFileAsync(FFMPEG, args, { timeout: 120000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
}

async function main() {
  const chrome = await findChrome();
  if (!(await fileExists(FFMPEG))) throw new Error(`找不到 ffmpeg：${FFMPEG}`);
  const entries = (await readdir(THEMES_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
  const order = ["si", "zhuang-fangyi", "goldenglow", "shu"];
  entries.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  let index = 0;
  for (const id of entries) {
    const themeDir = join(THEMES_DIR, id);
    const manifestPath = join(themeDir, "theme.json");
    if (!(await fileExists(manifestPath))) continue;
    const artPath = join(themeDir, "art", "source.png");
    if (!(await fileExists(artPath))) {
      console.log(`[skip] ${id}: 缺少 art/source.png`);
      continue;
    }
    index += 1;
    const theme = JSON.parse(await readFile(manifestPath, "utf8"));
    theme.index = index;
    const artBuffer = await readFile(artPath);
    const artDataUrl = `data:image/png;base64,${artBuffer.toString("base64")}`;
    const artDir = join(themeDir, "art");
    const profileDir = join(HERE, "bin", "chrome-profile");
    await mkdir(artDir, { recursive: true });

    for (const kind of ["poster", "hero"]) {
      const htmlPath = join(artDir, `${kind}.html`);
      const pngPath = join(artDir, `${kind}.png`);
      const jpgPath = join(themeDir, `${kind}.jpg`);
      await writeFile(htmlPath, buildHtml(theme, artDataUrl, { hero: kind === "hero" }), "utf8");
      console.log(`[render] ${id} ${kind}`);
      await chromeScreenshot(chrome, htmlPath, pngPath, profileDir);
      await encodeJpeg(pngPath, jpgPath);
      await unlink(pngPath).catch(() => {});
      console.log(`[ok] ${id} ${kind}.jpg`);
    }

    {
      const htmlPath = join(artDir, "hero-paper.html");
      const pngPath = join(artDir, "hero-paper.png");
      const jpgPath = join(themeDir, "hero-paper.jpg");
      await writeFile(htmlPath, buildHtml(theme, artDataUrl, { hero: true, paper: true }), "utf8");
      console.log(`[render] ${id} hero-paper`);
      await chromeScreenshot(chrome, htmlPath, pngPath, profileDir);
      await encodeJpeg(pngPath, jpgPath);
      await unlink(pngPath).catch(() => {});
      console.log(`[ok] ${id} hero-paper.jpg`);
    }

    const previewPath = join(themeDir, "preview.jpg");
    await encodeJpeg(join(themeDir, "poster.jpg"), previewPath, 640);
    console.log(`[ok] ${id} preview.jpg`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
