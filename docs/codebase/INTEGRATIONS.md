# 外部集成

## 1. 集成清单

| 系统 | 类型 | 目的 | 身份验证 | 重要性 | 证据 |
|---|---|---|---|---|---|
| OpenAI Codex MSIX | Windows 应用/AppX API | 发现 Codex 包、AUMID 并启动/重启应用 | Windows 当前用户的包注册信息；重启由用户界面确认 | 高 | `src/injector/codex-app.mjs`、`src/boot/Activation.cs` |
| Chromium CDP | 本机 HTTP + WebSocket | 连接 Codex 页面并注入主题/动画 | 仅回环地址与预期端口；筛选页面目标 | 高 | `src/injector/cdp.mjs`、`injector.mjs` |
| Terra 本机面板 | 本机 HTTP 服务 | 提供状态、主题、上传和控制 API | 每次进程启动生成随机 token；检查 Host/Origin | 高 | `src/injector/panel-server.mjs` |
| Windows 网络隔离 | `CheckNetIsolation.exe` | 为 Codex AppContainer 添加本机回环访问豁免 | UAC 管理员确认；支持撤销 | 中 | `scripts/enable-loopback.ps1`、`src/injector/codex-app.mjs` |
| 本机文件系统 | JSON/媒体文件 | 持久化状态、主题、日志和窗口位置 | 当前 Windows 用户文件目录 | 高 | `src/injector/theme-store.mjs`、`src/boot/Models.cs` |

没有数据库、消息队列、云 API、遥测 SDK 或远端身份服务。

## 2. 数据存储

| 存储 | 用途 | 访问层 | 主要注意事项 | 证据 |
|---|---|---|---|---|
| `state.json` | 当前主题和外观参数 | Node/C# ThemeStore | 两个实现都维护字段默认值；schema 修改需同步 | `src/injector/constants.mjs`、`src/boot/Models.cs` |
| `themes/<id>/theme.json` | 内置主题清单 | Node/C# ThemeStore | 两侧规范化策略略有差异 | `src/injector/theme-store.mjs`、`src/boot/Models.cs` |
| `themes/` 用户数据目录 | 面板创建的自定义主题和上传素材 | Node ThemeStore | 位于用户本机，仓库不跟踪 | `src/injector/theme-store.mjs` |
| `ready.json`、`codex-window.json` | 启动就绪状态和窗口位置 | Controller / C# ThemeStore | 属于交接运行状态 | `src/injector/controller.mjs`、`src/boot/Models.cs` |

数据根目录默认是 `%LOCALAPPDATA%\TerraStudio`；Node 可通过 `TERRA_DATA_DIR` 覆盖。

## 3. 凭据和密钥

- 当前没有外部服务凭据或 API key。
- 面板 HTTP token 使用随机字节生成，只在服务运行期间有效，并注入当前返回的面板 HTML。
- `.gitignore` 排除本地媒体和生成工具；不要将个人素材或上传日志带入仓库。

## 4. 可靠性和失败处理

- CDP 页面发现、WebSocket 命令和页面初始化都设有超时；控制器连接失败会延迟重试，页面断开后重新连接。
- 面板对 JSON、上传大小、文件扩展名/文件头和自定义主题路径做验证。
- 应用内视频超出 64 MiB 或转输失败时回退背景图；独立启动器另有海报/视频显示路径。
- 端口由另一个进程占用时，状态查询可以报告进程，但 CDP URL 还会校验回环地址、端口和页面目标类型。

## 5. 可观测性

- 主要观测方式是面板状态、`doctor` CLI 和本地文本日志。
- 没有 metrics、分布式 tracing 或远程日志上传。
- Node controller 默认日志：`%LOCALAPPDATA%\TerraStudio\logs\controller.log`；C# 启动器：`boot.log`。

## 6. 证据

- `src/injector/codex-app.mjs`
- `src/injector/cdp.mjs`
- `src/injector/panel-server.mjs`
- `src/injector/theme-store.mjs`
- `src/boot/Activation.cs`
- `scripts/enable-loopback.ps1`
