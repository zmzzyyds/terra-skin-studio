# 风险与维护事项

## 1. 优先关注

| 优先级 | 事项 | 证据 | 影响 | 建议 |
|---|---|---|---|---|
| 中 | CDP 为本机 Codex 渲染页面提供调试控制能力 | `src/injector/cdp.mjs`、`src/boot/Activation.cs` | 若调试端口被转发或暴露，会扩大本机应用控制面 | 保持 CDP 只绑定回环地址；不对局域网或公网转发端口 |
| 中 | Codex DOM 选择器可能随上游更新变化 | `src/injector/skin-css.mjs`、`injector.mjs` | 页面内部布局变化会让背景、透明度或装饰显示不完整 | Codex 更新后运行 `doctor` 并检查关键页面，再调整选择器 |
| 中 | 主题/状态 schema 在 C# 和 Node 中有两份实现 | `src/boot/Models.cs`、`src/injector/theme-store.mjs` | 同一份配置可能在两条运行路径被不同地规范化 | 修改配置字段时同步检查两侧；考虑后续共用 schema/样例验证 |
| 中 | 自动化测试和 CI 缺失 | `package.json`、仓库没有 CI 配置 | 纯逻辑改动也可能要等真实 Codex 环境才能发现回归 | 先为 schema、路径和状态迁移补充离线检查，再定义发布前手动清单 |
| 低 | 启动器与样式生成文件较大 | `src/boot/BootWindow.cs`（约 1,200 行）、`src/injector/skin-css.mjs`（约 750 行） | 局部功能交织，修改动画或 CSS 时可能影响相关状态 | 保持小范围修改；把新行为拆到独立函数或模块 |

## 2. 技术债务

| 债务 | 成因/现状 | 位置 | 风险 | 建议 |
|---|---|---|---|---|
| 两份主题配置校验模型 | 启动器和控制器是两个运行时，分别反序列化/规范化 JSON | `src/boot/Models.cs`、`src/injector/theme-store.mjs` | 接受的配置范围逐渐不一致 | 修改字段时维护一份 schema 对照表，并用同一组 JSON 样例验证两端 |
| 自检替代不了端到端验证 | `--self-test` 只覆盖主题文件和部分 handoff 条件 | `src/boot/Program.cs` | 无法证明真实 CDP 注入、切换或还原成功 | 维护者发布前按真实 Windows/Codex 手动检查完整流程 |
| Git 历史尚浅 | 仓库目前只有少量提交，绝大多数代码一次性引入 | `git log`（最近提交） | 不能可靠地从 churn 识别稳定/高风险模块 | 随后续变更再根据历史热点更新本节 |

## 3. 安全注意事项

| 风险 | 类别 | 当前缓解措施 | 剩余边界 | 证据 |
|---|---|---|---|---|
| 本机 CDP 端口可执行页面调试命令 | 本地权限边界 | 启动参数使用 `127.0.0.1`；客户端要求 WebSocket host/port 与页面路径匹配；查询端口所有者 | 不应将 CDP 端口暴露到 LAN、代理或公网 | `src/boot/Activation.cs`、`src/injector/cdp.mjs`、`codex-app.mjs` |
| 本机面板可启动/重启 Codex 和写入主题 | 本机 API | 监听 `127.0.0.1`、生成随机 token、校验 Host/Origin、限制上传类型/大小并检查文件头 | 假设机器上的本地用户进程可信；服务不是远程多用户面板 | `src/injector/panel-server.mjs` |
| 回环豁免修改 Windows AppContainer 设置 | 系统配置 | 指定 Codex package family name；通过 UAC 提权；提供 `-Remove` | 用户需知晓该系统设置并可在卸载时撤销 | `scripts/enable-loopback.ps1`、`scripts/uninstall.ps1` |
| 本地媒体源与公开仓库内容混淆 | 分发边界 | `.gitignore` 忽略主题 `art/`、背景/海报/预览和视频 | 克隆者不会自动得到这些素材；维护者需继续审查 staged 文件 | `.gitignore`、`themes/README.md` |

## 4. 性能与扩展

| 事项 | 当前行为 | 扩展影响 | 建议 |
|---|---|---|---|
| 启动视频传输 | 应用内视频以 base64 分块经 CDP 写入页面，最大 64 MiB | 大视频会增加内存和 CDP 启动延迟 | 继续限制内嵌大小；超大媒体使用独立窗口模式 |
| 状态/页面轮询 | controller 每约 2.5 秒检查皮肤与 ready 状态，状态刷新每 5 秒 | 单机桌面场景可控，不适合多用户/远程服务扩展 | 若拓展为常驻服务，改成事件驱动并重新审视授权边界 |
| 主题扫描 | 启动或刷新时遍历内置和自定义目录并读取 JSON/素材存在状态 | 主题规模增大时会增加目录扫描和磁盘访问 | 目前数量较少；只有规模增长后再添加缓存 |

## 5. 脆弱区域与历史变化

最近 Git 历史只有少数提交；当前样本不足以判断哪些源文件是持续高 churn 区域。扫描结果中的巨大文件主要是本机被忽略的媒体/渲染素材，不应当作源码复杂度指标。

| 区域 | 脆弱原因 | 历史信号 | 安全修改方式 |
|---|---|---|---|
| `src/injector/skin-css.mjs` | 大段 CSS 与 Codex 内部选择器、胶囊交互共处 | 历史不足 | 分别核对主题 CSS、appearance 和 cleanup 行为 |
| `src/boot/BootWindow.cs` | 包含窗口、媒体播放、键盘和动画交接状态 | 历史不足 | 保持 UI 状态转换可追踪，手动验证跳过/结束/回退 |
| `src/injector/theme-store.mjs` 与 `src/boot/Models.cs` | 重复解析同一主题/状态格式 | 历史不足 | 对照两个模型和 `themes/_template/theme.json` |

## 6. [ASK USER] 问题

- 当前没有需要补充团队意图才能准确描述代码行为的问题；范围由当前源码与现存配置确定。

## 7. 证据

- `.gitignore`
- `package.json`
- `src/injector/cdp.mjs`
- `src/injector/panel-server.mjs`
- `src/injector/controller.mjs`
- `src/injector/skin-css.mjs`
- `src/injector/theme-store.mjs`
- `src/boot/Activation.cs`
- `src/boot/BootWindow.cs`
- `src/boot/Models.cs`
- `src/boot/Program.cs`
- `git log -6 --oneline`
