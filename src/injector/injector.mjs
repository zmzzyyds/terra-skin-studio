import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";

import {
  buildCleanupSource,
  buildInjectionSource,
  buildSkinCss,
} from "./skin-css.mjs";

const MIME = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const MAX_HERO_BYTES = 8 * 1024 * 1024;

export async function loadHeroDataUrl(theme, appearance = "dark") {
  let heroPath = theme.assets?.hero;
  if (appearance === "paper" && theme.dir) {
    const paperPath = join(theme.dir, "hero-paper.jpg");
    try {
      const paperInfo = await stat(paperPath);
      if (paperInfo.isFile()) heroPath = paperPath;
    } catch {}
  }
  if (!heroPath) return null;
  const info = await stat(heroPath);
  if (!info.isFile()) return null;
  if (info.size > MAX_HERO_BYTES) {
    throw new Error(
      `主题背景图 ${heroPath} 超过 8MB；请先用面板重新导入（面板会自动压缩到 1920×1080）。`,
    );
  }
  const ext = extname(heroPath).toLowerCase();
  const mime = MIME.get(ext);
  if (!mime) throw new Error(`不支持的背景图类型：${ext}`);
  const buffer = await readFile(heroPath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export async function ensureBindings(session, handler) {
  session._terraBindingHandler = handler;
  if (session._terraBindingsReady) return;
  session.on("Runtime.bindingCalled", (params) => {
    if (!params || typeof params.name !== "string") return;
    if (params.name !== "__terraSwitch" && params.name !== "__terraRestore") return;
    const callback = session._terraBindingHandler;
    if (typeof callback !== "function") return;
    Promise.resolve(callback(params.name, params.payload ?? ""))
      .catch(() => {});
  });
  for (const name of ["__terraSwitch", "__terraRestore"]) {
    try {
      await session.send("Runtime.addBinding", { name }, { timeoutMs: 5000 });
    } catch (error) {
      const text = String(error?.message ?? "");
      if (!/already|exists|duplicate/i.test(text)) throw error;
    }
  }
  session._terraBindingsReady = true;
}

export async function inspectPage(session) {
  return session.evaluate(`(() => ({
    title: document.title,
    href: location.href,
    hasRoot: Boolean(document.getElementById('root')),
    hasBody: Boolean(document.body),
    appReady: Boolean(document.querySelector('main[data-app-shell-main-surface]'))
      && Boolean(document.querySelector('aside.app-shell-left-panel')),
    hasSkin: Boolean(document.getElementById('terra-skin')),
    theme: window.__terraTheme || null
  }))()`);
}

export async function waitForAppReady(session, { timeoutMs = 20000, pollMs = 400 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await inspectPage(session);
      if (last.appReady) return last;
    } catch {
      // The renderer may be navigating; keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return last;
}

function wrapForNewDocument(source) {
  return `(() => {
    const run = () => {
      try { ${source} } catch (error) {
        try { console.warn("[terra] new-document injection failed", error); } catch {}
      }
    };
    if (document.body) run();
    else document.addEventListener("DOMContentLoaded", run, { once: true });
  })();`;
}

export async function applyTheme(session, {
  theme,
  themes,
  activeId,
  opacity = 0.88,
  clarity = 0.6,
  readability = "auto",
  appearance = "dark",
  hidden = false,
  addDocumentScript = true,
} = {}) {
  if (!theme) throw new Error("缺少主题对象");
  const heroDataUrl = await loadHeroDataUrl(theme, appearance);
  const css = buildSkinCss({ theme, heroDataUrl, opacity, clarity, readability, appearance });
  const source = buildInjectionSource({
    css,
    themes,
    activeId: activeId ?? theme.id,
    accent: theme.colors?.accent ?? "#F2C94C",
    decor: theme.decor ?? "custom",
    appearance,
    hidden,
  });

  try {
    await session.send("Page.enable", {}, { timeoutMs: 5000 });
  } catch {}
  await session.send("Runtime.enable", {}, { timeoutMs: 5000 });

  const result = await session.evaluate(source, { timeoutMs: 15000 });
  if (!result || result.ok !== true) {
    throw new Error(`注入没有完成：${result?.reason ?? "unknown"}`);
  }

  if (addDocumentScript) {
    try {
      if (session._terraNewDocumentScriptId) {
        await session.send("Page.removeScriptToEvaluateOnNewDocument", {
          identifier: session._terraNewDocumentScriptId,
        }, { timeoutMs: 5000 }).catch(() => {});
        session._terraNewDocumentScriptId = null;
      }
      const added = await session.send("Page.addScriptToEvaluateOnNewDocument", {
        source: wrapForNewDocument(source),
      }, { timeoutMs: 5000 });
      session._terraNewDocumentScriptId = added.identifier ?? null;
    } catch {
      // The immediate injection is the important part; the controller repairs on reload.
    }
  }

  return { cssLength: css.length, sourceLength: source.length, theme: theme.id };
}

export async function restoreTheme(session) {
  try {
    await session.send("Runtime.enable", {}, { timeoutMs: 5000 });
  } catch {}
  await session.evaluate(buildCleanupSource(), { timeoutMs: 5000 });
  if (session._terraNewDocumentScriptId) {
    try {
      await session.send("Page.removeScriptToEvaluateOnNewDocument", {
        identifier: session._terraNewDocumentScriptId,
      }, { timeoutMs: 5000 });
    } catch {}
    session._terraNewDocumentScriptId = null;
  }
}

export async function captureScreenshot(session, filePath) {
  return session.captureScreenshot(filePath);
}
