import { spawn } from "node:child_process";
import { join } from "node:path";

import { CdpSession, fetchTargets, fetchVersion, waitForPageTargets } from "./cdp.mjs";
import { getStatus, launchCodex } from "./codex-app.mjs";
import { TerraController } from "./controller.mjs";
import {
  applyTheme,
  ensureBindings,
  restoreTheme,
  waitForAppReady,
} from "./injector.mjs";
import { createLogger } from "./logger.mjs";
import { createPanelServer } from "./panel-server.mjs";
import { showSplash } from "./splash.mjs";
import { defaultStore } from "./theme-store.mjs";
import { THEME_ID_RE } from "./constants.mjs";

function parseArgs(argv) {
  const options = {
    command: argv[0] ?? "help",
    positionals: [],
    port: 9341,
    panelPort: 9342,
    noPanel: false,
    headless: false,
    noOpen: false,
    restart: false,
    out: null,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--port") options.port = Number(argv[++index]);
    else if (arg === "--panel-port") options.panelPort = Number(argv[++index]);
    else if (arg === "--no-panel") options.noPanel = true;
    else if (arg === "--headless") options.headless = true;
    else if (arg === "--no-open") options.noOpen = true;
    else if (arg === "--restart") options.restart = true;
    else if (arg === "--out") options.out = argv[++index];
    else if (arg.startsWith("-")) throw new Error(`未知参数：${arg}`);
    else options.positionals.push(arg);
  }
  for (const port of [options.port, options.panelPort]) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new Error("端口必须是 1024 到 65535 的整数");
    }
  }
  return options;
}

function printHelp() {
  console.log(`泰拉终端 / Terra Terminal

用法:
  node src/injector/cli.mjs panel [--headless] [--no-open] [--no-panel]
  node src/injector/cli.mjs list
  node src/injector/cli.mjs status [--port 9341]
  node src/injector/cli.mjs apply [主题id]
  node src/injector/cli.mjs restore
  node src/injector/cli.mjs screenshot [--out logs/shot.png]
  node src/injector/cli.mjs launch [--restart]
  node src/injector/cli.mjs splash [主题id] [--port 9341]
  node src/injector/cli.mjs doctor

panel 会同时启动换肤控制器和 http://127.0.0.1:9342 控制面板。
`);
}

async function connectOnce(port) {
  const targets = await waitForPageTargets(port, { timeoutMs: 20000 });
  const target = targets[0];
  const session = new CdpSession(target.webSocketDebuggerUrl, { expectedPort: port });
  await session.open();
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  return { session, target };
}

async function commandList() {
  const themes = await defaultStore.listThemes();
  for (const theme of themes) {
    const flags = [
      theme.builtin ? "built-in" : "custom",
      theme.available?.hero ? "hero" : "no-hero",
      theme.available?.video ? "video" : "no-video",
      theme.error ? `error: ${theme.error}` : "",
    ].filter(Boolean).join(" | ");
    console.log(`${theme.id.padEnd(20)} ${theme.name.padEnd(10)} ${flags}`);
  }
}

async function commandStatus(options) {
  const state = await defaultStore.readState();
  const status = await getStatus(options.port);
  console.log(JSON.stringify({ state, status }, null, 2));
}

async function commandApply(options) {
  const state = await defaultStore.readState();
  const id = options.positionals[0] ?? state.activeTheme;
  if (!THEME_ID_RE.test(id)) throw new Error("主题 id 不合法");
  const theme = await defaultStore.getTheme(id);
  const themes = await defaultStore.listThemes();
  await defaultStore.writeState({ activeTheme: id, skinEnabled: true });
  const { session, target } = await connectOnce(options.port);
  try {
    await waitForAppReady(session, { timeoutMs: 15000 });
    await ensureBindings(session, () => {});
    const result = await applyTheme(session, {
      theme,
      themes,
      activeId: theme.id,
      opacity: state.opacity,
      clarity: state.clarity,
      readability: state.readability,
      appearance: state.appearance,
      addDocumentScript: false,
    });
    console.log(`已应用到 ${target.url}：${theme.id}（CSS ${result.cssLength} 字节）`);
    console.log("注意：一次性注入不会在页面刷新后自动恢复；常驻请运行 panel。");
  } finally {
    session.close();
  }
}

async function commandRestore(options) {
  const { session } = await connectOnce(options.port);
  try {
    await restoreTheme(session);
    await defaultStore.writeState({ skinEnabled: false });
    console.log("已还原官方界面。");
  } finally {
    session.close();
  }
}

async function commandScreenshot(options) {
  const out = options.out ?? join(defaultStore.dataDir, "logs", "screenshot.png");
  const { session } = await connectOnce(options.port);
  try {
    await waitForAppReady(session, { timeoutMs: 15000 });
    await session.captureScreenshot(out);
    console.log(out);
  } finally {
    session.close();
  }
}

async function commandDoctor(options) {
  const state = await defaultStore.readState();
  const status = await getStatus(options.port);
  let targets = [];
  try {
    targets = await fetchTargets(options.port);
  } catch {}
  const version = await fetchVersion(options.port);
  console.log(JSON.stringify({
    appRoot: defaultStore.appRoot,
    dataDir: defaultStore.dataDir,
    state,
    status,
    cdpVersion: version,
    targets: targets.map((target) => ({
      id: target.id,
      type: target.type,
      title: target.title,
      url: target.url,
    })),
  }, null, 2));
}

async function commandSplash(options) {
  const state = await defaultStore.readState();
  const id = options.positionals[0] ?? state.activeTheme;
  if (!THEME_ID_RE.test(id)) throw new Error("主题 id 不合法");
  const result = await showSplash({ themeId: id, port: options.port });
  console.log(`启动动画已注入 ${result.theme}（${result.video ? "video" : "poster"}）`);
}

async function commandLaunch(options) {
  const state = await defaultStore.readState();
  const result = await launchCodex(defaultStore.appRoot, {
    port: state.cdpPort ?? options.port,
    restart: options.restart,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function commandPanel(options) {
  const logger = createLogger(defaultStore.logDir);
  const controller = new TerraController({
    store: defaultStore,
    port: options.port,
    logger,
  });
  let panel = null;
  if (!options.noPanel) {
    panel = createPanelServer({
      store: defaultStore,
      controller,
      port: options.panelPort,
    });
    try {
      const info = await panel.listen();
      console.log(`控制面板：${info.url}`);
    } catch (error) {
      if (error.code === "EADDRINUSE") {
        try {
          const response = await fetch(`http://127.0.0.1:${options.panelPort}/api/ping`, {
            signal: AbortSignal.timeout(2000),
          });
          const data = await response.json();
          if (data.app === "terra-studio") {
            console.log(`控制面板已经在运行：http://127.0.0.1:${options.panelPort}/`);
            return;
          }
        } catch {}
      }
      throw error;
    }
  }

  controller.start();
  logger.info(`控制器启动，CDP 端口 ${options.port}`);
  if (!options.noOpen && !options.headless && panel) {
    spawn("explorer.exe", [`http://127.0.0.1:${panel.port}/`], {
      detached: true,
      stdio: "ignore",
    }).unref();
  }

  const shutdown = async () => {
    try { controller.stop(); } catch {}
    try { if (panel) await panel.close(); } catch {}
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await new Promise(() => {});
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  switch (options.command) {
    case "panel":
      await commandPanel(options);
      break;
    case "list":
      await commandList();
      break;
    case "status":
      await commandStatus(options);
      break;
    case "apply":
      await commandApply(options);
      break;
    case "restore":
      await commandRestore(options);
      break;
    case "screenshot":
      await commandScreenshot(options);
      break;
    case "doctor":
      await commandDoctor(options);
      break;
    case "launch":
      await commandLaunch(options);
      break;
    case "splash":
      await commandSplash(options);
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      printHelp();
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`错误：${error.message}`);
  process.exitCode = 1;
});
