# 快速开始

## 项目做什么

Arknights PRTS 为 Windows 版 OpenAI Codex Desktop 注入主题样式，并提供启动动画和本机控制面板。它通过 Codex 的 Chromium DevTools Protocol（CDP）连接运行中的界面；启动器不会改写 Codex 安装目录。

## 环境要求

| 用途 | 要求 | 依据 |
|---|---|---|
| 目标应用 | 已安装的 Microsoft Store / MSIX `OpenAI.Codex` | `src/injector/codex-app.mjs` 查询 `Get-AppxPackage -Name OpenAI.Codex` |
| Node.js | 22 或更新版本 | `package.json` 的 `engines.node` |
| 构建启动器 | Windows PowerShell 和 .NET Framework 4.8 x64 编译器 `csc.exe` | `scripts/build.ps1`、`src/boot/app.config` |
| 素材生成（可选） | Chrome 或 Edge、`tools/gen/bin/ffmpeg.exe`；旧视频脚本还会用到 `ffprobe.exe` 和 Consolas | `tools/gen/README.md`、`tools/gen/render-*.mjs` |

Node 控制器使用 Node 内置模块；项目没有运行时 npm 依赖，也没有 `package-lock.json`。普通构建不需要执行 `npm install`。现有动画和背景素材不随本次品牌改名改动。

## 从源码构建并启动

在项目根目录打开 PowerShell：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build.ps1
```

产物在 `build\app\`。构建脚本用系统自带的 .NET Framework 编译器生成 `ArknightsPRTS.exe`，并复制控制面板、Node 控制器、主题配置和相关脚本。脚本会尝试从 `%ProgramFiles%\nodejs\node.exe` 复制 Node；若不存在，运行时需要从 `PATH` 找到 `node.exe`。

首次注入前，为商店版 Codex 添加一次本机回环豁免。可从源码目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\enable-loopback.ps1
```

也可在构建后执行 `build\app\scripts\enable-loopback.ps1`。该步骤会请求一次 UAC 管理员确认；只对 Codex MSIX 包添加豁免。查询状态用 `-Status`，撤销用 `-Remove`。

启动方式：

```text
build\app\启动PRTS.bat
```

或直接运行 `build\app\ArknightsPRTS.exe`。启动器会通过 CDP 启动或连接 Codex，并尝试播放应用内动画。若 Codex 已经运行但没有调试端口，启动器会询问是否关闭并重启；关闭应用可能丢失未发送的输入，请先保存。

## 打开控制面板

双击 `build\app\打开PRTS控制面板.bat`，或在浏览器打开：

```text
http://127.0.0.1:9342/
```

面板可切换主题、创建自定义主题、调整外观、启动或重启 Codex、还原官方界面、查看日志。控制面板服务默认只监听本机回环地址。

## 日常操作

- 点击面板主题卡片，或使用 Codex 窗口内的 `PRTS` 主题胶囊切换主题。
- 面板的“外观参数”可调节透明度、背景清晰度、深色/纸白风格、文字可读性、启动动画和静音选项。
- “还原原生界面”会移除注入的样式；控制器和面板仍可运行，之后可再次应用主题。
- 完整主题编辑说明见[制作主题](THEMES.md)。

## 开发命令

在项目根目录运行：

| 命令 | 用途 |
|---|---|
| `npm run build` | 调用 `scripts/build.ps1` 构建 Windows 启动器 |
| `npm run panel` | 在源码目录启动控制器和面板 |
| `npm run list` | 列出主题和素材可用情况 |
| `npm run status` | 查看本机 Codex、CDP 和回环状态 |
| `npm run doctor` | 输出诊断信息，包括应用包、端口和 CDP 页面目标 |
| `npm run apply -- si` | 一次性给指定主题注入样式；刷新后不保证保留 |
| `npm run restore` | 通过 CDP 还原官方界面 |
| `npm run screenshot -- --out logs\shot.png` | 截取当前 Codex 页面 |

`build/` 是生成目录并被 Git 忽略。请修改 `src/`、`panel/`、`themes/` 等源文件，再重新构建；直接改 `build/app/` 会在下次构建时被覆盖。

## 本机数据位置

运行数据默认写入 `%LOCALAPPDATA%\ArknightsPRTS\`。首次升级前先退出旧版控制面板/控制器；新版本启动时会将已有 `%LOCALAPPDATA%\TerraStudio\` 目录迁移到这里。若迁移遇到文件占用或权限问题，程序会继续使用旧目录以保留现有数据：

- `state.json`：主题、外观、端口等设置。
- `themes\`：面板创建的自定义主题。
- `logs\controller.log`、`logs\boot.log`：控制器和启动器日志。
- `ready.json`、`codex-window.json`：启动交接状态和窗口位置。
- `tmp\`：面板上传时的临时文件。

卸载脚本默认保留这些数据。只有明确要删除自定义主题和日志时，才使用 `scripts\uninstall.ps1 -RemoveData`。
