import { EventEmitter } from "node:events";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { CdpSession, waitForPageTargets } from "./cdp.mjs";
import { getStatus } from "./codex-app.mjs";
import {
  applyTheme,
  ensureBindings,
  inspectPage,
  restoreTheme,
  waitForAppReady,
} from "./injector.mjs";
import { createLogger } from "./logger.mjs";
import { defaultStore } from "./theme-store.mjs";
import { THEME_ID_RE } from "./constants.mjs";

export class TerraController {
  constructor({ store = defaultStore, port = 9341, logger = null } = {}) {
    this.store = store;
    this.port = port;
    this.logger = logger ?? createLogger(store.logDir);
    this.events = new EventEmitter();
    this.events.setMaxListeners(20);
    this.session = null;
    this.pollTimer = null;
    this.statusTimer = null;
    this.reconnectTimer = null;
    this.stopped = false;
    this.applying = false;
    this.connecting = false;
    this.lastError = null;
    this.lastAppliedAt = null;
    this.activeTheme = null;
    this.target = null;
    this.status = null;
    this.statusRefreshing = false;
    this.connectAttempts = 0;
    this.lastReadyWrite = 0;
  }

  async writeReady(ready = true) {
    try {
      await mkdir(this.store.dataDir, { recursive: true });
      const payload = {
        schemaVersion: 1,
        ready: Boolean(ready),
        theme: this.activeTheme?.id ?? null,
        appliedAt: new Date().toISOString(),
        pid: process.pid,
      };
      const target = join(this.store.dataDir, "ready.json");
      const temporary = join(this.store.dataDir, `.ready-${Date.now()}.tmp`);
      await writeFile(temporary, `${JSON.stringify(payload)}\n`, { mode: 0o600 });
      await rename(temporary, target);
      this.lastReadyWrite = Date.now();
    } catch (error) {
      this.logger.warn(`写入 ready.json 失败：${error.message}`);
    }
  }

  getState() {
    return {
      connected: Boolean(this.session && this.session.socket),
      port: this.port,
      target: this.target,
      activeTheme: this.activeTheme,
      lastAppliedAt: this.lastAppliedAt,
      lastError: this.lastError,
      status: this.status,
      connectAttempts: this.connectAttempts,
      logFile: this.logger.file,
    };
  }

  broadcast(event, data = null) {
    this.events.emit("change", { event, data, state: this.getState() });
  }

  start() {
    this.stopped = false;
    this.connectLoop();
    this.refreshStatus();
    this.statusTimer = setInterval(() => this.refreshStatus(), 5000);
    this.statusTimer.unref?.();
    return this;
  }

  stop() {
    this.stopped = true;
    this.writeReady(false).catch(() => {});
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.statusTimer) clearInterval(this.statusTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.pollTimer = null;
    this.statusTimer = null;
    this.reconnectTimer = null;
    if (this.session) {
      try { this.session.close(); } catch {}
    }
    this.session = null;
  }

  scheduleReconnect(delayMs = 2500) {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectLoop();
    }, delayMs);
    this.reconnectTimer.unref?.();
  }

  async connectLoop() {
    if (this.stopped || this.connecting) return;
    this.connecting = true;
    this.connectAttempts += 1;
    try {
      const targets = await waitForPageTargets(this.port, {
        timeoutMs: 6000,
        pollMs: 500,
      });
      const target = targets[0];
      this.logger.info(`连接 ${target.url}`);
      const session = new CdpSession(target.webSocketDebuggerUrl, {
        expectedPort: this.port,
      });
      await session.open();
      this.session = session;
      this.target = { id: target.id, title: target.title, url: target.url };
      this.lastError = null;
      await session.send("Page.enable");
      await session.send("Runtime.enable");
      session.addCloseListener(() => {
        if (this.session === session) {
          this.session = null;
          this.target = null;
          this.logger.warn("CDP 连接关闭");
          this.broadcast("disconnected");
          this.scheduleReconnect(1500);
        }
      });
      await ensureBindings(session, (name, payload) =>
        this.handleBinding(session, name, payload),
      );
      await waitForAppReady(session, { timeoutMs: 15000 }).catch(() => null);
      await this.applyCurrent(session);
      this.connectAttempts = 0;
      this.broadcast("connected");
      this.startPolling(session);
    } catch (error) {
      this.lastError = error.message;
      this.logger.warn(`连接失败：${error.message}`);
      this.broadcast("connect-failed");
      this.scheduleReconnect(2500);
    } finally {
      this.connecting = false;
    }
  }

  startPolling(session) {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(async () => {
      if (this.stopped || this.session !== session) return;
      try {
        const page = await inspectPage(session);
        const state = await this.store.readState();
        if (state.skinEnabled && page && !page.hasSkin) {
          this.logger.warn("检测到皮肤被页面移除，重新注入");
          await this.applyCurrent(session);
        }
        if (Date.now() - this.lastReadyWrite > 5000) {
          const readyToHandoff = state.skinEnabled
            ? Boolean(page?.hasSkin)
            : Boolean(page?.appReady);
          await this.writeReady(readyToHandoff);
        }
      } catch (error) {
        this.lastError = error.message;
        this.logger.warn(`轮询失败：${error.message}`);
        if (this.session === session) {
          try { session.close(); } catch {}
          this.session = null;
          this.target = null;
          this.broadcast("disconnected");
          this.scheduleReconnect(1200);
        }
      }
    }, 2500);
    this.pollTimer.unref?.();
  }

  async handleBinding(session, name, payload) {
    if (session !== this.session) return;
    if (name === "__terraRestore") {
      await this.restore();
      return;
    }
    if (name === "__terraSwitch") {
      const id = String(payload ?? "").trim();
      if (!THEME_ID_RE.test(id)) {
        this.logger.warn(`忽略非法主题 id：${id.slice(0, 60)}`);
        return;
      }
      try {
        await this.switchTheme(id);
        this.logger.info(`页面切换主题：${id}`);
      } catch (error) {
        this.lastError = error.message;
        this.logger.error(`页面切换失败：${error.message}`);
        this.broadcast("switch-failed", { theme: id, error: error.message });
      }
    }
  }

  async applyCurrent(session = this.session) {
    if (!session) return null;
    if (this.applying) return null;
    this.applying = true;
    try {
      const state = await this.store.readState();
      if (!state.skinEnabled) {
        await restoreTheme(session);
        this.activeTheme = null;
        this.lastAppliedAt = new Date().toISOString();
        await this.writeReady(true);
        return null;
      }
      const theme = await this.store.getActiveTheme();
      const themes = await this.store.listThemes();
      const result = await applyTheme(session, {
        theme,
        themes,
        activeId: theme.id,
        opacity: state.opacity,
        clarity: state.clarity,
        readability: state.readability,
        appearance: state.appearance,
        hidden: false,
      });
      this.activeTheme = {
        id: theme.id,
        name: theme.name,
        subtitle: theme.subtitle,
        colors: theme.colors,
      };
      this.lastAppliedAt = new Date().toISOString();
      this.lastError = null;
      this.logger.info(`已注入主题 ${theme.id}（CSS ${result.cssLength} 字节）`);
      await this.writeReady(true);
      this.broadcast("applied", { theme: theme.id });
      return result;
    } catch (error) {
      this.lastError = error.message;
      this.logger.error(`注入失败：${error.message}`);
      this.broadcast("apply-failed", { error: error.message });
      throw error;
    } finally {
      this.applying = false;
    }
  }

  async switchTheme(id) {
    if (!THEME_ID_RE.test(id)) throw new Error("主题 id 不合法");
    await this.store.getTheme(id);
    await this.store.writeState({ activeTheme: id, skinEnabled: true });
    if (!this.session) {
      this.broadcast("theme-selected", { theme: id });
      return { id, applied: false };
    }
    const result = await this.applyCurrent(this.session);
    return { id, applied: Boolean(result) };
  }

  async restore() {
    if (this.session) await restoreTheme(this.session);
    await this.store.writeState({ skinEnabled: false });
    this.activeTheme = null;
    this.lastAppliedAt = new Date().toISOString();
    await this.writeReady(true);
    this.broadcast("restored");
    this.logger.info("已还原官方界面");
  }

  async setSkinEnabled(enabled) {
    await this.store.writeState({ skinEnabled: Boolean(enabled) });
    if (enabled) {
      if (this.session) await this.applyCurrent(this.session);
    } else if (this.session) {
      await restoreTheme(this.session);
      this.activeTheme = null;
    }
    this.broadcast("skin-toggle", { enabled: Boolean(enabled) });
  }

  async setSwitcherHidden(hidden) {
    const value = Boolean(hidden);
    let applied = false;
    if (this.session) {
      try {
        const expression = value
          ? "(() => { try { localStorage.setItem('terra.switcher.hidden','1'); } catch {} return true; })()"
          : "(() => { try { localStorage.removeItem('terra.switcher.hidden'); } catch {} return true; })()";
        await this.session.evaluate(expression);
        if (!value) {
          await this.store.writeState({ skinEnabled: true });
        }
        await this.applyCurrent(this.session);
        applied = true;
      } catch (error) {
        this.logger.warn(`切换主题胶囊失败：${error.message}`);
      }
    }
    this.broadcast("switcher", { hidden: value, applied });
    return { hidden: value, applied, connected: Boolean(this.session) };
  }

  async updateSettings(patch) {
    const allowed = {};
    for (const key of ["opacity", "clarity", "readability", "appearance", "muteBoot", "bootEnabled", "handoff", "cdpPort", "panelPort"]) {
      if (Object.hasOwn(patch ?? {}, key)) allowed[key] = patch[key];
    }
    const state = await this.store.writeState(allowed);
    if (this.session && (Object.hasOwn(allowed, "opacity") || Object.hasOwn(allowed, "clarity") || Object.hasOwn(allowed, "readability"))) {
      await this.applyCurrent(this.session);
    } else {
      this.broadcast("settings");
    }
    return state;
  }

  async refreshStatus() {
    if (this.statusRefreshing || this.stopped) return this.status;
    this.statusRefreshing = true;
    try {
      this.status = await getStatus(this.port);
      this.broadcast("status");
    } catch (error) {
      this.logger.warn(`状态查询失败：${error.message}`);
    } finally {
      this.statusRefreshing = false;
    }
    return this.status;
  }
}
