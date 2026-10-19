import { writeFile } from "node:fs/promises";
import { URL } from "node:url";

export const DEFAULT_COMMAND_TIMEOUT_MS = 5000;

function asText(data) {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  return String(data);
}

export function validateLoopbackWebSocketUrl(value, expectedPort) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("CDP WebSocket URL 不合法");
  }
  if (parsed.protocol !== "ws:" || parsed.hostname !== "127.0.0.1") {
    throw new Error("CDP WebSocket 必须是 ws://127.0.0.1");
  }
  if (Number(parsed.port) !== expectedPort) {
    throw new Error("CDP WebSocket 端口与预期不一致");
  }
  if (!parsed.pathname.startsWith("/devtools/page/")) {
    throw new Error("CDP WebSocket 路径必须是 /devtools/page/");
  }
  return parsed.toString();
}

export function isPageTarget(target, expectedPort) {
  if (!target || target.type !== "page" || typeof target.url !== "string") return false;
  if (typeof target.webSocketDebuggerUrl !== "string") return false;
  try {
    validateLoopbackWebSocketUrl(target.webSocketDebuggerUrl, expectedPort);
  } catch {
    return false;
  }
  if (/^(devtools|chrome-extension|chrome|about|edge):/i.test(target.url)) return false;
  if (target.url === "about:blank") return false;
  return true;
}

export function rankPageTargets(targets, expectedPort) {
  return targets
    .filter((target) => isPageTarget(target, expectedPort))
    .map((target, index) => {
      let score = 0;
      if (target.url.startsWith("app://")) score += 100;
      if (/codex|chatgpt/i.test(target.url)) score += 20;
      if (/codex|chatgpt/i.test(String(target.title ?? ""))) score += 10;
      return { target, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.target);
}

export async function fetchTargets(port, { timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`CDP 目标列表返回 HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("CDP 目标列表不是数组");
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`读取 CDP 目标超时（端口 ${port}）`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchVersion(port, { timeoutMs = 3000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function waitForPageTargets(
  port,
  { timeoutMs = 20000, pollMs = 400, expectedUrlPrefix = null } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < deadline) {
    try {
      const targets = rankPageTargets(await fetchTargets(port), port);
      last = targets;
      const matching = expectedUrlPrefix
        ? targets.filter((target) => target.url.startsWith(expectedUrlPrefix))
        : targets;
      if (matching.length > 0) return matching;
    } catch {
      // The application may still be starting; keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(
    `等待 Codex 主页面超时（端口 ${port}）；看到 ${last.length} 个可用页面目标`,
  );
}

export class CdpSession {
  constructor(webSocketUrl, { expectedPort = null, commandTimeoutMs = DEFAULT_COMMAND_TIMEOUT_MS } = {}) {
    if (expectedPort !== null) validateLoopbackWebSocketUrl(webSocketUrl, expectedPort);
    this.webSocketUrl = webSocketUrl;
    this.commandTimeoutMs = commandTimeoutMs;
    this.socket = null;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.closeListeners = new Set();
  }

  async open({ timeoutMs = 5000 } = {}) {
    if (this.socket) throw new Error("CDP 会话已经打开");
    const socket = new WebSocket(this.webSocketUrl);
    this.socket = socket;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        try { socket.close(); } catch {}
        reject(new Error("CDP WebSocket 连接超时"));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("CDP WebSocket 连接失败"));
      };
      const onClose = () => {
        cleanup();
        reject(new Error("CDP WebSocket 在连接完成前关闭"));
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);
    });
    socket.addEventListener("message", (event) => this.onMessage(event.data));
    socket.addEventListener("close", () => this.handleClose());
  }

  onMessage(data) {
    let message;
    try {
      message = JSON.parse(asText(data));
    } catch {
      return;
    }
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        const error = new Error(message.error.message || "CDP 命令失败");
        error.code = message.error.code;
        pending.reject(error);
      } else {
        pending.resolve(message.result ?? {});
      }
      return;
    }
    if (typeof message.method === "string") {
      const listeners = this.listeners.get(message.method);
      if (listeners) {
        for (const listener of [...listeners]) {
          try { listener(message.params ?? {}); } catch {}
        }
      }
    }
  }

  handleClose() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("CDP 连接已关闭"));
    }
    this.pending.clear();
    this.socket = null;
    for (const listener of [...this.closeListeners]) {
      try { listener(); } catch {}
    }
  }

  addCloseListener(listener) {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  on(method, listener) {
    let listeners = this.listeners.get(method);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(method, listeners);
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  send(method, params = {}, { timeoutMs = this.commandTimeoutMs } = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("CDP 连接未打开"));
    }
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP 命令超时：${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, { timeoutMs = this.commandTimeoutMs, awaitPromise = true } = {}) {
    const result = await this.send(
      "Runtime.evaluate",
      {
        expression,
        returnByValue: true,
        awaitPromise,
        userGesture: true,
        includeCommandLineAPI: false,
      },
      { timeoutMs },
    );
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.text || "页面脚本执行失败";
      const detail = result.exceptionDetails.exception?.description;
      throw new Error(detail ? `${text}: ${detail}` : text);
    }
    return result.result?.value;
  }

  async captureScreenshot(filePath) {
    const result = await this.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    if (!result.data) throw new Error("截图没有返回数据");
    await writeFile(filePath, Buffer.from(result.data, "base64"));
    return filePath;
  }

  close() {
    if (this.socket) {
      try { this.socket.close(); } catch {}
    }
    this.socket = null;
  }
}
