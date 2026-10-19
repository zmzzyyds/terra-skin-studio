export const SCHEMA_VERSION = 1;

export const THEME_ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
export const VIDEO_EXTENSIONS = new Set([".mp4"]);

export const DECOR_VARIANTS = new Set([
  "endfield",
  "rhodes",
  "sui",
  "goldenglow",
  "custom",
]);

export const SERIES_VALUES = new Set(["arknights", "endfield", "custom"]);
export const BOOT_MODES = new Set(["handoff", "fade", "poster"]);

export const DEFAULT_CDP_PORT = 9341;
export const DEFAULT_PANEL_PORT = 9342;
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_MANIFEST_BYTES = 256 * 1024;

export const DEFAULT_COLORS = {
  accent: "#F2C94C",
  secondary: "#7FE7FF",
  surface: "#0A0F14",
  text: "#EAF2F6",
  mode: "dark",
};

export const DEFAULT_STATE = {
  schemaVersion: SCHEMA_VERSION,
  activeTheme: "si",
  skinEnabled: true,
  bootEnabled: true,
  cdpPort: DEFAULT_CDP_PORT,
  panelPort: DEFAULT_PANEL_PORT,
  opacity: 0.88,
  clarity: 0.6,
  muteBoot: false,
  readability: "auto",
  appearance: "dark",
  handoff: "restore",
};
