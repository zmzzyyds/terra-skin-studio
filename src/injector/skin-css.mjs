import { HEX_COLOR_RE } from "./constants.mjs";

function color(value, fallback) {
  if (typeof value !== "string" || !HEX_COLOR_RE.test(value)) return fallback;
  return value.toUpperCase();
}

function cssString(value) {
  return JSON.stringify(String(value ?? ""));
}

function pct(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return `${Math.round(Math.min(1, Math.max(0, number)) * 100)}%`;
}

export function buildSkinCss({ theme, heroDataUrl, opacity = 0.88, clarity = 0.6, readability = "auto", appearance = "dark" }) {
  const paper = appearance === "paper";
  const accent = color(theme.colors?.accent, "#F2C94C");
  const secondary = color(theme.colors?.secondary, "#7FE7FF");
  const surface = paper ? "#EDEAE2" : color(theme.colors?.surface, "#0A0F14");
  const text = paper ? "#121518" : color(theme.colors?.text, "#EAF2F6");
  const mode = paper ? "light" : theme.colors?.mode === "light" ? "light" : "dark";
  const clarityFactor = 1 - 0.6 * Math.min(1, Math.max(0, Number(clarity) || 0));
  const scaleClarity = (value) => Math.max(0, Math.round(value * clarityFactor));
  const TERTIARY_BY_THEME = {
    si: "#FF6B35",
    "zhuang-fangyi": "#FF5A5F",
    goldenglow: "#FFD166",
    shu: "#E07A5F",
  };
  const tertiary = color(theme.colors?.tertiary, TERTIARY_BY_THEME[theme.id] || accent);
  const focus = theme.background?.focus ?? { x: 50, y: 50 };
  const tint = paper ? "#E9E5DA" : color(theme.background?.tint, surface);
  const rootLeftStrong = scaleClarity(paper ? 58 : 76);
  const rootLeftFade = scaleClarity(paper ? 12 : 20);
  const rootBottomMid = scaleClarity(paper ? 30 : 46);
  const rootBottomStrong = scaleClarity(paper ? 68 : 86);
  const rootVignette = scaleClarity(paper ? 36 : 56);
  const mainTop = scaleClarity(paper ? 12 : 24);
  const mainMid = scaleClarity(paper ? 34 : 50);
  const mainBottom = scaleClarity(paper ? 72 : 86);
  const mainRadial = scaleClarity(paper ? 12 : 20);
  const mainRadialEdge = scaleClarity(paper ? 40 : 58);
  const rawTintOpacity = paper
    ? 0.08
    : Number.isFinite(theme.background?.tintOpacity)
      ? Math.min(1, Math.max(0, theme.background.tintOpacity))
      : 0.3;
  const tintOpacity = rawTintOpacity * clarityFactor;
  const surfaceOpacity = pct(opacity, "88%");
  const sidebarOpacity = pct(Math.min(1, opacity + 0.05), "93%");
  const panelOpacity = pct(Math.min(1, opacity + 0.08), "96%");
  const imageLayer = heroDataUrl
    ? `url(${cssString(heroDataUrl)}) center center / cover no-repeat`
    : `linear-gradient(135deg, ${surface} 0%, #05080B 55%, ${accent}22 100%)`;
  const readabilityOn = readability === "on";
  const readabilityBg = readabilityOn
    ? `color-mix(in srgb, ${surface} 82%, transparent)`
    : "transparent";

  return `/* TERRA TERMINAL SKIN:${theme.id} */
:root {
  color-scheme: ${mode} !important;
  --terra-accent: ${accent};
  --terra-secondary: ${secondary};
  --terra-tertiary: ${tertiary};
  --terra-surface: ${surface};
  --terra-panel: color-mix(in srgb, ${surface} 82%, ${accent} 8%);
  --terra-panel-alt: color-mix(in srgb, ${surface} 86%, ${secondary} 6%);
  --terra-text: ${text};
  --terra-surface-opacity: ${surfaceOpacity};
  --terra-sidebar-opacity: ${sidebarOpacity};
  --terra-panel-opacity: ${panelOpacity};
  --terra-accent-soft: color-mix(in srgb, ${accent} 22%, transparent);
  --terra-accent-line: color-mix(in srgb, ${accent} 48%, transparent);
  --terra-text-muted: color-mix(in srgb, ${text} 68%, transparent);
  --terra-text-dim: color-mix(in srgb, ${text} 46%, transparent);

  --color-token-main-surface-primary: color-mix(in srgb, ${surface} var(--terra-surface-opacity), transparent) !important;
  --color-background-panel: color-mix(in srgb, ${surface} var(--terra-panel-opacity), transparent) !important;
  --color-background-composer-surface: color-mix(in srgb, ${surface} var(--terra-panel-opacity), transparent) !important;
  --color-background-composer-action-bar: color-mix(in srgb, ${surface} 88%, transparent) !important;
  --color-token-bg-primary: color-mix(in srgb, ${surface} 84%, ${text} 4%) !important;
  --color-token-bg-secondary: color-mix(in srgb, ${surface} 76%, transparent) !important;
  --color-token-bg-tertiary: color-mix(in srgb, ${surface} 68%, transparent) !important;
  --color-background-primary-surface: color-mix(in srgb, ${surface} 72%, transparent) !important;
  --color-surface-tertiary: color-mix(in srgb, ${surface} var(--terra-panel-opacity), transparent) !important;

  --color-text-primary: ${text} !important;
  --color-text-primary-ghost: ${text} !important;
  --color-text-primary-ghost-hover: ${text} !important;
  --color-text-primary-outline: ${text} !important;
  --color-text-primary-outline-hover: ${text} !important;
  --color-text-primary-soft: ${text} !important;
  --color-text-primary-soft-alt: ${text} !important;
  --color-text-primary-surface: ${text} !important;
  --color-token-text-primary: ${text} !important;
  --color-text-secondary: var(--terra-text-muted) !important;
  --color-text-secondary-ghost: var(--terra-text-dim) !important;
  --color-text-secondary-ghost-hover: ${text} !important;
  --color-text-secondary-outline: var(--terra-text-muted) !important;
  --color-text-secondary-outline-hover: ${text} !important;
  --color-text-secondary-soft: var(--terra-text-muted) !important;
  --color-text-secondary-soft-alt: var(--terra-text-muted) !important;
  --color-text-secondary-solid: var(--terra-text-muted) !important;
  --color-token-text-secondary: var(--terra-text-muted) !important;
  --color-token-text-tertiary: var(--terra-text-dim) !important;
  --color-token-text-link-foreground: ${accent} !important;
  --color-border-primary-outline: var(--terra-accent-line) !important;
  --color-border-primary-outline-hover: ${accent} !important;
  --color-border-primary-surface: var(--terra-accent-soft) !important;
  --color-border-primary-soft-alt: var(--terra-accent-soft) !important;
  --color-token-input-border: color-mix(in srgb, ${accent} 34%, transparent) !important;
}

html, body {
  background: transparent !important;
}

#root {
  color: ${text} !important;
  background:
    radial-gradient(circle at 22% 18%,
      color-mix(in srgb, ${accent} 16%, transparent) 0%, transparent 40%),
    radial-gradient(circle at 82% 74%,
      color-mix(in srgb, ${secondary} 12%, transparent) 0%, transparent 46%),
    radial-gradient(circle at 58% 32%,
      color-mix(in srgb, ${tertiary} 8%, transparent) 0%, transparent 36%),
    linear-gradient(90deg,
      color-mix(in srgb, ${surface} ${rootLeftStrong}%, transparent) 0%,
      color-mix(in srgb, ${surface} ${rootLeftFade}%, transparent) 16%,
      transparent 30%),
    linear-gradient(180deg,
      transparent 0% 42%,
      color-mix(in srgb, ${surface} ${rootBottomMid}%, transparent) 72%,
      color-mix(in srgb, ${surface} ${rootBottomStrong}%, transparent) 100%),
    radial-gradient(ellipse at 50% 40%,
      transparent 30%,
      color-mix(in srgb, ${surface} ${rootVignette}%, transparent) 100%),
    linear-gradient(color-mix(in srgb, ${tint} ${pct(tintOpacity, "30%")}, transparent),
      color-mix(in srgb, ${tint} ${pct(tintOpacity, "30%")}, transparent)),
    ${imageLayer} !important;
  background-attachment: fixed !important;
}

main[data-app-shell-main-surface="default"],
main[data-app-shell-main-surface],
main[class*="_MainContentSurface_"] {
  background:
    radial-gradient(ellipse at 55% 34%,
      transparent 0%,
      color-mix(in srgb, ${surface} ${mainRadial}%, transparent) 55%,
      color-mix(in srgb, ${surface} ${mainRadialEdge}%, transparent) 100%),
    linear-gradient(180deg,
      color-mix(in srgb, ${surface} ${mainTop}%, transparent) 0%,
      color-mix(in srgb, ${surface} ${mainMid}%, ${tertiary} 5%) 48%,
      color-mix(in srgb, ${surface} ${mainBottom}%, transparent) 100%) !important;
  color: ${text} !important;
}

._PageSurface_etoz9_2,
._Workspace_etoz9_2,
._MainContentClip_etoz9_2,
._ApplicationMenuTopBar_etoz9_2 {
  background: transparent !important;
}

[class*="_ApplicationMenuTopBar_"] {
  background: linear-gradient(180deg,
    color-mix(in srgb, ${surface} 58%, transparent),
    transparent) !important;
  border-bottom: 1px solid color-mix(in srgb, ${accent} 20%, transparent) !important;
}

aside.app-shell-left-panel {
  background:
    linear-gradient(180deg,
      color-mix(in srgb, ${surface} calc(var(--terra-sidebar-opacity) - 10%), ${accent} 7%) 0%,
      color-mix(in srgb, ${surface} calc(var(--terra-panel-opacity) - 10%), ${secondary} 4%) 100%) !important;
  border-right: 1px solid color-mix(in srgb, ${accent} 50%, transparent) !important;
  box-shadow:
    inset 0 2px 0 color-mix(in srgb, ${accent} 45%, transparent),
    10px 0 30px -26px color-mix(in srgb, ${accent} 55%, transparent) !important;
  color: ${text} !important;
}

aside.app-shell-left-panel > div,
aside.app-shell-left-panel > div > div,
aside.app-shell-left-panel div.relative.flex.min-h-0.min-w-0.flex-1 {
  background-color: transparent !important;
}

aside.app-shell-left-panel * {
  color: inherit;
}

/* The app mixes hard-coded Tailwind text colors with design tokens. For a dark
 * skin, force readable text inside the main surfaces and restore semantic
 * colors afterwards. */
main[data-app-shell-main-surface] *,
aside.app-shell-left-panel *,
[class*="_Composer"] *,
[class*="_ApplicationMenuTopBar_"] *,
header * {
  color: var(--terra-text) !important;
}

a,
[class*="text-link"],
[class*="text-accent"] {
  color: var(--terra-accent) !important;
}

[class*="text-danger"],
[class*="text-error"],
[data-tone="danger"] {
  color: #FF8583 !important;
}

[class*="text-success"] {
  color: #7BE0A3 !important;
}

[class*="text-caution"],
[class*="text-warning"] {
  color: #FFC300 !important;
}

[role="menu"],
[role="listbox"],
[role="dialog"],
[data-radix-popper-content-wrapper] > div {
  background: color-mix(in srgb, ${surface} 96%, transparent) !important;
  color: var(--terra-text) !important;
  border-color: var(--terra-accent-line) !important;
}

${paper ? `
main[data-app-shell-main-surface] h1,
main[data-app-shell-main-surface] [class*="heading"],
main[data-app-shell-main-surface] [data-response-annotation-conversation] {
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.55);
}
main[data-app-shell-main-surface] .heading-xl,
main[data-app-shell-main-surface] [class*="heading-xl"] {
  background: color-mix(in srgb, #F5F2EA 72%, transparent);
  border-radius: 10px;
  padding: 4px 10px;
  box-shadow: 0 4px 18px rgba(255, 255, 255, 0.35);
}
` : ""}

[role="menu"] *,
[role="listbox"] *,
[role="dialog"] * {
  color: var(--terra-text) !important;
}

[class*="_ComposerLayoutBody_"],
[class*="_ComposerLayoutRoot_"] > div {
  background: linear-gradient(135deg,
    color-mix(in srgb, ${surface} calc(var(--terra-panel-opacity) - 12%), ${accent} 9%),
    color-mix(in srgb, ${surface} calc(var(--terra-panel-opacity) - 12%), ${secondary} 6%)) !important;
  border: 1px solid color-mix(in srgb, ${accent} 62%, transparent) !important;
  border-radius: 16px !important;
  box-shadow:
    0 0 0 1px color-mix(in srgb, ${accent} 16%, transparent),
    0 16px 38px color-mix(in srgb, #000 55%, transparent),
    0 0 28px color-mix(in srgb, ${accent} 12%, transparent) !important;
}

aside.app-shell-left-panel [aria-selected="true"],
aside.app-shell-left-panel [data-selected="true"],
aside.app-shell-left-panel [data-state="active"] {
  background: linear-gradient(90deg,
    color-mix(in srgb, ${accent} 28%, transparent),
    color-mix(in srgb, ${tertiary} 12%, transparent)) !important;
  box-shadow:
    inset 2px 0 0 ${accent},
    0 0 18px color-mix(in srgb, ${accent} 10%, transparent) !important;
  border-radius: 7px !important;
}

aside.app-shell-left-panel [class*="hover:bg-primary-ghost-hover"]:hover {
  background: color-mix(in srgb, ${accent} 12%, transparent) !important;
}

[class*="_ComposerFooter_"],
[class*="_item_1hrlq_"] {
  background: linear-gradient(90deg,
    color-mix(in srgb, ${surface} calc(var(--terra-sidebar-opacity) - 8%), ${accent} 4%),
    color-mix(in srgb, ${surface} calc(var(--terra-panel-opacity) - 8%), ${secondary} 3%)) !important;
  border-color: var(--terra-accent-soft) !important;
}

[class*="_ComposerLayoutBody_"] .ProseMirror,
[class*="_ComposerLayoutBody_"] [contenteditable="true"] {
  color: ${text} !important;
  caret-color: ${accent} !important;
}

[data-user-message-bubble],
[data-codex-approval-surface],
[data-response-annotation-conversation] {
  background: color-mix(in srgb, ${surface} ${readabilityOn ? "84%" : "58%"}, transparent) !important;
  border-color: var(--terra-accent-soft) !important;
  color: ${text} !important;
}

[data-response-annotation-conversation] {
  background: ${readabilityBg} !important;
}

[data-app-action-sidebar-thread-active="true"] {
  background: linear-gradient(90deg,
    color-mix(in srgb, ${accent} 18%, transparent),
    color-mix(in srgb, ${secondary} 10%, transparent)) !important;
}

pre, code, .markdown pre, [class*="code-block"] {
  color: ${text} !important;
  background-color: color-mix(in srgb, ${surface} 86%, #000 10%) !important;
  border-color: var(--terra-accent-soft) !important;
}

button.bg-token-bg-fog,
[data-pip-obstacle="thread-summary-panel"] button,
[data-pip-obstacle="thread-summary-panel"] .text-fade-truncate {
  color: color-mix(in srgb, ${text} 92%, transparent) !important;
}

::selection {
  background: color-mix(in srgb, ${accent} 42%, transparent);
  color: ${text};
}

::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, ${accent} 30%, transparent) !important;
}
::-webkit-scrollbar-track {
  background: transparent !important;
}

/* ---------- decorative overlay ---------- */

#terra-deco {
  position: fixed;
  inset: 0;
  z-index: 2147482000;
  pointer-events: none;
  overflow: hidden;
  opacity: 0.85;
  font-family: Bahnschrift, "Microsoft YaHei UI", Consolas, sans-serif;
  color: ${accent};
}

#terra-deco .terra-corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border-color: ${accent};
  border-style: solid;
  opacity: 0.55;
}
#terra-deco .terra-corner.tl { top: 10px; left: 10px; border-width: 2px 0 0 2px; }
#terra-deco .terra-corner.tr { top: 10px; right: 10px; border-width: 2px 2px 0 0; }
#terra-deco .terra-corner.bl { bottom: 10px; left: 10px; border-width: 0 0 2px 2px; }
#terra-deco .terra-corner.br { bottom: 10px; right: 10px; border-width: 0 2px 2px 0; }

#terra-deco .terra-planes {
  position: absolute;
  inset: -12%;
  opacity: 0.14;
  background:
    linear-gradient(114deg,
      transparent 0 24%,
      color-mix(in srgb, ${accent} 55%, transparent) 24% 26%,
      transparent 26% 55%,
      color-mix(in srgb, ${secondary} 38%, transparent) 55% 56.5%,
      transparent 56.5% 100%),
    linear-gradient(72deg,
      transparent 0 68%,
      color-mix(in srgb, ${tertiary} 26%, transparent) 68% 70%,
      transparent 70% 100%);
  transform: skewY(-5deg) scale(1.05);
  filter: blur(0.4px);
  mask-image: linear-gradient(90deg, transparent 0%, #000 22%, #000 100%);
}

#terra-deco .terra-horizon {
  position: absolute;
  left: 0;
  right: 0;
  top: 62%;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    color-mix(in srgb, ${accent} 60%, transparent) 45%,
    transparent 100%);
  opacity: 0.35;
}

#terra-deco .terra-arc {
  position: absolute;
  left: 50%;
  top: 54%;
  width: 74vmin;
  height: 74vmin;
  transform: translate(-50%, -50%) rotate(-8deg);
  border: 1px solid color-mix(in srgb, ${accent} 34%, transparent);
  border-radius: 50%;
  opacity: 0.18;
}

#terra-deco .terra-scanlines {
  position: absolute;
  inset: 0;
  opacity: 0.08;
  background: repeating-linear-gradient(0deg,
    rgba(0, 0, 0, 0.55) 0px,
    rgba(0, 0, 0, 0.55) 1px,
    transparent 1px,
    transparent 4px);
}

#terra-deco .terra-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 65% 35%, transparent 30%, rgba(0, 0, 0, 0.38) 100%);
}

#terra-deco .terra-rail {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  letter-spacing: 6px;
  font-size: 11px;
  opacity: 0.55;
  text-transform: uppercase;
}

#terra-deco .terra-barcode {
  position: absolute;
  left: 22px;
  bottom: 22px;
  width: 120px;
  height: 22px;
  opacity: 0.32;
  background: repeating-linear-gradient(90deg,
    ${accent} 0 2px, transparent 2px 4px,
    ${accent} 4px 7px, transparent 7px 11px);
}

#terra-deco .terra-stamp {
  position: absolute;
  right: 38px;
  bottom: 28px;
  width: 66px;
  height: 66px;
  border: 2px solid ${accent};
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 10px;
  letter-spacing: 2px;
  opacity: 0.3;
  transform: rotate(-12deg);
}

#terra-deco .terra-stripe {
  position: absolute;
  left: 0;
  right: 0;
  height: 7px;
  opacity: 0.18;
  background: repeating-linear-gradient(45deg,
    ${accent} 0 10px,
    transparent 10px 20px);
}
#terra-deco .terra-stripe.top { top: 0; }
#terra-deco .terra-stripe.bottom { bottom: 0; }

#terra-deco.terra-decor-rhodes .terra-stripe { opacity: 0.07; }
#terra-deco.terra-decor-rhodes .terra-planes { opacity: 0.1; }

#terra-deco.terra-decor-sui .terra-planes {
  opacity: 0.08;
  background:
    linear-gradient(118deg,
      transparent 0 34%,
      color-mix(in srgb, ${secondary} 34%, transparent) 34% 36%,
      transparent 36% 100%),
    radial-gradient(ellipse at 28% 76%, ${secondary}22 0%, transparent 52%);
}
#terra-deco.terra-decor-sui .terra-arc {
  border-color: color-mix(in srgb, ${secondary} 30%, transparent);
  opacity: 0.14;
}
#terra-deco.terra-decor-sui .terra-stamp {
  border-radius: 8px;
  border-color: ${secondary};
  color: ${secondary};
  font-family: "Microsoft YaHei UI", serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0;
  opacity: 0.26;
}

#terra-deco.terra-decor-goldenglow .terra-planes {
  opacity: 0.09;
  background-image:
    radial-gradient(circle at 18% 24%, ${accent}55 0 2px, transparent 3px),
    radial-gradient(circle at 72% 18%, ${secondary}44 0 2px, transparent 3px),
    radial-gradient(circle at 84% 66%, ${accent}33 0 3px, transparent 4px),
    radial-gradient(circle at 38% 78%, ${secondary}33 0 2px, transparent 3px);
  background-size: 220px 220px;
  transform: none;
  filter: none;
}
#terra-deco.terra-decor-goldenglow .terra-stripe { opacity: 0.06; }
#terra-deco.terra-decor-goldenglow .terra-vignette {
  background: radial-gradient(ellipse at 70% 30%, ${accent}18 0%, transparent 55%, rgba(0, 0, 0, 0.3) 100%);
}

#terra-deco.terra-paper .terra-vignette {
  background: radial-gradient(ellipse at 65% 35%, transparent 32%, rgba(233, 229, 218, 0.35) 100%);
}
#terra-deco.terra-paper .terra-rail {
  color: color-mix(in srgb, #121518 46%, transparent);
}
#terra-deco.terra-paper .terra-scanlines { opacity: 0.05; }
#terra-deco.terra-paper .terra-stripe { opacity: 0.12; }

@media (prefers-reduced-motion: reduce) {
  #terra-deco, #terra-deco * { animation: none !important; }
}`;
}

export function buildInjectionSource({ css, themes, activeId, accent, decor, appearance = "dark", hidden = false }) {
  const payload = {
    css,
    themes: themes.map((theme) => ({
      id: theme.id,
      name: theme.name,
      subtitle: theme.subtitle,
      accent: theme.colors?.accent ?? "#F2C94C",
      builtin: Boolean(theme.builtin),
    })),
    activeId,
    accent,
    decor,
    paper: appearance === "paper",
    hidden,
  };
  return `(() => {
  const P = ${JSON.stringify(payload)};
  const doc = document;
  const root = doc.documentElement;
  if (!root || !doc.body) return { ok: false, reason: "no-body" };

  let style = doc.getElementById("terra-skin");
  if (!style) {
    style = doc.createElement("style");
    style.id = "terra-skin";
    (doc.head || root).appendChild(style);
  }
  style.textContent = P.css;

  let deco = doc.getElementById("terra-deco");
  if (!deco) {
    deco = doc.createElement("div");
    deco.id = "terra-deco";
    doc.body.appendChild(deco);
  }
  deco.className = "terra-deco terra-decor-" + P.decor + (P.paper ? " terra-paper" : "");
  if (!deco.firstElementChild) {
    const names = ["tl", "tr", "bl", "br"];
    for (const name of names) {
      const corner = doc.createElement("i");
      corner.className = "terra-corner " + name;
      deco.appendChild(corner);
    }
    const planes = doc.createElement("i"); planes.className = "terra-planes"; deco.appendChild(planes);
    const horizon = doc.createElement("i"); horizon.className = "terra-horizon"; deco.appendChild(horizon);
    const arc = doc.createElement("i"); arc.className = "terra-arc"; deco.appendChild(arc);
    const scan = doc.createElement("i"); scan.className = "terra-scanlines"; deco.appendChild(scan);
    const vignette = doc.createElement("i"); vignette.className = "terra-vignette"; deco.appendChild(vignette);
    const top = doc.createElement("i"); top.className = "terra-stripe top"; deco.appendChild(top);
    const bottom = doc.createElement("i"); bottom.className = "terra-stripe bottom"; deco.appendChild(bottom);
    const barcode = doc.createElement("i"); barcode.className = "terra-barcode"; deco.appendChild(barcode);
    const rail = doc.createElement("span"); rail.className = "terra-rail"; rail.textContent = "TERRA // " + P.activeId.toUpperCase(); deco.appendChild(rail);
    const stamp = doc.createElement("span"); stamp.className = "terra-stamp"; stamp.textContent = "TERRA"; deco.appendChild(stamp);
  }
  const rail = deco.querySelector(".terra-rail");
  if (rail) rail.textContent = "TERRA // " + P.activeId.toUpperCase();

  let host = doc.getElementById("terra-switcher-host");
  if (!host) {
    host = doc.createElement("div");
    host.id = "terra-switcher-host";
    doc.body.appendChild(host);
    host.attachShadow({ mode: "open" });
  }
  const shadow = host.shadowRoot;
  if (!shadow) return { ok: false, reason: "no-shadow-root" };

  if (!window.__terraHotkeys) {
    window.__terraHotkeys = true;
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const current = doc.getElementById("terra-switcher-host");
        const currentPanel = current && current.shadowRoot ? current.shadowRoot.querySelector(".panel") : null;
        if (currentPanel) currentPanel.hidden = true;
      }
      if (event.ctrlKey && event.shiftKey && (event.key === "T" || event.key === "t")) {
        try { localStorage.removeItem("terra.switcher.hidden"); } catch {}
        try { window.__terraSwitch(window.__terraTheme || P.activeId); } catch {}
      }
    }, { passive: true });
  }

  const hiddenNow = P.hidden || (() => { try { return localStorage.getItem("terra.switcher.hidden") === "1"; } catch { return false; } })();
  shadow.replaceChildren();
  if (hiddenNow) {
    host.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;z-index:2147483647;";
    root.setAttribute("data-terra-skin", "1");
    root.setAttribute("data-terra-theme", P.activeId);
    return { ok: true, theme: P.activeId, hidden: true };
  }
  host.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:2147483647;font-family:Bahnschrift,'Microsoft YaHei UI',Consolas,sans-serif;";

  const styleEl = doc.createElement("style");
  styleEl.textContent = \`
    :host { all: initial; }
    .pill {
      display:flex; align-items:center; gap:8px; padding:7px 12px 7px 9px;
      background:linear-gradient(135deg,
        color-mix(in srgb, #070B0F 86%, \${P.accent} 10%),
        color-mix(in srgb, #070B0F 90%, \${P.accent} 5%));
      color:#EAF2F6; border:1px solid color-mix(in srgb, \${P.accent} 68%, transparent);
      border-radius:8px; cursor:pointer; user-select:none;
      font:700 11px/1 Bahnschrift,Consolas,monospace; letter-spacing:1.4px;
      box-shadow:0 10px 26px rgba(0,0,0,.42), 0 0 20px color-mix(in srgb, \${P.accent} 18%, transparent);
      opacity:.72;
      transition:opacity .15s ease, transform .15s ease;
      clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);
    }
    .pill:hover { opacity:1; transform:translateY(-1px); }
    .diamond { width:9px; height:9px; background:\${P.accent}; transform:rotate(45deg); box-shadow:0 0 8px \${P.accent}; }
    .panel {
      position:absolute; right:0; bottom:42px; width:262px; max-height:60vh; overflow:auto;
      background:linear-gradient(155deg,
        color-mix(in srgb, #070B0F 92%, \${P.accent} 6%),
        color-mix(in srgb, #070B0F 95%, \${P.accent} 3%));
      border:1px solid color-mix(in srgb, \${P.accent} 48%, transparent);
      border-radius:10px; padding:10px; color:#EAF2F6;
      box-shadow:0 18px 40px rgba(0,0,0,.55);
      backdrop-filter:blur(6px);
    }
    .panel[hidden] { display:none; }
    .head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:2px 4px 8px; border-bottom:1px solid color-mix(in srgb, \${P.accent} 30%, transparent); }
    .head strong { font:800 11px/1 Bahnschrift,Consolas,monospace; letter-spacing:2px; color:\${P.accent}; }
    .head button { background:transparent; border:0; color:#8FA3B2; cursor:pointer; font:700 12px Consolas,monospace; }
    .row {
      display:flex; align-items:center; gap:9px; width:100%; padding:8px 7px; margin-top:4px;
      background:transparent; border:1px solid transparent; border-radius:7px;
      color:#EAF2F6; cursor:pointer; text-align:left;
    }
    .row:hover { background:color-mix(in srgb, \${P.accent} 12%, transparent); border-color:color-mix(in srgb, \${P.accent} 30%, transparent); }
    .row[data-active="true"] { border-color:color-mix(in srgb, \${P.accent} 55%, transparent); }
    .swatch { width:12px; height:12px; flex:0 0 12px; transform:rotate(45deg); border:1px solid rgba(255,255,255,.4); }
    .copy { display:flex; flex-direction:column; min-width:0; }
    .copy b { font:700 12px/1.2 "Microsoft YaHei UI",Bahnschrift,sans-serif; }
    .copy span { color:#8FA3B2; font:500 9px/1.4 Consolas,monospace; letter-spacing:.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .foot { display:flex; gap:6px; margin-top:8px; padding-top:8px; border-top:1px solid color-mix(in srgb, \${P.accent} 20%, transparent); }
    .foot button { flex:1; background:transparent; border:1px solid color-mix(in srgb, \${P.accent} 30%, transparent); color:#B9C6D0; border-radius:6px; padding:6px 4px; cursor:pointer; font:600 10px Consolas,monospace; }
    .foot button:hover { color:#EAF2F6; border-color:\${P.accent}; }
  \`;
  shadow.appendChild(styleEl);

  const pill = doc.createElement("button");
  pill.className = "pill";
  pill.setAttribute("aria-label", "泰拉终端主题");
  const diamond = doc.createElement("i"); diamond.className = "diamond";
  const label = doc.createElement("span");
  const active = P.themes.find((item) => item.id === P.activeId);
  label.textContent = "TERRA // " + (active ? active.name : P.activeId).toUpperCase();
  pill.appendChild(diamond); pill.appendChild(label);

  const panel = doc.createElement("div");
  panel.className = "panel";
  panel.hidden = true;
  const head = doc.createElement("div"); head.className = "head";
  const title = doc.createElement("strong"); title.textContent = "TERRA TERMINAL";
  const close = doc.createElement("button"); close.textContent = "×"; close.setAttribute("aria-label", "关闭");
  head.appendChild(title); head.appendChild(close); panel.appendChild(head);

  for (const theme of P.themes) {
    const row = doc.createElement("button");
    row.className = "row";
    row.dataset.active = theme.id === P.activeId ? "true" : "false";
    const swatch = doc.createElement("i"); swatch.className = "swatch"; swatch.style.background = theme.accent;
    const copy = doc.createElement("span"); copy.className = "copy";
    const name = doc.createElement("b"); name.textContent = theme.name;
    const sub = doc.createElement("span"); sub.textContent = theme.subtitle || theme.id;
    copy.appendChild(name); copy.appendChild(sub);
    row.appendChild(swatch); row.appendChild(copy);
    row.addEventListener("click", () => {
      try { window.__terraSwitch(theme.id); } catch {}
      panel.hidden = true;
    });
    panel.appendChild(row);
  }

  const foot = doc.createElement("div"); foot.className = "foot";
  const restore = doc.createElement("button"); restore.textContent = "还原原生";
  restore.addEventListener("click", () => { try { window.__terraRestore(); } catch {} });
  const hide = doc.createElement("button"); hide.textContent = "隐藏";
  hide.addEventListener("click", () => {
    try { localStorage.setItem("terra.switcher.hidden", "1"); } catch {}
    host.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;z-index:2147483647;";
  });
  foot.appendChild(restore); foot.appendChild(hide); panel.appendChild(foot);

  pill.addEventListener("click", () => { panel.hidden = !panel.hidden; });
  close.addEventListener("click", () => { panel.hidden = true; });
  shadow.appendChild(pill); shadow.appendChild(panel);

  window.__terraInjected = true;
  window.__terraTheme = P.activeId;
  root.setAttribute("data-terra-skin", "1");
  root.setAttribute("data-terra-theme", P.activeId);
  return { ok: true, theme: P.activeId };
})()`;
}

export function buildCleanupSource() {
  return `(() => {
    const ids = ["terra-skin", "terra-deco", "terra-switcher-host"];
    for (const id of ids) {
      const node = document.getElementById(id);
      if (node) node.remove();
    }
    document.documentElement.removeAttribute("data-terra-theme");
    document.documentElement.removeAttribute("data-terra-skin");
    delete window.__terraInjected;
    delete window.__terraTheme;
    try { localStorage.removeItem("terra.switcher.hidden"); } catch {}
    return true;
  })()`;
}
