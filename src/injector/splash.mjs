import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";

import { CdpSession, waitForPageTargets } from "./cdp.mjs";
import { defaultStore } from "./theme-store.mjs";

// In-app splash videos are transferred as base64 chunks through CDP, then
// rebuilt into a Blob in the renderer. 64MB keeps startup latency reasonable
// while covering normal 10-30s 1080p clips; full-size videos can still use
// TerraBoot --external.
const MAX_VIDEO_BYTES = 64 * 1024 * 1024;
const CHUNK_CHARS = 512 * 1024;
const MAX_HERO_BYTES = 8 * 1024 * 1024;
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

async function fileInfo(path) {
  try {
    const info = await stat(path);
    return info.isFile() ? info : null;
  } catch {
    return null;
  }
}

async function heroDataUrl(theme) {
  const path = theme.assets?.hero;
  if (!path) return null;
  const info = await fileInfo(path);
  if (!info || info.size > MAX_HERO_BYTES) return null;
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime) return null;
  return `data:${mime};base64,${(await readFile(path)).toString("base64")}`;
}

async function transferVideo(session, video) {
  const base64 = (await readFile(video.path)).toString("base64");
  await session.evaluate(
    `window.__terraSplashVideoSize=${video.size};window.__terraSplashChunks=[];true`,
    { timeoutMs: 10000 },
  );
  for (let offset = 0; offset < base64.length; offset += CHUNK_CHARS) {
    const chunk = base64.slice(offset, offset + CHUNK_CHARS);
    await session.evaluate(
      `window.__terraSplashChunks.push(${JSON.stringify(chunk)});true`,
      { timeoutMs: 15000 },
    );
  }
  const built = await session.evaluate(`(() => {
    const chunks = window.__terraSplashChunks || [];
    const total = Number(window.__terraSplashVideoSize) || 0;
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      const binary = atob(chunk);
      for (let i = 0; i < binary.length && offset < total; i += 1) {
        bytes[offset] = binary.charCodeAt(i);
        offset += 1;
      }
    }
    window.__terraSplashChunks = [];
    if (total <= 0 || offset !== total) return { ok: false, offset, total };
    window.__terraSplashBlobUrl = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
    return { ok: true, total };
  })()`, { timeoutMs: 60000 });
  if (!built || built.ok !== true) {
    throw new Error(`启动视频分块写入失败（${built?.offset ?? 0}/${built?.total ?? video.size}）`);
  }
}

export async function showSplash({ themeId, port = 9341, timeoutMs = 30000 } = {}) {
  const theme = await defaultStore.getTheme(themeId);
  let videoPath = join(theme.dir, "splash.mp4");
  let info = await fileInfo(videoPath);
  if (!info) {
    videoPath = join(theme.dir, "boot.mp4");
    info = await fileInfo(videoPath);
  }
  const video = info && info.size <= MAX_VIDEO_BYTES ? { path: videoPath, size: info.size } : null;
  const hero = await heroDataUrl(theme);
  if (!video && !hero) throw new Error("主题没有可用的启动动画或背景图");
  const state = await defaultStore.readState();
  const waitForSkin = state.skinEnabled !== false;

  const targets = await waitForPageTargets(port, { timeoutMs });
  const target = targets[0];
  const session = new CdpSession(target.webSocketDebuggerUrl, { expectedPort: port });
  await session.open();
  try {
    await session.send("Page.enable");
    await session.send("Runtime.enable");
    try { await session.send("Page.bringToFront", {}, { timeoutMs: 3000 }); } catch {}
    try { await session.send("Emulation.setFocusEmulationEnabled", { enabled: true }, { timeoutMs: 3000 }); } catch {}
    try { await session.send("Page.setWebLifecycleState", { state: "active" }, { timeoutMs: 3000 }); } catch {}
    try { await session.send("Page.setBypassCSP", { enabled: true }, { timeoutMs: 3000 }); } catch {}

    let hasVideo = Boolean(video);
    if (video) {
      try {
        await transferVideo(session, video);
      } catch (error) {
        hasVideo = false;
        await session.evaluate(
          "window.__terraSplashChunks=[];window.__terraSplashBlobUrl=null;true",
          { timeoutMs: 5000 },
        ).catch(() => {});
      }
    }

    const payload = {
      name: theme.name,
      subtitle: theme.subtitle || "",
      brand: theme.copy?.brand || "TERRA TERMINAL",
      tagline: theme.copy?.tagline || "",
      accent: theme.colors?.accent || "#F2C94C",
      text: theme.colors?.text || "#EAF2F6",
      surface: theme.colors?.surface || "#0A0F14",
      hero,
      hasVideo,
      waitForSkin,
    };
    const source = `(() => {
      const P = ${JSON.stringify(payload)};
      const previous = document.getElementById('terra-splash');
      if (previous) previous.remove();
      const previousStyle = document.getElementById('terra-splash-style');
      if (previousStyle) previousStyle.remove();

      const style = document.createElement('style');
      style.id = 'terra-splash-style';
      style.textContent =
        '#terra-switcher-host{visibility:hidden !important;}' +
        '#terra-splash{position:fixed;inset:0;z-index:2147483647;overflow:hidden;background:' + P.surface + ';' +
        'font-family:Bahnschrift,"Microsoft YaHei UI",Consolas,sans-serif;clip-path:inset(0 0 0 0);' +
        'transition:clip-path .8s cubic-bezier(.7,0,.2,1),opacity .8s ease;}' +
        '#terra-splash .terra-splash-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#05080b;}' +
        '#terra-splash .terra-splash-fallback{position:absolute;inset:0;background-position:center;background-size:cover;' +
        'animation:terraSplashZoom 6s ease-out both;}' +
        '#terra-splash .terra-splash-shade{position:absolute;inset:0;background:' +
        'linear-gradient(90deg,color-mix(in srgb,' + P.surface + ' 92%,transparent) 0%,transparent 62%),' +
        'linear-gradient(0deg,color-mix(in srgb,' + P.surface + ' 96%,transparent) 0%,transparent 44%);}' +
        '#terra-splash .terra-splash-copy{position:absolute;left:6%;bottom:12%;z-index:2;max-width:70%;}' +
        '#terra-splash .terra-splash-brand{color:' + P.accent + ';font:700 13px/1 Consolas,monospace;letter-spacing:4px;}' +
        '#terra-splash .terra-splash-name{margin-top:12px;color:' + P.text + ';font:800 clamp(34px,6vw,86px)/1 Bahnschrift,"Microsoft YaHei UI",sans-serif;letter-spacing:2px;}' +
        '#terra-splash .terra-splash-tag{margin-top:12px;color:color-mix(in srgb,' + P.text + ' 70%,transparent);font:600 14px/1.5 Consolas,monospace;letter-spacing:2px;}' +
        '#terra-splash .terra-splash-skip{position:absolute;right:18px;top:18px;z-index:3;padding:8px 12px;' +
        'background:rgba(5,8,11,.72);border:1px solid color-mix(in srgb,' + P.accent + ' 55%,transparent);' +
        'color:' + P.text + ';font:700 11px Consolas,monospace;letter-spacing:1px;cursor:pointer;}' +
        '#terra-splash .terra-splash-progress{position:absolute;left:0;bottom:0;height:3px;width:0;z-index:3;background:' + P.accent + ';}' +
        '@keyframes terraSplashZoom{from{transform:scale(1.02)}to{transform:scale(1.08)}}';
      (document.head || document.documentElement).appendChild(style);

      const overlay = document.createElement('div');
      overlay.id = 'terra-splash';
      const addFallback = () => {
        if (overlay.querySelector('.terra-splash-fallback')) return;
        const fallback = document.createElement('div');
        fallback.className = 'terra-splash-fallback';
        fallback.style.backgroundImage = 'url("' + (P.hero || '') + '")';
        overlay.appendChild(fallback);
        const shade = document.createElement('div');
        shade.className = 'terra-splash-shade';
        overlay.appendChild(shade);
        const copy = document.createElement('div');
        copy.className = 'terra-splash-copy';
        const brand = document.createElement('div'); brand.className = 'terra-splash-brand'; brand.textContent = P.brand;
        const name = document.createElement('div'); name.className = 'terra-splash-name'; name.textContent = P.name;
        const tag = document.createElement('div'); tag.className = 'terra-splash-tag'; tag.textContent = P.tagline || P.subtitle;
        copy.appendChild(brand); copy.appendChild(name); copy.appendChild(tag);
        overlay.appendChild(copy);
      };
      let objectUrl = null;
      let video = null;
      if (P.hasVideo) {
        objectUrl = window.__terraSplashBlobUrl || null;
        try { window.__terraSplashBlobUrl = null; } catch {}
        if (objectUrl) {
          video = document.createElement('video');
          video.className = 'terra-splash-video';
          video.src = objectUrl;
          video.muted = true;
          video.autoplay = true;
          video.playsInline = true;
          video.preload = 'auto';
          overlay.appendChild(video);
        }
      }
      if (!video) addFallback();

      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'terra-splash-skip';
      skip.textContent = 'ESC 跳过';
      overlay.appendChild(skip);

      const progress = document.createElement('div');
      progress.className = 'terra-splash-progress';
      overlay.appendChild(progress);
      document.documentElement.appendChild(overlay);

      let finished = false;
      let heartbeat = null;
      let safety = null;
      let waitingForSkin = false;
      const skinReady = () => {
        if (!P.waitForSkin) return true;
        try {
          return document.documentElement.getAttribute('data-terra-skin') === '1';
        } catch {
          return true;
        }
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        if (heartbeat) clearInterval(heartbeat);
        if (safety) clearTimeout(safety);
        overlay.style.clipPath = 'inset(0 0 0 100%)';
        overlay.style.opacity = '0.96';
        setTimeout(() => {
          try {
            if (video) {
              video.pause();
              video.removeAttribute('src');
              video.load();
            }
          } catch {}
          try { if (objectUrl) URL.revokeObjectURL(objectUrl); } catch {}
          overlay.remove();
          style.remove();
        }, 900);
      };
      const requestFinish = () => {
        if (finished) return;
        if (skinReady()) {
          finish();
          return;
        }
        if (waitingForSkin) return;
        waitingForSkin = true;
        const started = Date.now();
        const wait = setInterval(() => {
          if (finished) {
            clearInterval(wait);
            return;
          }
          if (skinReady() || Date.now() - started > 20000) {
            clearInterval(wait);
            waitingForSkin = false;
            finish();
          }
        }, 250);
      };
      const skipNow = () => {
        try { if (video) video.pause(); } catch {}
        requestFinish();
      };
      skip.addEventListener('click', skipNow);
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') skipNow();
      }, { once: true });

      if (video) {
        const updateProgress = () => {
          if (!video.duration) return;
          const percent = Math.max(0, Math.min(100, video.currentTime / video.duration * 100));
          progress.style.width = percent + '%';
        };
        const resume = () => {
          if (finished || !video.paused) return;
          const playing = video.play();
          if (playing && playing.catch) playing.catch(() => {});
        };
        video.addEventListener('ended', requestFinish, { once: true });
        video.addEventListener('error', () => {
          if (heartbeat) clearInterval(heartbeat);
          if (safety) clearTimeout(safety);
          try { video.style.display = 'none'; } catch {}
          addFallback();
          safety = setTimeout(requestFinish, 2600);
        }, { once: true });
        video.addEventListener('timeupdate', updateProgress);
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) resume();
        });
        let metadataLoaded = false;
        safety = setTimeout(() => {
          if (!metadataLoaded) finish();
        }, 60000);
        video.addEventListener('loadedmetadata', () => {
          metadataLoaded = true;
          if (safety) clearTimeout(safety);
          // No duration cap: allow the full video plus the 20s skin-ready hold.
          const limit = Math.max(60000, video.duration * 1000 + 30000);
          safety = setTimeout(finish, limit);
        }, { once: true });
        heartbeat = setInterval(() => {
          if (finished) return;
          updateProgress();
          if (video.duration && video.currentTime >= video.duration - 0.35) {
            requestFinish();
            return;
          }
          resume();
        }, 300);
        const playing = video.play();
        if (playing && playing.catch) playing.catch(() => {});
      } else {
        progress.style.transition = 'width 3800ms linear';
        progress.style.width = '100%';
        safety = setTimeout(requestFinish, 3800);
      }
      return { ok: true, hasVideo: P.hasVideo, waitForSkin: P.waitForSkin };
    })()`;
    const result = await session.evaluate(source, { timeoutMs: 20000 });
    return { theme: theme.id, video: hasVideo, hero: Boolean(hero), waitForSkin, result };
  } finally {
    session.close();
  }
}
