# 代码约定

## 1. 命名

| 对象 | 观察到的约定 | 示例 | 证据 |
|---|---|---|---|
| Node 文件 | 小写/kebab-case，后缀 `.mjs` | `theme-store.mjs` | `src/injector/` |
| JS 函数与变量 | camelCase | `applyTheme`、`defaultStore` | `src/injector/injector.mjs`、`theme-store.mjs` |
| JS 常量 | 全大写加下划线；枚举集合使用大写名字 | `DEFAULT_CDP_PORT`、`BOOT_MODES` | `src/injector/constants.mjs` |
| C# 类型和方法 | PascalCase | `BootWindow`、`LoadState()` | `src/boot/BootWindow.cs`、`Models.cs` |
| C# 私有字段和局部变量 | camelCase | `savedPlacement`、`logger` | `src/boot/BootWindow.cs` |
| 主题 ID | 小写字母/数字/连字符 | `zhuang-fangyi` | `themes/zhuang-fangyi/theme.json`、`constants.mjs` |

## 2. 格式化和静态检查

- JavaScript 源码通常使用双引号、分号和两个空格缩进；C# 使用四空格缩进和大括号代码块。
- 没有仓库级格式化器、linter 配置、`.editorconfig` 或 CI 检查。上面的格式是从现有源码观察到的习惯，不是自动强制规则。
- 现有命令：`npm run build`。没有 `npm run lint` 或 `npm run test`。

## 3. 导入与模块

- Node 源码先导入 `node:*` 内置模块，再以空行分隔相对路径项目模块。
- 模块使用 ES module named export；未发现 barrel export 或项目路径 alias。
- 面板使用原生 `<script src="/app.js">`，不使用前端打包器。

## 4. 错误与日志

- Node 边界通常抛出 `Error`；CLI 顶层捕获并打印 `错误：...`，HTTP API 将失败序列化为 JSON 错误响应。
- 控制器通过 `createLogger()` 输出 INFO/WARN/ERROR，日志包含 ISO 时间；C# logger 使用本地时间和级别标签。
- 日志分别写入 `%LOCALAPPDATA%\TerraStudio\logs\controller.log` 与 `boot.log`，约 2 MiB 后保留一份 `.1`。
- 现有日志代码未定义统一的敏感字段脱敏策略；新增日志不要写入用户主题图片、令牌或完整上传内容。

## 5. 测试约定

- 仓库未发现 Node/C# 自动化测试文件、测试框架或 mock 配置。
- 启动器有 `TerraBoot.exe --self-test`，用于校验主题清单和外部素材/交接关键帧；它不是独立的单元测试套件。
- 暂无覆盖率阈值或 CI 测试规则。

## 6. 证据

- `src/injector/constants.mjs`
- `src/injector/cli.mjs`
- `src/injector/logger.mjs`
- `src/boot/Logger.cs`
- `src/boot/Program.cs`
- `package.json`
