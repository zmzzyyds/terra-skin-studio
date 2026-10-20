import { randomBytes } from "node:crypto";
import { existsSync, renameSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

import {
  BOOT_MODES,
  DECOR_VARIANTS,
  DEFAULT_CDP_PORT,
  DEFAULT_COLORS,
  DEFAULT_PANEL_PORT,
  DEFAULT_STATE,
  HEX_COLOR_RE,
  IMAGE_EXTENSIONS,
  MAX_MANIFEST_BYTES,
  SCHEMA_VERSION,
  SERIES_VALUES,
  THEME_ID_RE,
  VIDEO_EXTENSIONS,
} from "./constants.mjs";

const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isInside(root, candidate) {
  const rel = relative(root, candidate);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function asString(value, field, { max = 200, allowEmpty = true } = {}) {
  if (typeof value !== "string") throw new Error(`${field} 必须是字符串`);
  const text = value.trim();
  if (!allowEmpty && !text) throw new Error(`${field} 不能为空`);
  if (text.length > max) throw new Error(`${field} 超过 ${max} 字符`);
  return text;
}

function asHex(value, field, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !HEX_COLOR_RE.test(value)) {
    throw new Error(`${field} 必须是六位十六进制颜色`);
  }
  return value.toUpperCase();
}

function asInteger(value, field, fallback, min, max) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${field} 必须是 ${min} 到 ${max} 的整数`);
  }
  return value;
}

function asNumber(value, field, fallback, min, max) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} 必须是 ${min} 到 ${max} 的数字`);
  }
  return value;
}

function normalizeFocus(value, field, fallback = { x: 50, y: 50 }) {
  if (value === undefined) return fallback;
  if (!isRecord(value)) throw new Error(`${field} 必须是对象`);
  return {
    x: asInteger(value.x, `${field}.x`, fallback.x, 0, 100),
    y: asInteger(value.y, `${field}.y`, fallback.y, 0, 100),
  };
}

function normalizeAssetPath(value, field, { extensions, required = false }) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`${field} 不能为空`);
    return null;
  }
  if (typeof value !== "string") throw new Error(`${field} 必须是字符串`);
  const text = value.trim();
  if (isAbsolute(text) || /^[a-zA-Z]:[\\/]/.test(text)) {
    throw new Error(`${field} 必须是主题目录内的相对路径`);
  }
  if (text.split(/[\\/]+/).includes("..")) {
    throw new Error(`${field} 不能包含 ..`);
  }
  const ext = extname(text).toLowerCase();
  if (!extensions.has(ext)) {
    throw new Error(`${field} 不支持的文件类型：${ext || "(无扩展名)"}`);
  }
  return text.replaceAll("\\", "/");
}

function normalizeColors(value) {
  if (value === undefined) return { ...DEFAULT_COLORS };
  if (!isRecord(value)) throw new Error("colors 必须是对象");
  const mode = value.mode ?? DEFAULT_COLORS.mode;
  if (mode !== "light" && mode !== "dark") {
    throw new Error("colors.mode 必须是 light 或 dark");
  }
  return {
    accent: asHex(value.accent, "colors.accent", DEFAULT_COLORS.accent),
    secondary: asHex(value.secondary, "colors.secondary", DEFAULT_COLORS.secondary),
    surface: asHex(value.surface, "colors.surface", DEFAULT_COLORS.surface),
    text: asHex(value.text, "colors.text", DEFAULT_COLORS.text),
    mode,
  };
}

function normalizeCopy(value, name) {
  if (value === undefined) {
    return { brand: "PRTS // 明日方舟 PRTS", headline: name, tagline: "PROTOCOL READY" };
  }
  if (!isRecord(value)) throw new Error("copy 必须是对象");
  return {
    brand: asString(value.brand ?? "PRTS // 明日方舟 PRTS", "copy.brand", { max: 120 }),
    headline: asString(value.headline ?? name, "copy.headline", { max: 80 }),
    tagline: asString(value.tagline ?? "PROTOCOL READY", "copy.tagline", { max: 160 }),
  };
}

function normalizeBackground(value) {
  if (value === undefined) {
    return { image: null, focus: { x: 50, y: 50 }, tint: DEFAULT_COLORS.surface, tintOpacity: 0.25 };
  }
  if (!isRecord(value)) throw new Error("background 必须是对象");
  return {
    image: normalizeAssetPath(value.image, "background.image", {
      extensions: IMAGE_EXTENSIONS,
      required: false,
    }),
    focus: normalizeFocus(value.focus, "background.focus"),
    tint: asHex(value.tint, "background.tint", DEFAULT_COLORS.surface),
    tintOpacity: asNumber(value.tintOpacity, "background.tintOpacity", 0.25, 0, 1),
  };
}

function normalizeFrames(value) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length < 2 || value.length > 32) {
    throw new Error("boot.screenFrames 必须是 2 到 32 个关键帧");
  }
  let previous = -Infinity;
  return value.map((frame, index) => {
    if (!isRecord(frame)) throw new Error(`boot.screenFrames[${index}] 必须是对象`);
    const time = asNumber(frame.time, `boot.screenFrames[${index}].time`, 0, 0, 3600);
    if (time <= previous) throw new Error("boot.screenFrames 的时间必须严格递增");
    previous = time;
    const x = asNumber(frame.x, `boot.screenFrames[${index}].x`, 0, 0, 1);
    const y = asNumber(frame.y, `boot.screenFrames[${index}].y`, 0, 0, 1);
    const width = asNumber(frame.width, `boot.screenFrames[${index}].width`, 0, 0.001, 1);
    const height = asNumber(frame.height, `boot.screenFrames[${index}].height`, 0, 0.001, 1);
    if (x + width > 1.001 || y + height > 1.001) {
      throw new Error(`boot.screenFrames[${index}] 超出了画面范围`);
    }
    return { time, x, y, width, height };
  });
}

function normalizeBoot(value, background) {
  if (value === undefined) {
    return {
      mode: "poster",
      video: null,
      poster: background.image,
      width: 1920,
      height: 1080,
      holdAt: 0,
      transitionStart: 0,
      transitionEnd: 0,
      maxWaitSeconds: 60,
      volume: 0.75,
      screenFrames: null,
    };
  }
  if (!isRecord(value)) throw new Error("boot 必须是对象");
  const video = normalizeAssetPath(value.video, "boot.video", {
    extensions: VIDEO_EXTENSIONS,
    required: false,
  });
  const poster = normalizeAssetPath(value.poster, "boot.poster", {
    extensions: IMAGE_EXTENSIONS,
    required: false,
  });
  const mode = value.mode ?? (video ? "fade" : "poster");
  if (!BOOT_MODES.has(mode)) throw new Error("boot.mode 必须是 handoff、fade 或 poster");
  if ((mode === "handoff" || mode === "fade") && !video) {
    throw new Error(`boot.mode=${mode} 需要 boot.video`);
  }
  if (mode === "poster" && !poster && !background.image) {
    throw new Error("boot.mode=poster 需要 boot.poster 或 background.image");
  }
  const maxWaitSeconds = asNumber(value.maxWaitSeconds, "boot.maxWaitSeconds", 60, 1, 300);
  const holdAt = asNumber(value.holdAt, "boot.holdAt", 0, 0, 3600);
  const transitionStart = asNumber(value.transitionStart, "boot.transitionStart", 0, 0, 3600);
  const transitionEnd = asNumber(value.transitionEnd, "boot.transitionEnd", 0, 0, 3600);
  if (!(holdAt <= transitionStart && transitionStart <= transitionEnd)) {
    throw new Error("boot 的时间必须满足 holdAt <= transitionStart <= transitionEnd");
  }
  const screenFrames = normalizeFrames(value.screenFrames);
  if (mode === "handoff" && !screenFrames) {
    throw new Error("boot.mode=handoff 需要 boot.screenFrames");
  }
  return {
    mode,
    video,
    poster: poster ?? background.image,
    width: asInteger(value.width, "boot.width", 1920, 320, 7680),
    height: asInteger(value.height, "boot.height", 1080, 180, 4320),
    holdAt,
    transitionStart,
    transitionEnd,
    maxWaitSeconds,
    volume: asNumber(value.volume, "boot.volume", 0.75, 0, 1),
    screenFrames,
  };
}

export function validateThemeManifest(input, { expectedId = null } = {}) {
  if (!isRecord(input)) throw new Error("theme.json 必须是对象");
  if (input.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`theme.json 的 schemaVersion 必须是 ${SCHEMA_VERSION}`);
  }
  if (typeof input.id !== "string" || !THEME_ID_RE.test(input.id)) {
    throw new Error("theme.json 的 id 不合法");
  }
  if (expectedId !== null && input.id !== expectedId) {
    throw new Error(`theme.json 的 id (${input.id}) 与目录 (${expectedId}) 不一致`);
  }
  const name = asString(input.name, "name", { max: 80, allowEmpty: false });
  const series = input.series ?? "custom";
  if (!SERIES_VALUES.has(series)) throw new Error("series 不合法");
  const colors = normalizeColors(input.colors);
  const background = normalizeBackground(input.background);
  const decor = input.decor ?? "custom";
  if (!DECOR_VARIANTS.has(decor)) throw new Error("decor 不合法");
  return {
    schemaVersion: SCHEMA_VERSION,
    id: input.id,
    name,
    subtitle: asString(input.subtitle ?? "", "subtitle", { max: 120 }),
    series,
    colors,
    copy: normalizeCopy(input.copy, name),
    background,
    decor,
    boot: normalizeBoot(input.boot, background),
    preview: normalizeAssetPath(input.preview, "preview", {
      extensions: IMAGE_EXTENSIONS,
      required: false,
    }),
  };
}

async function readJsonBounded(filePath, maxBytes = MAX_MANIFEST_BYTES) {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error(`${filePath} 不是文件`);
  if (info.size > maxBytes) throw new Error(`${filePath} 超过大小限制`);
  const text = await readFile(filePath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${filePath} JSON 解析失败：${error.message}`);
  }
}

async function existsFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function writeJsonAtomic(filePath, value) {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true });
  const temporary = join(
    directory,
    `.${Date.now()}-${randomBytes(4).toString("hex")}.tmp`,
  );
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, filePath);
}

function findAppRoot() {
  const candidates = [
    process.env.TERRA_APP_ROOT,
    process.cwd(),
    resolve(MODULE_DIR, "..", ".."),
    resolve(MODULE_DIR, "..", "..", ".."),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const root = resolve(candidate);
    if (existsSync(join(root, "themes")) && existsSync(join(root, "panel"))) return root;
  }
  return resolve(MODULE_DIR, "..", "..");
}

function defaultDataDir() {
  const localAppData = process.env.LOCALAPPDATA;
  const base = localAppData && isAbsolute(localAppData) ? localAppData : homedir();
  const dataDir = join(base, "ArknightsPRTS");
  const legacyDataDir = join(base, "TerraStudio");

  // 首次改名升级时迁移旧目录，保留主题、状态和日志；并发时沿用已经成功的目录。
  if (!existsSync(dataDir) && existsSync(legacyDataDir)) {
    try {
      renameSync(legacyDataDir, dataDir);
    } catch {
      if (!existsSync(dataDir)) return legacyDataDir;
    }
  }
  return dataDir;
}

export function createThemeStore(options = {}) {
  const appRoot = resolve(options.appRoot ?? findAppRoot());
  const dataDir = resolve(options.dataDir ?? process.env.TERRA_DATA_DIR ?? defaultDataDir());
  const builtinDir = resolve(options.builtinThemesDir ?? join(appRoot, "themes"));
  const customDir = resolve(options.customThemesDir ?? join(dataDir, "themes"));
  const stateFile = resolve(options.stateFile ?? join(dataDir, "state.json"));
  const logDir = resolve(options.logDir ?? join(dataDir, "logs"));
  const tempDir = resolve(options.tempDir ?? join(dataDir, "tmp"));

  async function ensureRuntimeDirs() {
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    await mkdir(customDir, { recursive: true, mode: 0o700 });
    await mkdir(logDir, { recursive: true, mode: 0o700 });
    await mkdir(tempDir, { recursive: true, mode: 0o700 });
  }

  async function readState() {
    await ensureRuntimeDirs();
    try {
      const raw = await readJsonBounded(stateFile);
      return normalizeState(raw);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const state = { ...DEFAULT_STATE };
      await writeJsonAtomic(stateFile, state);
      return state;
    }
  }

  async function writeState(patch) {
    const current = await readState();
    const next = normalizeState({ ...current, ...patch, schemaVersion: SCHEMA_VERSION });
    await writeJsonAtomic(stateFile, next);
    return next;
  }

  async function loadThemeDir(directory, builtin) {
    const manifestPath = join(directory, "theme.json");
    const raw = await readJsonBounded(manifestPath);
    const manifest = validateThemeManifest(raw, { expectedId: directory.split(/[\\/]/).pop() });
    const assets = {
      hero: null,
      poster: null,
      video: null,
      preview: null,
    };
    if (manifest.background.image) {
      assets.hero = resolve(directory, manifest.background.image);
      if (!isInside(directory, assets.hero)) throw new Error("background.image 越出主题目录");
    }
    if (manifest.boot.poster) {
      assets.poster = resolve(directory, manifest.boot.poster);
      if (!isInside(directory, assets.poster)) throw new Error("boot.poster 越出主题目录");
    }
    if (manifest.boot.video) {
      assets.video = resolve(directory, manifest.boot.video);
      if (!isInside(directory, assets.video)) throw new Error("boot.video 越出主题目录");
    }
    if (manifest.preview) {
      assets.preview = resolve(directory, manifest.preview);
      if (!isInside(directory, assets.preview)) throw new Error("preview 越出主题目录");
    }
    const available = {
      hero: assets.hero ? await existsFile(assets.hero) : false,
      poster: assets.poster ? await existsFile(assets.poster) : false,
      video: assets.video ? await existsFile(assets.video) : false,
      preview: assets.preview ? await existsFile(assets.preview) : false,
    };
    return {
      ...manifest,
      dir: directory,
      builtin,
      assets,
      available,
    };
  }

  async function listThemeDirs(root) {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    return entries
      .filter((entry) => entry.isDirectory() && entry.name !== "_template" && entry.name !== "art")
      .map((entry) => entry.name)
      .filter((id) => THEME_ID_RE.test(id))
      .sort();
  }

  async function listThemes() {
    await ensureRuntimeDirs();
    const themes = [];
    const seen = new Set();
    const builtinOrder = new Map([
      ["si", 0],
      ["zhuang-fangyi", 1],
      ["goldenglow", 2],
      ["shu", 3],
    ]);
    const builtinIds = (await listThemeDirs(builtinDir)).sort((a, b) => {
      const ai = builtinOrder.get(a) ?? 100;
      const bi = builtinOrder.get(b) ?? 100;
      return ai - bi || a.localeCompare(b);
    });
    for (const id of builtinIds) {
      try {
        const theme = await loadThemeDir(join(builtinDir, id), true);
        themes.push(toMetadata(theme));
        seen.add(id);
      } catch (error) {
        themes.push({
          id,
          name: id,
          subtitle: "",
          series: "custom",
          decor: "custom",
          colors: { ...DEFAULT_COLORS },
          builtin: true,
          error: error.message,
          available: { hero: false, poster: false, video: false, preview: false },
        });
      }
    }
    for (const id of await listThemeDirs(customDir)) {
      if (seen.has(id)) continue;
      try {
        const theme = await loadThemeDir(join(customDir, id), false);
        themes.push(toMetadata(theme));
      } catch (error) {
        themes.push({
          id,
          name: id,
          subtitle: "",
          series: "custom",
          decor: "custom",
          colors: { ...DEFAULT_COLORS },
          builtin: false,
          error: error.message,
          available: { hero: false, poster: false, video: false, preview: false },
        });
      }
    }
    return themes;
  }

  async function getTheme(id) {
    if (typeof id !== "string" || !THEME_ID_RE.test(id)) {
      throw new Error("主题 id 不合法");
    }
    const builtinPath = join(builtinDir, id);
    if (existsSync(join(builtinPath, "theme.json"))) {
      return loadThemeDir(builtinPath, true);
    }
    const customPath = join(customDir, id);
    if (existsSync(join(customPath, "theme.json"))) {
      return loadThemeDir(customPath, false);
    }
    throw new Error(`找不到主题：${id}`);
  }

  async function getActiveTheme() {
    const state = await readState();
    try {
      return await getTheme(state.activeTheme);
    } catch {
      const themes = await listThemes();
      const first = themes.find((theme) => !theme.error) ?? themes[0];
      if (!first) throw new Error("没有可用主题");
      const active = await getTheme(first.id);
      await writeState({ activeTheme: first.id });
      return active;
    }
  }

  async function getThemeAssetPath(id, relativePath) {
    const theme = await getTheme(id);
    const candidate = resolve(theme.dir, relativePath);
    if (!isInside(theme.dir, candidate)) throw new Error("资源路径越出主题目录");
    if (!(await existsFile(candidate))) throw new Error("资源不存在");
    return candidate;
  }

  async function createCustomTheme(input) {
    if (!isRecord(input)) throw new Error("创建主题参数必须是对象");
    const name = asString(input.name, "name", { max: 40, allowEmpty: false });
    const subtitle = asString(input.subtitle ?? "", "subtitle", { max: 80 });
    const series = input.series ?? "custom";
    if (!SERIES_VALUES.has(series)) throw new Error("series 不合法");
    const colors = normalizeColors(input.colors);
    const decor = input.decor ?? "custom";
    if (!DECOR_VARIANTS.has(decor)) throw new Error("decor 不合法");
    const image = input.image;
    if (!image || typeof image !== "object") throw new Error("必须上传一张背景图");
    const imageExt = String(image.ext ?? "").toLowerCase();
    if (!IMAGE_EXTENSIONS.has(imageExt)) throw new Error("背景图必须是 PNG、JPEG 或 WebP");
    const imageTemp = resolve(String(image.path ?? ""));
    if (!isInside(tempDir, imageTemp)) throw new Error("背景图临时路径不合法");
    if (!(await existsFile(imageTemp))) throw new Error("背景图临时文件不存在");

    let videoTemp = null;
    if (input.video) {
      const videoExt = String(input.video.ext ?? "").toLowerCase();
      if (!VIDEO_EXTENSIONS.has(videoExt)) throw new Error("启动视频必须是 MP4");
      videoTemp = resolve(String(input.video.path ?? ""));
      if (!isInside(tempDir, videoTemp)) throw new Error("启动视频临时路径不合法");
      if (!(await existsFile(videoTemp))) throw new Error("启动视频临时文件不存在");
    }

    await ensureRuntimeDirs();
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "theme";
    const id = `custom-${slug}-${randomBytes(3).toString("hex")}`;
    const directory = join(customDir, id);
    await mkdir(directory, { recursive: false, mode: 0o700 });
    try {
      const heroName = `hero${imageExt}`;
      await rename(imageTemp, join(directory, heroName));
      let boot;
      if (videoTemp) {
        await rename(videoTemp, join(directory, "boot.mp4"));
        boot = {
          mode: "fade",
          video: "boot.mp4",
          poster: heroName,
          width: 1920,
          height: 1080,
          holdAt: 0,
          transitionStart: 0,
          transitionEnd: 0,
          maxWaitSeconds: 60,
          volume: 0.75,
        };
      } else {
        boot = {
          mode: "poster",
          poster: heroName,
          width: 1920,
          height: 1080,
          holdAt: 0,
          transitionStart: 0,
          transitionEnd: 0,
          maxWaitSeconds: 60,
          volume: 0,
        };
      }
      const manifest = validateThemeManifest(
        {
          schemaVersion: SCHEMA_VERSION,
          id,
          name,
          subtitle,
          series,
          colors,
          copy: {
            brand: "PRTS // CUSTOM",
            headline: name,
            tagline: subtitle || "CUSTOM PROTOCOL",
          },
          background: {
            image: heroName,
            focus: { x: 50, y: 30 },
            tint: colors.surface,
            tintOpacity: 0.3,
          },
          decor,
          boot,
          preview: heroName,
        },
        { expectedId: id },
      );
      await writeJsonAtomic(join(directory, "theme.json"), manifest);
      return loadThemeDir(directory, false);
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  async function deleteCustomTheme(id) {
    if (typeof id !== "string" || !id.startsWith("custom-") || !THEME_ID_RE.test(id)) {
      throw new Error("只能删除自定义主题");
    }
    const directory = join(customDir, id);
    if (!isInside(customDir, directory)) throw new Error("主题路径不合法");
    await rm(directory, { recursive: true, force: true });
  }

  function toMetadata(theme) {
    return {
      id: theme.id,
      name: theme.name,
      subtitle: theme.subtitle,
      series: theme.series,
      decor: theme.decor,
      colors: theme.colors,
      copy: theme.copy,
      background: theme.background,
      boot: theme.boot,
      builtin: theme.builtin,
      available: theme.available,
      preview: theme.preview,
    };
  }

  return {
    appRoot,
    dataDir,
    builtinDir,
    customDir,
    stateFile,
    logDir,
    tempDir,
    ensureRuntimeDirs,
    readState,
    writeState,
    listThemes,
    getTheme,
    getActiveTheme,
    getThemeAssetPath,
    createCustomTheme,
    deleteCustomTheme,
    validateThemeManifest,
  };
}

function normalizeState(input) {
  if (!isRecord(input)) return { ...DEFAULT_STATE };
  return {
    schemaVersion: SCHEMA_VERSION,
    activeTheme:
      typeof input.activeTheme === "string" && THEME_ID_RE.test(input.activeTheme)
        ? input.activeTheme
        : DEFAULT_STATE.activeTheme,
    skinEnabled: typeof input.skinEnabled === "boolean" ? input.skinEnabled : true,
    bootEnabled: typeof input.bootEnabled === "boolean" ? input.bootEnabled : true,
    cdpPort: Number.isInteger(input.cdpPort) && input.cdpPort >= 1024 && input.cdpPort <= 65535
      ? input.cdpPort
      : DEFAULT_CDP_PORT,
    panelPort: Number.isInteger(input.panelPort) && input.panelPort >= 1024 && input.panelPort <= 65535
      ? input.panelPort
      : DEFAULT_PANEL_PORT,
    opacity: typeof input.opacity === "number" ? clamp(input.opacity, 0.5, 1) : 0.88,
    clarity: typeof input.clarity === "number" ? clamp(input.clarity, 0, 1) : 0.6,
    muteBoot: typeof input.muteBoot === "boolean" ? input.muteBoot : false,
    readability: input.readability === "on" || input.readability === "off" ? input.readability : "auto",
    appearance: input.appearance === "paper" ? "paper" : "dark",
    handoff: input.handoff === "maximize" ? "maximize" : "restore",
  };
}

export const defaultStore = createThemeStore();
