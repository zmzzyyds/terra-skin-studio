import { randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, readFile, stat, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

import { enableLoopback, launchCodex } from "./codex-app.mjs";

const IMAGE_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const MAX_JSON_BYTES = 256 * 1024;
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function json(res, status, data) {
  const body = Buffer.from(`${JSON.stringify(data)}\n`, "utf8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function fail(res, status, message) {
  json(res, status, { ok: false, error: message });
}

function sameToken(expected, received) {
  if (typeof received !== "string") return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function requireLength(req) {
  if (req.headers["transfer-encoding"]) {
    throw new Error("不接受 chunked 请求");
  }
  const value = Number(req.headers["content-length"]);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("缺少 Content-Length");
  }
  return value;
}

async function readJsonBody(req, maxBytes = MAX_JSON_BYTES) {
  const length = requireLength(req);
  if (length > maxBytes) throw new Error("请求体过大");
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("请求体过大");
    chunks.push(chunk);
  }
  if (total !== length) throw new Error("请求体长度不一致");
  if (total === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("JSON 解析失败");
  }
}

function extensionOf(req) {
  const raw = String(req.headers["x-filename"] ?? "");
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}
  const ext = extname(decoded).toLowerCase();
  if (!["jpg", "jpeg", "png", "webp", "mp4"].includes(ext.replace(".", ""))) {
    throw new Error("不支持的文件类型");
  }
  return ext;
}

async function validateMagic(path, ext) {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, 16, 0);
    const head = buffer.subarray(0, bytesRead);
    if (ext === ".jpg" || ext === ".jpeg") {
      return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    }
    if (ext === ".png") {
      return head.length >= 8
        && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
        && head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a;
    }
    if (ext === ".webp") {
      return head.length >= 12
        && head.subarray(0, 4).toString("ascii") === "RIFF"
        && head.subarray(8, 12).toString("ascii") === "WEBP";
    }
    if (ext === ".mp4") {
      return head.length >= 12 && head.subarray(4, 8).toString("ascii") === "ftyp";
    }
    return false;
  } finally {
    await handle.close();
  }
}

async function receiveUpload(req, { directory, maxBytes }) {
  const ext = extensionOf(req);
  const length = requireLength(req);
  if (length > maxBytes) throw new Error("文件过大");
  if (length === 0) throw new Error("文件为空");
  const name = `${Date.now()}-${randomBytes(10).toString("hex")}${ext}`;
  const destination = join(directory, name);
  let total = 0;
  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;
      if (total > maxBytes) {
        callback(new Error("文件过大"));
        return;
      }
      callback(null, chunk);
    },
  });
  try {
    await pipeline(req, counter, createWriteStream(destination, { mode: 0o600 }));
    if (total !== length) throw new Error("上传长度不一致");
    if (!(await validateMagic(destination, ext))) throw new Error("文件内容与扩展名不符");
    return { path: destination, ext, size: total };
  } catch (error) {
    await unlink(destination).catch(() => {});
    throw error;
  }
}

function publicTheme(theme) {
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
    builtin: Boolean(theme.builtin),
    available: theme.available,
    preview: theme.preview ?? null,
  };
}

function themeWithPreviewUrl(theme) {
  const base = publicTheme(theme);
  const previewFile = base.available?.preview
    ? base.preview
    : base.available?.hero
      ? base.background?.image
      : null;
  return {
    ...base,
    previewUrl: previewFile
      ? `/themes/${encodeURIComponent(base.id)}/${encodeURIComponent(previewFile.split(/[\\/]/).pop())}`
      : null,
  };
}

async function readLogTail(filePath, lines = 160) {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return [];
    if (info.size > 2 * 1024 * 1024) return ["日志文件过大"];
    const text = await readFile(filePath, "utf8");
    return text.split(/\r?\n/).filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

export function createPanelServer({ store, controller, port }) {
  const token = randomBytes(24).toString("hex");
  const panelDir = join(store.appRoot, "panel");
  let boundPort = port;

  async function serveStatic(res, fileName, contentType) {
    const filePath = join(panelDir, fileName);
    let content;
    try {
      content = await readFile(filePath);
    } catch {
      fail(res, 404, "文件不存在");
      return;
    }
    if (fileName === "index.html") {
      content = Buffer.from(
        content.toString("utf8").replaceAll("__TERRA_TOKEN__", token),
        "utf8",
      );
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": content.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    });
    res.end(content);
  }

  async function handleApi(req, res, url) {
    if (url.pathname === "/api/ping") {
      json(res, 200, { ok: true, app: "terra-studio", port: boundPort });
      return;
    }
    if (!sameToken(token, req.headers["x-terra-token"])) {
      fail(res, 401, "token 无效");
      return;
    }

    const method = req.method ?? "GET";
    if (method === "GET" && url.pathname === "/api/state") {
      const state = await store.readState();
      const themes = (await store.listThemes()).map(themeWithPreviewUrl);
      json(res, 200, {
        ok: true,
        state,
        themes,
        controller: controller.getState(),
        loopback: controller.status?.loopback ?? null,
        package: controller.status?.package ?? null,
        port: controller.status?.port ?? null,
      });
      return;
    }
    if (method === "GET" && url.pathname === "/api/themes") {
      json(res, 200, { ok: true, themes: (await store.listThemes()).map(themeWithPreviewUrl) });
      return;
    }
    if (method === "GET" && url.pathname === "/api/logs") {
      json(res, 200, {
        ok: true,
        file: controller.logger.file,
        lines: await readLogTail(controller.logger.file),
      });
      return;
    }
    if (method === "POST" && url.pathname === "/api/apply") {
      const body = await readJsonBody(req);
      const id = String(body.id ?? "");
      const result = await controller.switchTheme(id);
      json(res, 200, { ok: true, result, controller: controller.getState() });
      return;
    }
    if (method === "POST" && url.pathname === "/api/restore") {
      await controller.restore();
      json(res, 200, { ok: true, controller: controller.getState() });
      return;
    }
    if (method === "POST" && url.pathname === "/api/skin") {
      const body = await readJsonBody(req);
      await controller.setSkinEnabled(Boolean(body.enabled));
      json(res, 200, { ok: true, controller: controller.getState() });
      return;
    }
    if (method === "POST" && url.pathname === "/api/switcher") {
      const body = await readJsonBody(req);
      const result = await controller.setSwitcherHidden(Boolean(body.hidden));
      json(res, 200, { ok: true, result });
      return;
    }
    if (method === "POST" && url.pathname === "/api/settings") {
      const body = await readJsonBody(req);
      const state = await controller.updateSettings(body);
      json(res, 200, { ok: true, state, controller: controller.getState() });
      return;
    }
    if (method === "POST" && url.pathname === "/api/codex/launch") {
      const body = await readJsonBody(req);
      const state = await store.readState();
      const result = await launchCodex(store.appRoot, {
        port: state.cdpPort,
        restart: Boolean(body.restart),
        boot: Boolean(body.boot),
        theme: state.activeTheme,
      });
      json(res, result.ok ? 200 : 500, {
        ok: result.ok,
        result,
        error: result.error ?? null,
      });
      return;
    }
    if (method === "POST" && url.pathname === "/api/loopback") {
      const result = await enableLoopback();
      json(res, result.ok ? 200 : 500, { ok: result.ok, result });
      return;
    }
    if (method === "POST" && url.pathname === "/api/upload") {
      const kind = url.searchParams.get("kind");
      if (kind !== "image" && kind !== "video") {
        fail(res, 400, "kind 必须是 image 或 video");
        return;
      }
      const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
      const upload = await receiveUpload(req, { directory: store.tempDir, maxBytes: max });
      json(res, 200, { ok: true, kind, ...upload });
      return;
    }
    if (method === "POST" && url.pathname === "/api/themes") {
      const body = await readJsonBody(req);
      const theme = await store.createCustomTheme(body);
      if (controller.getState().connected) {
        await controller.switchTheme(theme.id);
      }
      json(res, 200, { ok: true, theme: themeWithPreviewUrl(theme) });
      return;
    }
    if (method === "DELETE" && url.pathname.startsWith("/api/themes/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/themes/".length));
      const state = await store.readState();
      await store.deleteCustomTheme(id);
      if (state.activeTheme === id) {
        await controller.switchTheme("si").catch(() => {});
      }
      json(res, 200, { ok: true });
      return;
    }
    if (method === "POST" && url.pathname === "/api/open-folder") {
      const body = await readJsonBody(req);
      const target = body.custom ? store.customDir : store.builtinDir;
      spawn("explorer.exe", [target], { detached: true, stdio: "ignore" }).unref();
      json(res, 200, { ok: true, path: target });
      return;
    }
    fail(res, 404, "API 不存在");
  }

  async function handleThemeAsset(req, res, url) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 3 || parts[0] !== "themes") {
      fail(res, 404, "资源不存在");
      return;
    }
    const id = decodeURIComponent(parts[1]);
    const file = decodeURIComponent(parts[2]);
    if (file.includes("/") || file.includes("\\") || file.includes("..")) {
      fail(res, 400, "文件名不合法");
      return;
    }
    const ext = extname(file).toLowerCase();
    const mime = IMAGE_TYPES.get(ext);
    if (!mime) {
      fail(res, 400, "只允许图片资源");
      return;
    }
    const assetPath = await store.getThemeAssetPath(id, file);
    const info = await stat(assetPath);
    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": info.size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(assetPath).pipe(res);
  }

  async function handle(req, res) {
    req.setTimeout(300000);
    res.setTimeout(300000);
    try {
      const host = String(req.headers.host ?? "");
      const allowedHosts = new Set([
        `127.0.0.1:${boundPort}`,
        `localhost:${boundPort}`,
      ]);
      if (!allowedHosts.has(host)) {
        fail(res, 403, "Host 不被允许");
        return;
      }
      if (req.method && req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.origin;
        if (origin && origin !== `http://127.0.0.1:${boundPort}` && origin !== `http://localhost:${boundPort}`) {
          fail(res, 403, "Origin 不被允许");
          return;
        }
      }
      const url = new URL(req.url ?? "/", `http://${host}`);
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
        return;
      }
      if (url.pathname.startsWith("/themes/")) {
        await handleThemeAsset(req, res, url);
        return;
      }
      if (url.pathname === "/" || url.pathname === "/index.html") {
        await serveStatic(res, "index.html", "text/html; charset=utf-8");
        return;
      }
      if (url.pathname === "/app.js") {
        await serveStatic(res, "app.js", "text/javascript; charset=utf-8");
        return;
      }
      if (url.pathname === "/style.css") {
        await serveStatic(res, "style.css", "text/css; charset=utf-8");
        return;
      }
      fail(res, 404, "页面不存在");
    } catch (error) {
      const message = String(error?.message ?? "服务器错误");
      if (!res.headersSent) fail(res, 400, message);
      else res.end();
    }
  }

  const server = createServer(handle);

  async function listen() {
    await new Promise((resolvePromise, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        boundPort = server.address().port;
        server.removeListener("error", reject);
        resolvePromise();
      });
    });
    return { url: `http://127.0.0.1:${boundPort}/`, port: boundPort, token };
  }

  function close() {
    return new Promise((resolvePromise) => server.close(() => resolvePromise()));
  }

  return { server, listen, close, token, get port() { return boundPort; } };
}
