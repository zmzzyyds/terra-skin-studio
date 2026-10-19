import { execFile, spawn } from "node:child_process";
import { statSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { CdpSession, fetchTargets, fetchVersion } from "../../src/injector/cdp.mjs";

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const THEMES_DIR = join(ROOT, "themes");
const FFMPEG = join(HERE, "bin", "ffmpeg.exe");
const FFPROBE = join(HERE, "bin", "ffprobe.exe");
const FONT = join(HERE, "bin", "consola.ttf");
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const FPS = 30;
const DURATION = Number(process.env.TERRA_MOTION_DURATION || 16);
const FRAME_COUNT = FPS * DURATION;
const OUT_NAME = process.env.TERRA_MOTION_OUT || "boot.mp4";
const OUT_SCALE = process.env.TERRA_MOTION_SCALE || "";
const WITH_AUDIO = process.env.TERRA_MOTION_AUDIO !== "0";
const CRF = process.env.TERRA_MOTION_CRF || "20";
const CDP_PORT = 9333;

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

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function latinSizeFor(id) {
  if (id === "zhuang-fangyi") return 86;
  if (id === "goldenglow") return 104;
  return 190;
}

function buildMotionHtml(theme, artDataUrl) {
  const accent = theme.colors.accent;
  const secondary = theme.colors.secondary;
  const surface = theme.colors.surface;
  const text = theme.colors.text;
  const id = theme.id.toUpperCase();
  const series = String(theme.series ?? "terra").toUpperCase();
  const latinSize = latinSizeFor(theme.id);
  const latinName = theme.id === "zhuang-fangyi"
    ? "ZHUANG FANGYI"
    : theme.id === "goldenglow"
      ? "GOLDENGLOW"
      : theme.id.toUpperCase();
  const indexLabel = String(theme.index ?? 1).padStart(2, "0");
  const dateLabel = new Date().toISOString().slice(0, 10).replaceAll("-", ".");
  const lines = [
    "TERRA OS 3.11  //  OPERATOR TERMINAL",
    "> LINK ESTABLISHED ............ OK",
    `> OPERATOR ${id}  //  ${series}`,
    "> VISUAL CORE SYNC ............ 100",
    "> CODEX RUNTIME ............... READY",
    "> SECURITY LOOPBACK ........... VERIFIED",
    "> HANDOFF ..................... ARMED",
  ];
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${escapeHtml(theme.name)} // motion</title>
<style>
  :root {
    --accent: ${accent};
    --secondary: ${secondary};
    --surface: ${surface};
    --text: ${text};
    --paper: #E9E5DA;
    --ink: #121518;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #05080b; }
  body { font-family: Bahnschrift, "Microsoft YaHei UI", "Segoe UI", sans-serif; color: var(--ink); }
  #stage { position: relative; width: 1920px; height: 1080px; overflow: hidden; background: var(--paper); }

  .ink-panel { position: absolute; left: 46%; top: -4%; width: 60%; height: 108%;
    background: linear-gradient(160deg, var(--surface) 0%, #05080b 72%);
    clip-path: polygon(7% 0, 100% 0, 100% 100%, 0 100%); z-index: 1; }
  .planes { position: absolute; inset: 0; z-index: 2; pointer-events: none; overflow: hidden; }
  .planes i { position: absolute; display: block; }
  .planes .p1 { left: -10%; top: -20%; width: 70%; height: 150%;
    background: linear-gradient(116deg, transparent 0 48%, var(--accent) 48% 49.2%, transparent 49.2% 100%);
    transform: perspective(1200px) rotateY(18deg); opacity: .38; }
  .planes .p2 { right: -12%; top: 8%; width: 56%; height: 124%;
    background: linear-gradient(72deg, transparent 0 55%, var(--secondary) 55% 56.2%, transparent 56.2% 100%);
    transform: perspective(1400px) rotateY(-22deg); opacity: .30; }
  .planes .p3 { left: 18%; bottom: -30%; width: 82%; height: 60%;
    background: linear-gradient(0deg, color-mix(in srgb, var(--accent) 60%, transparent) 0%, transparent 70%);
    transform: perspective(900px) rotateX(58deg); opacity: .13; filter: blur(2px); }

  .character { position: absolute; inset: 0; z-index: 5; }
  .char { position: absolute; right: 2%; bottom: -8%; height: 124%; width: auto;
    filter: drop-shadow(0 30px 60px rgba(0,0,0,.55)); transform-origin: 55% 80%; }
  .char-blur { position: absolute; right: -2%; bottom: -14%; height: 136%; width: auto;
    filter: blur(30px) saturate(1.2); opacity: 0; }

  .accent-block { position: absolute; left: 6%; top: 53.6%; width: 34%; height: 10px;
    background: var(--accent); z-index: 4; transform-origin: left center; transform: scaleX(0); }
  .accent-block.second { left: auto; right: 7%; top: 13%; width: 24%; height: 6px;
    background: var(--secondary); transform-origin: right center; }

  .type { position: absolute; inset: 0; z-index: 8; pointer-events: none; }
  .brand { position: absolute; left: 72px; top: 66px; display: flex; align-items: center; gap: 14px;
    font: 700 18px/1 Consolas, monospace; letter-spacing: 4px; color: var(--ink); text-transform: uppercase; }
  .diamond { width: 13px; height: 13px; background: var(--accent); transform: rotate(45deg); }
  .latin { position: absolute; left: 64px; top: 128px; font-size: ${latinSize}px; line-height: .82;
    font-weight: 800; letter-spacing: -2px; color: var(--ink); white-space: nowrap; opacity: 0; }
  .cn { position: absolute; left: 68px; top: 306px; font-family: "Microsoft YaHei UI", "Noto Sans SC", sans-serif;
    font-size: 188px; line-height: .92; font-weight: 800; letter-spacing: 4px; color: var(--ink); opacity: 0; }
  .sub { position: absolute; left: 74px; top: 512px; font: 600 21px/1.3 Consolas, monospace;
    letter-spacing: 4px; color: color-mix(in srgb, var(--ink) 66%, transparent); opacity: 0; }
  .tag { position: absolute; left: 74px; top: 544px; font: 500 20px/1.4 "Microsoft YaHei UI", sans-serif;
    color: color-mix(in srgb, var(--ink) 74%, transparent); opacity: 0; }
  .serial { position: absolute; left: 74px; bottom: 20px; font: 700 12px/1 Consolas, monospace;
    letter-spacing: 3px; color: color-mix(in srgb, var(--ink) 48%, transparent); }

  .hud { position: absolute; inset: 0; z-index: 6; pointer-events: none; }
  .index { position: absolute; right: 62px; top: 46px; font: 800 132px/1 Bahnschrift, sans-serif;
    color: transparent; -webkit-text-stroke: 1px color-mix(in srgb, var(--accent) 62%, transparent); opacity: 0; }
  .rail { position: absolute; right: 26px; top: 50%; transform: translateY(-50%);
    writing-mode: vertical-rl; font: 700 13px/1 Consolas, monospace; letter-spacing: 7px;
    color: color-mix(in srgb, var(--text) 52%, transparent); text-transform: uppercase; }
  .circle { position: absolute; left: 60%; top: 50%; width: 76vmin; height: 76vmin;
    border: 1px solid color-mix(in srgb, var(--accent) 42%, transparent); border-radius: 50%;
    transform: translate(-50%, -50%); opacity: 0; }
  .crosshair { position: absolute; right: 16%; top: 26%; width: 60px; height: 60px; opacity: 0; }
  .crosshair i { position: absolute; background: var(--accent); }
  .crosshair i:nth-child(1) { left: 29px; top: 0; width: 1px; height: 16px; }
  .crosshair i:nth-child(2) { left: 29px; bottom: 0; width: 1px; height: 16px; }
  .crosshair i:nth-child(3) { top: 29px; left: 0; height: 1px; width: 16px; }
  .crosshair i:nth-child(4) { top: 29px; right: 0; height: 1px; width: 16px; }
  .ticks { position: absolute; right: 120px; top: 128px; display: flex; gap: 7px; align-items: flex-end;
    opacity: 0; }
  .ticks i { display: block; width: 1px; background: var(--accent); }
  .barcode { position: absolute; right: 122px; bottom: 74px; width: 168px; height: 24px; opacity: 0;
    background: repeating-linear-gradient(90deg, var(--accent) 0 2px, transparent 2px 4px,
      var(--accent) 4px 7px, transparent 7px 11px); }
  .label { position: absolute; right: 122px; top: 96px; font: 700 11px/1 Consolas, monospace;
    letter-spacing: 3px; color: color-mix(in srgb, var(--text) 46%, transparent); opacity: 0; }

  .terminal { position: absolute; left: 5%; top: 55%; width: 40%; height: 40%; z-index: 9;
    background: color-mix(in srgb, var(--surface) 96%, transparent);
    border: 2px solid var(--accent); padding: 20px 22px; overflow: hidden; opacity: 0;
    transform: translateY(70px); box-shadow: 0 18px 50px rgba(0,0,0,.45); }
  .term-head { font: 700 14px/1 Consolas, monospace; letter-spacing: 3px; color: var(--accent);
    border-bottom: 1px solid color-mix(in srgb, var(--accent) 46%, transparent); padding-bottom: 10px; }
  .lines { margin-top: 12px; }
  .line { font: 600 16px/1.55 Consolas, monospace; color: var(--text); white-space: nowrap;
    clip-path: inset(0 100% 0 0); }
  .line:nth-child(3) { color: var(--accent); }
  .progress { position: absolute; left: 22px; right: 22px; bottom: 26px; height: 3px;
    background: color-mix(in srgb, var(--text) 14%, transparent); }
  .progress i { display: block; width: 0; height: 100%; background: var(--accent); }
  .cursor { position: absolute; left: 22px; bottom: 34px; font: 700 18px/1 Consolas, monospace;
    color: var(--accent); opacity: 0; }

  .flash { position: absolute; inset: 0; z-index: 60; background: var(--paper); opacity: 0; pointer-events: none; }
  .bar { position: absolute; left: 0; right: 0; z-index: 50; background: #05080b; }
  .bar.top { top: 0; height: 45%; }
  .bar.bottom { bottom: 0; height: 45%; }
  .boot { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 55;
    font: 700 14px/1 Consolas, monospace; letter-spacing: 6px; color: var(--accent); }
  .mega-band { position: absolute; left: 0; right: 0; top: 44%; height: 86px; z-index: 6;
    background: var(--paper); border-left: 10px solid var(--accent);
    transform: scaleX(0); transform-origin: left center; }
  .mega { position: absolute; left: 48%; top: calc(44% + 10px); z-index: 7;
    color: var(--ink); font-size: 56px; font-weight: 800; letter-spacing: -1px;
    white-space: nowrap; opacity: 0; }
  .scan { position: absolute; left: 0; right: 0; top: 55%; height: 2px; z-index: 10; opacity: 0;
    background: linear-gradient(90deg, transparent 0%, var(--accent) 45%, var(--secondary) 55%, transparent 100%); }
  .final { position: absolute; inset: 0; z-index: 40; opacity: 0; background: var(--paper);
    display: flex; flex-direction: column; justify-content: center; padding-left: 92px; }
  .final-title { color: var(--ink); font: 800 84px/.95 Bahnschrift, "Microsoft YaHei UI", sans-serif; letter-spacing: -1px; }
  .final-sub { margin-top: 22px; color: color-mix(in srgb, var(--ink) 66%, transparent);
    font: 700 18px/1.4 Consolas, monospace; letter-spacing: 3px; }
  .final-line { margin-top: 28px; width: 420px; height: 4px; background: var(--accent); }
  .final-serial { position: absolute; left: 92px; bottom: 70px;
    color: color-mix(in srgb, var(--ink) 46%, transparent); font: 700 12px/1 Consolas, monospace; letter-spacing: 3px; }
</style>
</head>
<body>
  <div id="stage">
    <div class="ink-panel" id="inkPanel"></div>
    <div class="planes"><i class="p1"></i><i class="p2"></i><i class="p3"></i></div>
    <div class="character">
      <img class="char-blur" id="charBlur" alt="" src="${artDataUrl}">
      <img class="char" id="char" alt="" src="${artDataUrl}">
    </div>
    <div class="accent-block" id="accentBlock"></div>
    <div class="accent-block second" id="accentBlock2"></div>
    <div class="type">
      <div class="brand" id="brand"><i class="diamond"></i>${escapeHtml(theme.copy?.brand ?? "TERRA TERMINAL")}</div>
      <div class="latin" id="latin">${escapeHtml(latinName)}</div>
      <div class="cn" id="cn">${escapeHtml(theme.name)}</div>
      <div class="sub" id="sub">${escapeHtml(theme.subtitle ?? "")}</div>
      <div class="tag" id="tag">${escapeHtml(theme.copy?.tagline ?? "")}</div>
      <div class="serial">${escapeHtml(theme.series?.toUpperCase() ?? "TERRA")} // OPERATOR // ${escapeHtml(theme.id.toUpperCase())}</div>
    </div>
    <div class="hud">
      <div class="index" id="index">${indexLabel}</div>
      <div class="rail" id="rail">${escapeHtml(theme.series?.toUpperCase() ?? "TERRA")} // OPERATOR // ${escapeHtml(theme.id.toUpperCase())}</div>
      <div class="circle" id="circle"></div>
      <div class="crosshair" id="crosshair"><i></i><i></i><i></i><i></i></div>
      <div class="ticks" id="ticks"><i style="height:12px"></i><i style="height:22px"></i><i style="height:34px"></i><i style="height:16px"></i><i style="height:42px"></i><i style="height:24px"></i><i style="height:30px"></i><i style="height:14px"></i><i style="height:38px"></i><i style="height:20px"></i></div>
      <div class="barcode" id="barcode"></div>
      <div class="label" id="label">TERRA TERMINAL // ${escapeHtml(series)}</div>
    </div>
    <div class="scan" id="scan"></div>
    <div class="mega-band" id="megaBand"></div>
    <div class="mega" id="mega">LINK ESTABLISHED</div>
    <div class="terminal" id="terminal">
      <div class="term-head">TERMINAL // ${escapeHtml(series)}</div>
      <div class="lines">
        ${lines.map((line) => `<div class="line">${escapeHtml(line)}</div>`).join("")}
      </div>
      <div class="progress"><i id="progressBar"></i></div>
      <div class="cursor" id="cursor">_</div>
    </div>
    <div class="flash" id="flash"></div>
    <div class="bar top" id="barTop"></div>
    <div class="bar bottom" id="barBottom"></div>
    <div class="boot" id="boot">TERRA TERMINAL // BOOT</div>
    <div class="final" id="final">
      <div class="final-title">LINK ESTABLISHED</div>
      <div class="final-sub">TERRA TERMINAL // ${escapeHtml(series)} // ${escapeHtml(theme.name)}</div>
      <div class="final-line"></div>
      <div class="final-serial">CODEX // ${escapeHtml(series)} // ${dateLabel}</div>
    </div>
  </div>
<script>
(() => {
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, x));
  const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const el = {
    stage: $("stage"), ink: $("inkPanel"), char: $("char"), charBlur: $("charBlur"),
    latin: $("latin"), cn: $("cn"), sub: $("sub"), tag: $("tag"), index: $("index"),
    circle: $("circle"), crosshair: $("crosshair"), ticks: $("ticks"), barcode: $("barcode"),
    label: $("label"), terminal: $("terminal"), progress: $("progressBar"), cursor: $("cursor"),
    flash: $("flash"), barTop: $("barTop"), barBottom: $("barBottom"), boot: $("boot"),
    accent: $("accentBlock"), accent2: $("accentBlock2"),
    mega: $("mega"), megaBand: $("megaBand"), scan: $("scan"), final: $("final")
  };
  const lines = [...document.querySelectorAll(".line")];

  window.__seek = (t) => {
    const bars = 45 - 45 * ease(seg(t, 0.55, 1.25));
    el.barTop.style.height = bars + "%";
    el.barBottom.style.height = bars + "%";
    el.boot.style.opacity = t < 0.95 ? String(1 - ease(seg(t, 0.55, 0.95))) : "0";

    const ink = ease(seg(t, 0.55, 1.35));
    el.ink.style.transform = "translateX(" + ((1 - ink) * 56) + "%)";

    const loopRaw = t >= 10 ? ((t - 10) % 2 + 2) % 2 : 0;
    const loopPhase = loopRaw / 2;
    const sway = t >= 10 ? Math.sin(loopPhase * Math.PI * 2) * 8 : Math.sin(t * 0.55) * 7;

    const ch = ease(seg(t, 1.05, 2.1));
    el.char.style.clipPath = "inset(" + ((1 - ch) * 100) + "% 0 0 0)";
    el.char.style.transform =
      "translate3d(" + ((1 - ch) * 55) + "px," + ((1 - ch) * 20) + "px,0) " +
      "scale(" + (1.05 - 0.05 * ch) + ") translateX(" + sway + "px)";
    el.charBlur.style.opacity = String(0.35 * ch);
    el.charBlur.style.transform = "translateX(" + (Math.sin(t * 0.4) * 10 + sway * 0.5) + "px)";

    const lat = ease(seg(t, 0.9, 1.7));
    el.latin.style.opacity = String(lat);
    el.latin.style.transform = "translateX(" + ((1 - lat) * -540) + "px)";

    const cn = ease(seg(t, 1.25, 1.85));
    el.cn.style.opacity = String(cn);
    el.cn.style.transform = "translateY(" + ((1 - cn) * 44) + "px) scale(" + (1.18 - 0.18 * cn) + ")";

    const sub = ease(seg(t, 1.6, 2.2));
    el.sub.style.opacity = String(sub);
    el.tag.style.opacity = String(sub);

    el.accent.style.transform = "scaleX(" + ease(seg(t, 1.8, 2.3)) + ")";
    el.accent2.style.transform = "scaleX(" + ease(seg(t, 2.1, 2.6)) + ")";

    const ix = ease(seg(t, 2.2, 2.9));
    el.index.style.opacity = String(ix * 0.6);
    el.index.style.transform = "translateY(" + ((1 - ix) * 30) + "px)";

    const hud = ease(seg(t, 2.5, 3.6));
    const circleRot = t >= 10 ? loopPhase * 360 : t * 6;
    el.circle.style.opacity = String(0.22 * hud);
    el.circle.style.transform = "translate(-50%,-50%) rotate(" + circleRot + "deg)";
    el.crosshair.style.opacity = String(0.62 * hud);
    el.ticks.style.opacity = String(0.42 * hud + (t >= 10 ? 0.08 * Math.sin(loopPhase * Math.PI * 2) : 0));
    el.barcode.style.opacity = String(0.5 * hud);
    el.label.style.opacity = String(0.55 * hud);

    const term = ease(seg(t, 4.45, 5.0));
    el.terminal.style.opacity = String(term);
    el.terminal.style.transform = "translateY(" + ((1 - term) * 70) + "px)";

    lines.forEach((line, i) => {
      const start = 4.8 + i * 0.22;
      const p = ease(seg(t, start, start + 0.2));
      line.style.clipPath = "inset(0 " + ((1 - p) * 100) + "% 0 0)";
    });
    el.progress.style.width = (ease(seg(t, 5.0, 7.0)) * 100) + "%";
    el.cursor.style.opacity = t > 4.7 && Math.floor(t * 4) % 2 === 0 ? "1" : "0";

    const megaBand = ease(seg(t, 8.0, 8.85));
    el.megaBand.style.transform = "scaleX(" + megaBand + ")";
    const mega = ease(seg(t, 8.25, 8.95));
    el.mega.style.opacity = t < 12.5 ? String(0.95 * mega) : "0";
    el.mega.style.transform = "translateX(" + ((1 - mega) * 40) + "px)";

    let scanTop = 55;
    let scanOpacity = 0;
    if (t >= 10 && t < 12.5) {
      scanTop = 55 + loopPhase * 40;
      scanOpacity = 0.34 * Math.sin(Math.PI * loopPhase);
    } else if (t >= 7.5 && t < 10) {
      scanTop = 55 + ((t - 7.5) % 3) / 3 * 40;
      scanOpacity = 0.10;
    }
    el.scan.style.top = scanTop + "%";
    el.scan.style.opacity = String(scanOpacity);

    el.flash.style.opacity = t > 12.38 && t < 12.5 ? "0.30" : "0";
    const finalP = ease(seg(t, 12.5, 12.9));
    el.final.style.opacity = String(finalP);
    const fade = ease(seg(t, 15.0, 16.0));
    el.stage.style.opacity = String(1 - fade);
  };

  window.__seek(0);
  let pending = 2;
  const ready = () => {
    pending -= 1;
    if (pending > 0) return;
    window.__seek(0);
    window.__ready = true;
  };
  const images = [el.char, el.charBlur];
  images.forEach((image) => {
    if (image.complete && image.naturalWidth) ready();
    else image.addEventListener("load", ready, { once: true });
    image.addEventListener("error", ready, { once: true });
  });
})();
</script>
</body>
</html>`;
}

async function waitForCdp(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const version = await fetchVersion(port, { timeoutMs: 1000 });
    if (version) return version;
    await sleep(250);
  }
  throw new Error("headless Chrome CDP 没有启动");
}

async function startChrome(chromePath) {
  const profile = join(HERE, "bin", "chrome-motion-" + Date.now());
  await mkdir(profile, { recursive: true });
  const child = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--force-device-scale-factor=1",
    "--window-size=1920,1080",
    "--remote-debugging-port=" + CDP_PORT,
    "--user-data-dir=" + profile,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  await waitForCdp(CDP_PORT);
  const targets = await fetchTargets(CDP_PORT);
  const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (!page) throw new Error("headless Chrome 没有页面目标");
  const session = new CdpSession(page.webSocketDebuggerUrl, { expectedPort: CDP_PORT });
  await session.open();
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return { child, session, profile };
}

async function waitForReady(session, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await session.evaluate("window.__ready === true").catch(() => false);
    if (ready) return true;
    await sleep(120);
  }
  throw new Error("动画页面加载超时");
}

async function captureFrames(session, theme, frameDir) {
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });
  for (let index = 0; index < FRAME_COUNT; index += 1) {
    const t = index / FPS;
    await session.evaluate("window.__seek(" + t + ")");
    await session.evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))", { awaitPromise: true });
    const result = await session.send("Page.captureScreenshot", {
      format: "jpeg",
      quality: 92,
      fromSurface: true,
      captureBeyondViewport: false,
    });
    if (!result.data) throw new Error("截图没有返回数据");
    await writeFile(join(frameDir, String(index).padStart(4, "0") + ".jpg"), Buffer.from(result.data, "base64"));
    if (index % 60 === 0) console.log(`[frame] ${theme.id} ${index}/${FRAME_COUNT}`);
  }
}

async function encodeVideo(theme, frameDir, output) {
  const fadeOut = Math.max(0, DURATION - 1.4);
  const filter =
    "[1:a]volume=1.0[pad];" +
    "[2:a]volume=0.10,adelay=800|800[chime1];" +
    "[3:a]volume=0.06,adelay=1250|1250[chime2];" +
    "[pad][chime1][chime2]amix=inputs=3:duration=first:dropout_transition=0," +
    "afade=t=in:st=0:d=0.4,afade=t=out:st=" + fadeOut.toFixed(1) + ":d=1.2[a]";
  const args = [
    "-y",
    "-framerate", String(FPS), "-start_number", "0", "-i", join(frameDir, "%04d.jpg"),
  ];
  if (WITH_AUDIO) {
    args.push(
      "-f", "lavfi", "-t", String(DURATION), "-i",
      "aevalsrc=0.035*sin(2*PI*55*t)+0.015*sin(2*PI*82.5*t):s=48000:d=" + DURATION,
      "-f", "lavfi", "-t", "1", "-i", "sine=frequency=880:duration=0.35:sample_rate=48000",
      "-f", "lavfi", "-t", "1", "-i", "sine=frequency=1320:duration=0.25:sample_rate=48000",
      "-filter_complex", filter,
      "-map", "0:v", "-map", "[a]",
    );
  } else {
    if (OUT_SCALE) args.push("-vf", "scale=" + OUT_SCALE);
    args.push("-map", "0:v", "-an");
  }
  args.push(
    "-t", String(DURATION),
    "-r", String(FPS),
    "-c:v", "libx264", "-preset", "medium", "-crf", CRF,
    "-pix_fmt", "yuv420p",
  );
  if (WITH_AUDIO) args.push("-c:a", "aac", "-b:a", "128k");
  args.push("-movflags", "+faststart", output);
  await execFileAsync(FFMPEG, args, {
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
  if (!existsSyncSafe(FFMPEG)) throw new Error(`找不到 ffmpeg：${FFMPEG}`);
  if (!existsSyncSafe(FFPROBE)) throw new Error(`找不到 ffprobe：${FFPROBE}`);
  if (!existsSyncSafe(FONT)) throw new Error(`找不到字体：${FONT}`);
  const chromePath = await findChrome();
  const only = process.argv[2] ?? null;
  const entries = (await readdir(THEMES_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
  const order = ["si", "zhuang-fangyi", "goldenglow", "shu"];
  entries.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));

  const chrome = await startChrome(chromePath);
  let themeIndex = 0;
  try {
    for (const id of entries) {
      if (only && id !== only) continue;
      const themeDir = join(THEMES_DIR, id);
      const manifestPath = join(themeDir, "theme.json");
      const artPath = join(themeDir, "art", "source.png");
      if (!existsSyncSafe(manifestPath) || !existsSyncSafe(artPath)) {
        console.log(`[skip] ${id}: 缺少 theme.json 或 art/source.png`);
        continue;
      }
      themeIndex += 1;
      const theme = JSON.parse(await readFile(manifestPath, "utf8"));
      const orderIndex = order.indexOf(id) + 1;
      theme.index = orderIndex > 0 ? orderIndex : themeIndex;
      const artBuffer = await readFile(artPath);
      const html = buildMotionHtml(theme, `data:image/png;base64,${artBuffer.toString("base64")}`);
      const htmlPath = join(themeDir, "art", "motion.html");
      await writeFile(htmlPath, html, "utf8");
      console.log(`[render] ${id} motion`);
      await chrome.session.send("Page.navigate", { url: pathToFileURL(htmlPath).href });
      await waitForReady(chrome.session);
      const frameDir = join(themeDir, "art", "motion-frames");
      await captureFrames(chrome.session, theme, frameDir);
      const output = join(themeDir, OUT_NAME);
      await encodeVideo(theme, frameDir, output);
      await rm(frameDir, { recursive: true, force: true });
    }
  } finally {
    try { chrome.session.close(); } catch {}
    try {
      await execFileAsync("taskkill", ["/PID", String(chrome.child.pid), "/T", "/F"], {
        timeout: 15000,
        windowsHide: true,
      });
    } catch {}
    await rm(chrome.profile, { recursive: true, force: true }).catch(() => {});
  }
}

function existsSyncSafe(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
