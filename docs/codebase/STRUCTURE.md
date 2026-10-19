# 代码库结构

## 1. 顶层目录与文件

| 路径 | 用途 | 证据 |
|---|---|---|
| `src/boot/` | C# 启动器、窗口与 Windows 集成 | `src/boot/Program.cs`、`Activation.cs`、`BootWindow.cs` |
| `src/injector/` | Node CLI、CDP、主题存储、控制器、HTTP API 和注入脚本 | `src/injector/cli.mjs`、`controller.mjs`、`panel-server.mjs` |
| `panel/` | 本地面板页面、交互逻辑和样式 | `panel/index.html`、`app.js`、`style.css` |
| `themes/` | 内置主题清单、主题模板和主题作者说明 | `themes/_template/theme.json`、`themes/README.md` |
| `config/` | 示例状态 JSON | `config/state.example.json` |
| `scripts/` | 构建、启动、关闭、回环配置与卸载脚本 | `scripts/*.ps1`、`scripts/start.bat` |
| `tools/gen/` | 仅构建期使用的海报和视频生成脚本 | `tools/gen/README.md`、`render-*.mjs` |
| `docs/` | 使用者指南与代码库说明 | 本目录 |
| `package.json` | Node 版本要求和命令入口 | `package.json` |
| `LICENSE` | MIT 许可证文本 | `LICENSE` |

本机还可能有 `.gitignore` 排除的 `build/`、`tmp/`、媒体素材和工具二进制。这些不是可移植的源码依赖。

## 2. 入口点

- 启动器主入口：`src/boot/Program.cs` 中的 `Main`；编译产物为 `TerraBoot.exe`。
- Node CLI：`src/injector/cli.mjs`；`package.json` 的 `list/status/doctor/apply/restore/panel/screenshot` 等脚本指向该文件。
- 面板页面：`panel/index.html`，载入 `app.js` 和 `style.css`。
- 构建入口：`scripts/build.ps1`，`npm run build` 调用它。
- 用户启动包装：`scripts/start.bat` 指向构建目录内的 `TerraBoot.exe`。

## 3. 模块边界

| 模块 | 负责 | 不应承担的职责 | 证据 |
|---|---|---|---|
| `src/boot/` | Windows 启动、窗口交接、MSIX 激活 | 不负责主题 CSS 生成 | `Program.cs`、`BootWindow.cs` |
| `src/injector/` | 读取状态/主题、管理 CDP、注入与恢复、提供本机 API | 不负责生成主题视频 | `controller.mjs`、`injector.mjs`、`panel-server.mjs` |
| `panel/` | 调用面板 API、显示主题和状态、采集用户输入 | 不直接连接 CDP 或读写磁盘主题目录 | `panel/app.js`、`panel-server.mjs` |
| `themes/` | 主题清单及本地主题资源 | 不存储运行状态和用户设置 | `theme.json`、`theme-store.mjs` |
| `tools/gen/` | 生成海报、背景和动画文件 | 不参与应用运行时 | `tools/gen/README.md`、`package.json` |

## 4. 命名和组织方式

- Node 模块使用 `.mjs`，文件名以小写或 kebab-case 为主，例如 `theme-store.mjs`、`panel-server.mjs`。
- C# 源文件使用 PascalCase，例如 `BootWindow.cs`、`Activation.cs`。
- 主题目录和 ID 使用小写字母、数字及连字符，例如 `zhuang-fangyi`。
- Node 模块以相对路径直接导入，没有 TypeScript 路径别名或 barrel export。

## 5. 证据

- `package.json`
- `scripts/build.ps1`
- `src/boot/Program.cs`
- `src/injector/cli.mjs`
- `panel/index.html`
- `themes/_template/theme.json`
