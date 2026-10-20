# 测试现状

## 1. 测试框架与命令

- Node 测试框架：未配置。
- C# 单元测试框架：未配置。
- npm `test`、coverage 和 lint 脚本：未配置。
- 构建后的启动器有 `--self-test` 参数，但它是应用内自检，不是独立测试工程。

```powershell
# 源码提供的构建入口
npm run build

# 启动器构建成功后，可执行的主题/素材自检
build\app\TerraBoot.exe --self-test

# 运行期人工诊断入口
npm run doctor
npm run list
```

`--self-test` 会读取当前构建目录中的主题清单，检查不同 boot 模式所需的视频、海报和 handoff 关键帧。由于媒体素材被 Git 忽略，刚从 GitHub 克隆的工作区可能需要先准备素材，否则这些缺失资源会被报告出来。

## 2. 测试文件布局

- 没有发现 `tests/`、`__tests__/`、`*.test.*` 或 `*.spec.*` 测试文件。
- `src/boot/Program.cs` 中的 `SelfTest.Run()` 是唯一发现的代码内自检入口。
- 没有测试初始化文件、fixture 或 fake 服务配置。

## 3. 覆盖范围

| 范围 | 当前覆盖 | 目标 | 说明 |
|---|---|---|---|
| 单元测试 | 否 | Node 主题 schema、路径/上传校验；C# 状态和主题模型 | 未找到自动化套件 |
| 集成测试 | 部分手动诊断 | Codex MSIX、CDP、loopback、HTTP 面板 | `doctor` 只采集当前环境状态，不断言成功标准 |
| 启动器自检 | 有限 | 主题媒体和 handoff 帧配置 | `TerraBoot.exe --self-test` |
| 端到端测试 | 未配置 | 启动、换肤、还原、卸载和主题创建 | 需要真实 Windows/Codex 环境 |

## 4. Mock 与隔离

没有测试 mock、DI fixture 或网络模拟策略。运行期 `createThemeStore(options)` 接受路径参数，能够在代码层面构造独立目录，但仓库没有相应测试调用。

## 5. 覆盖和质量信号

- 覆盖率工具/门槛：未配置。
- CI 测试执行：未发现 GitHub Actions 或其他 CI 配置。
- 本次文档工作只做静态源代码核对，没有构建项目或运行 `--self-test`；不能据此推断本机运行链路通过。
- 易受环境影响的部分是 MSIX 激活、UAC 回环设置、CDP 端口和本机主题媒体。

## 6. 证据

- `package.json`
- `src/boot/Program.cs`（`SelfTest.Run`）
- `scripts/build.ps1`
- `src/injector/cli.mjs`
- `.gitignore`
