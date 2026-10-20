# 架构与运行流程

## 1. 架构风格

- **主要结构：** 两条相互协作的 Windows 启动路径，以及按职责拆分的 Node ES module 控制器。
- **依据：** C# 负责应用激活和窗口动画；Node 负责本机 HTTP、状态存储和 CDP 注入；静态面板通过 HTTP API 调用 Node。
- **主要约束：** 仅面向 Windows Codex MSIX；注入依赖本机 CDP 和 Codex 当前 DOM；主题/状态分别由 C# 与 Node 代码读取。

## 2. 主要数据流

```text
ArknightsPRTS.exe / Node CLI
        -> Windows 启动或连接 Codex（CDP 9341）
        -> Node 控制器读取 state.json 和 theme.json
        -> CDP 注入 CSS、装饰 DOM 和主题切换入口
        -> 本机面板 API 写状态并请求控制器应用/恢复主题
```

1. `Program.Main` 读取运行状态和主题清单；`CodexActivation` 查询 MSIX 包并通过 AppX Activation Manager 启动 Codex，参数包含回环地址和 CDP 端口。
2. 默认路径把启动动画覆盖层注入 Codex 页面；`--external` 使用独立 WPF 窗口，并根据 Codex 窗口尺寸/位置完成交接。
3. `cli.mjs panel` 创建 `TerraController` 和本机 `PanelServer`。控制器轮询 CDP 页面目标，打开 WebSocket 会话并检查 Codex 主页面。
4. `injector.mjs` 使用 `skin-css.mjs` 生成样式和页面控件，经 CDP 执行；控制器注册页面 binding 以接收换主题和还原命令。
5. 面板 `app.js` 使用运行时 token 调用 `/api/*`；`panel-server.mjs` 更新 `ThemeStore` 或控制器，再把状态回传给页面。
6. 控制器监控连接和皮肤状态，页面刷新或连接断开时尝试修复/重连；状态和用户主题写入本地数据目录。

## 3. 模块职责

| 模块 | 拥有的职责 | 不拥有的职责 | 证据 |
|---|---|---|---|
| 启动器 | MSIX 激活、进程与窗口管理、独立启动动画、保存窗口位置 | 面板 API | `src/boot/Program.cs`、`Activation.cs`、`BootWindow.cs` |
| CDP 适配 | 枚举/筛选页面目标、WebSocket 请求与超时 | 主题 JSON 持久化 | `src/injector/cdp.mjs` |
| 控制器 | 重连、应用主题、响应页面 binding、定时状态刷新 | 浏览器 UI 布局 | `src/injector/controller.mjs` |
| 主题存储 | 校验 manifest、解析内置和自定义目录、维护 state | Codex DOM 操作 | `src/injector/theme-store.mjs` |
| 面板服务器 | 本地 HTTP、静态文件、API、上传验证 | CDP 协议细节 | `src/injector/panel-server.mjs` |
| 面板客户端 | 用户交互、显示状态、构造上传 | 本机文件路径访问 | `panel/app.js` |
| 素材生成器 | 从本机图源生成图片和视频 | 运行期注入 | `tools/gen/render-posters.mjs`、`render-motion.mjs` |

## 4. 重复使用的模式

| 模式 | 位置 | 用途 |
|---|---|---|
| Store/Repository 风格 | `createThemeStore()`、C# `ThemeStore` | 把状态、主题和素材文件访问集中管理 |
| Adapter / 协议封装 | `CdpSession` | 把 CDP WebSocket 命令、事件、超时封装成会话接口 |
| 监督循环与重试 | `TerraController.connectLoop()`、`scheduleReconnect()`、`startPolling()` | 处理 Codex 页面晚启动、导航和连接中断 |
| 原子状态写入 | `writeJsonAtomic()`、C# `ThemeStore.WriteJson()` | 临时文件写完后替换状态文件 |

## 5. 已知架构风险

- Node 和 C# 各有主题/状态模型与校验代码；修改 schema 时需同步两侧，避免两种启动路径表现不同。
- 注入效果使用 Codex 内部 DOM 选择器，Codex 更新可能改变页面结构。
- UI 注入与启动动画依赖 CDP；回环设置、端口占用或页面目标变化会影响整条流程。
- `skin-css.mjs`、`BootWindow.cs` 等文件承担较多绘制/交接逻辑，改动应围绕相关功能小范围进行。

## 6. 证据

- `src/boot/Program.cs`
- `src/boot/Activation.cs`
- `src/injector/controller.mjs`
- `src/injector/injector.mjs`
- `src/injector/theme-store.mjs`
- `src/injector/panel-server.mjs`
- `panel/app.js`
