# 技术栈

## 1. 运行环境概览

| 项目 | 采用方案 | 证据 |
|---|---|---|
| 主要语言 | C# 与 JavaScript（ES modules）；面板使用 HTML/CSS/原生 JavaScript | `src/boot/`、`src/injector/`、`panel/` |
| Node 运行时 | Node.js >= 22 | `package.json` 的 `engines.node` |
| 启动器运行时 | .NET Framework 4.8、Windows x64 | `src/boot/app.config`、`scripts/build.ps1` |
| 包管理 | npm scripts；无运行时第三方 npm 依赖 | `package.json`；Node 源码只导入 `node:*` 和本项目模块 |
| 构建 | PowerShell 调系统 `csc.exe` 编译 C#，复制静态面板和 Node 源码 | `scripts/build.ps1` |
| 目标平台 | Windows + OpenAI Codex MSIX 应用 | `src/injector/codex-app.mjs`、`src/boot/Activation.cs` |

## 2. 运行时框架与依赖

| 依赖/平台组件 | 作用 | 证据 |
|---|---|---|
| Node.js 内置模块 | CDP WebSocket、HTTP 面板、文件和进程操作 | `src/injector/*.mjs` 的 `node:*` 导入 |
| .NET Framework WPF / Windows Forms / Win32 API | 启动动画窗口、窗口定位、MSIX 激活和系统交互 | `scripts/build.ps1` 引用列表、`src/boot/BootWindow.cs`、`src/boot/Native.cs` |
| 浏览器 DOM / CSS | 控制面板 UI 和 Codex 渲染页面内的主题注入 | `panel/`、`src/injector/injector.mjs`、`src/injector/skin-css.mjs` |
| PowerShell / Windows AppX API | 查询 Codex 包、端口、进程和回环豁免 | `src/injector/codex-app.mjs`、`scripts/enable-loopback.ps1` |

项目没有 `dependencies`、`devDependencies`、测试框架或第三方运行时包。

## 3. 开发工具链

| 工具 | 用途 | 证据 |
|---|---|---|
| Windows PowerShell | 构建和系统管理脚本 | `scripts/build.ps1`、`scripts/enable-loopback.ps1` |
| .NET Framework `csc.exe` | 编译 x64 `TerraBoot.exe` | `scripts/build.ps1` |
| Chrome 或 Edge | 仅素材生成期无头渲染 | `tools/gen/render-posters.mjs`、`tools/gen/render-motion.mjs` |
| ffmpeg / ffprobe | 仅素材生成期编码/转换媒体 | `tools/gen/README.md`、`tools/gen/render-*.mjs` |

仓库没有 ESLint、Prettier、`.editorconfig` 或 CI 配置。

## 4. 常用命令

```powershell
npm run build
npm run panel
npm run doctor
npm run list
npm run status
npm run restore
```

生成器命令为 `npm run gen:posters`、`npm run gen:motion`、`npm run gen:videos`；前两者需要本地素材和生成工具。`package.json` 没有 `test` 或 `lint` 脚本。

## 5. 环境与配置

- `config/state.example.json` 给出状态结构示例；运行时实际状态在 `%LOCALAPPDATA%\TerraStudio\state.json`。
- Node 可选环境变量：`TERRA_APP_ROOT`、`TERRA_DATA_DIR`、`TERRA_DEBUG`；素材生成器使用 `CHROME_PATH`、`TERRA_MOTION_DURATION`、`TERRA_MOTION_OUT`、`TERRA_MOTION_SCALE`、`TERRA_MOTION_AUDIO`、`TERRA_MOTION_CRF`。
- 没有 `.env.example`；上述环境变量均有代码默认值，不要求秘密凭据。
- 默认端口为 CDP `9341`、面板 `9342`；运行设置可在 `state.json` 中持久化。
- 构建输出位于被忽略的 `build/app/`；本机 Node 若位于非默认位置，可确保 `node.exe` 在 `PATH` 中。

## 6. 证据

- `package.json`
- `scripts/build.ps1`
- `src/boot/app.config`
- `src/injector/constants.mjs`
- `src/injector/theme-store.mjs`
- `tools/gen/README.md`
