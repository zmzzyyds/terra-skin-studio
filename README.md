# Terra Skin Studio · 泰拉换肤工作室

> 启动器/批处理仍沿用「泰拉终端 / Terra Terminal」名称；项目发布名为 **Terra Skin Studio**。

给 **OpenAI Codex Desktop（Windows 商店版）** 做的一套《明日方舟 / 明日方舟：终末地》主题工作室：

- **启动动画**：默认**直接注入 Codex 窗口内部**。启动/前置 Codex 后，通过 CDP 在它的渲染进程里盖一层主题启动短片（内置 10 秒 1080p30 `splash.mp4`；自定义视频不限时长、仅限 64MB），播完平面擦除，露出已经换好肤的 Codex；不再是另开一个视频窗口。需要独立 16 秒 1080p 动画窗口时用 `TerraBoot.exe --external`；
- **应用内换肤**：角色居中的背景、配色、透视色带、警戒条、HUD 装饰、右下角主题胶囊；无网格；
- **一键切换**：控制面板点卡片即换；Codex 内点胶囊也能换；
- **自定义主题**：上传 JPG/PNG/WebP 背景（浏览器内裁切压缩到 1920×1080），可选 MP4 启动动画；
- **可逆**：不改 `app.asar`、不替换快捷方式、不注册开机自启；一键还原官方界面，卸载可撤销回环豁免。

内置主题配置：**祀**、**庄方宜**（终末地），**澄闪**、**黍**（明日方舟）。

> 非官方项目，与 OpenAI / 鹰角网络无隶属关系。官方立绘仅本机自用，不随仓库分发，详见 [NOTICE.md](NOTICE.md) 与 [ASSET_SOURCES.md](ASSET_SOURCES.md)。

## 素材说明（公开仓库必读）

这个仓库只包含**代码、主题配置和教程**，不包含任何官方角色立绘、官方视频或由它们合成的背景/启动动画。

- 四套内置主题的 `theme.json` 会随仓库提供，但 `hero.jpg`、`splash.mp4`、`boot.mp4` 等素材需要你自行准备；
- 没有素材时，主题仍可应用颜色/几何装饰，但不会有角色背景；启动动画需要你提供视频或 `hero.jpg` 作为海报回退；
- 最简单的做法是用控制面板的 **“自定义主题”**：上传你自己的 JPG/PNG/WebP 背景和可选 MP4，不需要重新构建；
- 想用四套内置主题的配色/装饰：把 `themes/<id>/hero.jpg`（1920×1080）和 `themes/<id>/splash.mp4`（1080p，≤64MB，不限时长）放进去，再重新构建；
- 也可以放 `themes/<id>/art/source.png`，用 `tools/gen/render-posters.mjs` / `render-motion.mjs` 生成素材；原图必须是你自己绘制、委托创作或明确授权的；
- 不要把你本机的官方立绘或衍生素材提交到公开仓库；`.gitignore` 已排除 `themes/*/art/`、`hero.*`、`poster.*`、`preview.*`、`boot.mp4`、`splash.mp4`。

## 第一次使用（完整流程）

1. **确认环境**：Windows 11、商店版 OpenAI Codex Desktop、.NET Framework 4.8、Node.js 22+、PowerShell；
2. **构建**：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build.ps1`，产物在 `build\app\`；
3. **回环豁免**：运行 `build\app\scripts\enable-loopback.ps1`，UAC 点“是”（只需一次）；
4. **启动**：双击 `build\app\泰拉终端.bat`，或运行 `build\app\TerraBoot.exe`；
5. **打开面板**：双击 `build\app\打开控制面板.bat`，或浏览器打开 `http://127.0.0.1:9342/`；
6. **先建一个自己的主题**：面板 → 自定义主题 → 选背景图 → “从背景图取色” → 可选 MP4 → 创建并应用；
7. **日常切换**：面板点主题卡，或 Codex 右下角 `TERRA // 主题名` 胶囊。

> 想先看内置四套主题的颜色/装饰，可以点它们的卡片；要看到角色背景和启动动画，请先按上面的“素材说明”放入自己的素材。

## 已验证环境

| 项目 | 版本 |
| --- | --- |
| Windows | 11（26200） |
| Codex Desktop | MSIX `OpenAI.Codex_26.1013.4894.0_x64__2p2nqsd0c76g0` |
| AUMID | `OpenAI.Codex_2p2nqsd0c76g0!App` |
| .NET Framework | 4.8（Windows 自带，`csc.exe` 编译） |
| Node.js | 24（构建时复制 `node.exe`，运行不要求全局安装） |
| 显示 | 1920×1080 / 100% DPI 实测；代码按 PerMonitorV2 + 物理像素处理 |

## 快速开始

### 1. 构建

在项目根目录：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build.ps1
```

产物在 `build\app\`：

- `TerraBoot.exe`：默认启动/前置 Codex 并注入应用内启动动画；`--external` 走旧的独立 WPF 动画 + DWM 交接；
- `node\cli.mjs`：CDP 控制器；
- `panel\`：控制面板静态页；
- `themes\`：四套内置主题配置（官方素材/视频需自备，仓库不包含）；
- `runtime\node.exe`：构建时从本机 Node 24 复制（找不到时回退 PATH 里的 `node`）；
- `泰拉终端.bat`、`打开控制面板.bat`、`open-panel.ps1`。

不需要 .NET SDK，Windows 自带的 .NET Framework 4.8 编译器即可。

### 2. 一次性添加回环豁免

商店版 Codex 在 AppContainer 里，默认不允许本机进程连它的 CDP 端口。运行一次：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File build\app\scripts\enable-loopback.ps1
```

或在面板点“启用回环豁免”。会弹一次 UAC。撤销：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File build\app\scripts\enable-loopback.ps1 -Remove
```

### 3. 启动

```text
双击 build\app\泰拉终端.bat
```

流程：带 `--remote-debugging-port=9341` 启动/复用 Codex → 把 Codex 窗口前置一次（否则 Chromium 会把后台页面里的视频暂停）→ 通过 CDP 向 Codex 页面注入 `splash.mp4` 全窗遮罩 → 皮肤在遮罩后注入 → 短片**完整播完**（内置 10 秒；自定义视频不限时长）后**等皮肤注入完成**再平面擦除，避免先露出未换肤的加载界面 → 进入已换肤的 Codex。窗口沿用上一次 `codex-window.json` 的位置和大小。

- `Esc` 跳过动画；
- 应用内短片默认静音（浏览器自动播放策略）；独立 `--external` 动画保留声音和 `M` 静音键；
- 如果 Codex 已经在运行但没有调试端口，启动器会弹窗询问是否关闭并重启 Codex（未保存的输入可能丢失）。选“是”后启动器会关闭旧实例、带 CDP 重启，再播放应用内动画；如果商店版驻留托盘不响应正常关闭，启动器会在你已同意重启的前提下结束它的 GUI 进程。选“否”则无法注入应用内动画；需要独立动画窗口时用 `--external`。

### 4. 打开控制面板

```text
双击 build\app\打开控制面板.bat
```

或浏览器打开 <http://127.0.0.1:9342/>。面板会自动拉起控制器（即使当前是“原生界面”也会保留面板）。

### 控制面板按钮

- **启动 Codex**：打开/前置 Codex（启动时强制置顶一次，不再反复抢焦点）；在 Codex 窗口内部播放当前主题启动动画，随后进入已换肤界面；
- **重启并应用**：先正常关闭 Codex；商店版驻留托盘不响应时，强制结束 Codex 的 GUI 及残留的 `codex.exe`/CUA 辅助进程，等旧 CDP 9341 端口释放后再带 CDP 重启；重启后在 Codex 窗口内播放当前主题启动动画，动画结束前会等皮肤注入完成；
- **还原原生界面**：只移除注入样式和装饰，控制器/面板继续运行，点任意主题卡片即可重新应用。

## 日常使用

### 换主题

- 面板里点主题卡片 → 立即应用；
- Codex 右下角 `TERRA // 主题名` 胶囊是 **Codex 内的快捷换肤入口**（不是启动器）→ 展开主题列表 → 点一下切换；
- 胶囊菜单里的“隐藏”会收起入口；在面板点“显示主题胶囊”，或在 Codex 里按 `Ctrl+Shift+T` 恢复；
- “还原原生”会移除注入的样式和装饰，Codex 恢复官方界面。

### 自定义主题

面板 → “自定义主题” → 展开：

1. 填名称、副标题、系列、装饰；
2. 先选背景图（JPG/PNG/WebP）；
3. 点 **“从背景图取色”**，自动填主色/辅色/表面/文字，再手动微调；
4. 可选选一个 MP4 作为启动动画；应用内**只限制 64MB 体积，不限制时长**（分块传输）。超过 64MB 时会回退为主题背景图 + 主题色的海报式启动画面（独立 `--external` 仍可播放完整视频）；
5. “创建并应用”。

图片在浏览器里用 canvas 裁切到 1920×1080、JPEG 0.86 质量后再上传，原图不会上传；MP4 会原样复制到自定义主题目录。

自定义主题保存到：

```text
%LOCALAPPDATA%\TerraStudio\themes\custom-<slug>-<hash>\
```

内置主题在 `build\app\themes\`，只读，不会被面板修改。仓库只包含它们的 `theme.json`；角色背景和视频需要按“素材说明”自行放入源 `themes/<id>/` 后再构建。

#### 替换动画/背景后，颜色和四套预设不一致怎么办

- 四套内置主题只是预设；自定义主题是**第 5 张卡**，颜色和四套完全独立；
- 先选新背景图，再点“从背景图取色”，主题色会自动跟图走；
- **MP4 的颜色是烧在视频里的**，主题色只影响 Codex 应用内 UI：
  - 有颜色匹配、体积 ≤64MB 的 MP4：直接上传，应用内原样播放；
  - 没有匹配的 MP4，或视频 >64MB：应用内启动回退为主题背景图 + 主题色的海报式画面；独立 16 秒版仍可把视频放到 `boot.mp4` 后用 `--external`；
  - 想给内置主题生成 10 秒 1080p 应用内版本：`TERRA_MOTION_DURATION=10 TERRA_MOTION_OUT=splash.mp4 TERRA_MOTION_AUDIO=0 TERRA_MOTION_CRF=27 node tools\gen\render-motion.mjs <主题id>`（不设 `TERRA_MOTION_SCALE` 即输出 1920×1080）；16 秒 `boot.mp4` 用默认环境变量；
- 直接替换内置主题文件时：背景放 `themes/<id>/hero.jpg`，应用内动画放 `themes/<id>/splash.mp4`，独立动画放 `themes/<id>/boot.mp4`，并同步 `themes/<id>/theme.json` 的 `colors`；构建会从源 `themes/` 复制，改 `build/app` 会被下次构建覆盖；
- 纸白模式优先用 `hero-paper.jpg`；自定义主题没有这个文件时会回退 `hero.jpg`。

### 设置

面板“外观参数”：

- 面板不透明度（50–100%）：侧栏、输入框等表面的透明度；
- 背景清晰度（0–100%）：越高背景立绘/透视色带越清楚，越低 UI 遮罩越实；
- 正文可读性（自动/始终加强/关闭）；
- 启动动画开关；
- 启动音效开关；
- 背景风格（深色 HUD / 纸白平面）；
- 交接后窗口（恢复上一次窗口大小 / 最大化 Codex）。

## 主题包格式

```text
themes/<id>/
  theme.json      # 清单
  hero.jpg        # 应用内背景（建议 1920×1080）
  poster.jpg      # 启动动画海报
  preview.jpg     # 面板卡片缩略图（640×360）
  splash.mp4      # 10 秒 1080p30 应用内启动动画（可选；缺省回退 boot.mp4/hero；自定义视频不限时长）
  boot.mp4        # 16 秒 1080p30 独立动画（--external，H.264 + AAC）
  hero-paper.jpg  # 纸白模式背景（可选，缺省回退 hero.jpg）
  art/            # 官方立绘原图（仅本地，gitignore）
```

`theme.json` 关键字段：

```json
{
  "schemaVersion": 1,
  "id": "si",
  "name": "祀",
  "series": "endfield",
  "colors": { "accent": "#F2C94C", "secondary": "#7FE7FF", "surface": "#0A0F14", "text": "#EAF2F6", "mode": "dark" },
  "copy": { "brand": "ENDFIELD // TALOS-II", "headline": "祀", "tagline": "协议已建立" },
  "background": { "image": "hero.jpg", "focus": { "x": 68, "y": 28 }, "tint": "#0A0F14", "tintOpacity": 0.3 },
  "decor": "endfield",
  "boot": {
    "mode": "handoff",
    "video": "boot.mp4",
    "poster": "poster.jpg",
    "width": 1920,
    "height": 1080,
    "holdAt": 10,
    "transitionStart": 12.5,
    "transitionEnd": 15,
    "maxWaitSeconds": 60,
    "volume": 0.75,
    "handoffStyle": "wipe",
    "loopStart": 10,
    "loopEnd": 12,
    "screenFrames": [
      { "time": 12.5, "x": 0, "y": 0, "width": 1, "height": 1 },
      { "time": 15, "x": 0, "y": 0, "width": 1, "height": 1 }
    ]
  }
}
```

- `boot.*` 主要供 `--external` 独立动画窗口使用；默认应用内动画读取同目录 `splash.mp4`，缺省时用 `boot.mp4`（≤64MB），再缺省时用 `hero.jpg` 海报式画面。
- `boot.mode`：
  - `handoff`：播放到 `transitionStart` 后交接；
  - `fade`：播放完整段视频，结束后淡出交接（自定义 MP4 的默认模式）；
  - `poster`：没有视频，用 `poster.jpg` 的 WPF 缓慢推镜 + 扫描线动画。
- `handoffStyle`：
  - `wipe`（默认）：不等比缩放窗口；按 `codex-window.json` 里保存的上一次窗口大小，把真实 Codex 窗口以平面色块擦除的方式揭示出来；
  - `scale`：旧版行为，DWM 缩略图按 `screenFrames` 从小矩形扩展到全屏。
- `loopStart` / `loopEnd`：皮肤还没就绪时循环播放的动态等待段；默认 10–12 秒，避免冻结在 7 秒。
- `screenFrames` 只在 `handoffStyle: "scale"` 时使用；`wipe` 模式忽略它。
- 自定义 MP4 建议 H.264 + AAC、16:9；如果时长不足 `transitionEnd`，独立动画会在视频结束时安全交接；应用内动画上限 64MB，超过则回退海报。
- `decor`：`endfield` / `rhodes` / `sui` / `goldenglow` / `custom`。

## 架构

```text
默认模式：应用内启动动画
TerraBoot.exe (C# WPF, .NET Framework 4.8)
  ├─ 读取 state.json + theme.json + codex-window.json；启动时把 skinEnabled 置 true
  ├─ IApplicationActivationManager 带 CDP 参数启动/激活 Codex
  ├─ 宽松枚举 ChatGPT 窗口 + AttachThreadInput/BringWindowToTop 强制前置（否则后台页面的视频会被暂停）
  ├─ 恢复上一次 Codex 窗口位置/大小
  ├─ 启动 node\cli.mjs panel（皮肤控制器；已运行则复用）
  ├─ 启动 node\cli.mjs splash <theme>：读 splash.mp4 → base64 → CDP 注入全窗 <video> 遮罩
  └─ 视频按实际播放进度结束 → clip-path 平面擦除 → 露出已换肤 Codex

独立模式：TerraBoot.exe --external
  ├─ 在 Codex 同尺寸/位置的无边框窗口播放 16s boot.mp4（或 poster 动画）
  ├─ DWM 缩略图 + 12.5–15s 平面擦除交接
  └─ 其余流程同上

Node 控制器 (Node 24, 无运行时 npm 依赖)
  ├─ 127.0.0.1:9341 连接 Codex CDP（校验监听 PID / 可执行路径 / 页面白名单）
  ├─ 注入 CSS + 装饰层 + Shadow DOM 主题胶囊
  ├─ Runtime.addBinding 接收页面切换命令
  ├─ 页面刷新/重连自动修复，轮询检查皮肤是否被移除
  ├─ 写 ready.json（独立动画模式用来判断窗口 + 皮肤是否就绪）
  ├─ cli.mjs splash：应用内启动遮罩（视频走 Blob，绕开 http 媒体 URL 安全检查）
  └─ 127.0.0.1:9342 控制面板 + API（token、Host/Origin 校验、上传校验）
```

数据目录：

```text
%LOCALAPPDATA%\TerraStudio\
  state.json
  ready.json
  codex-window.json    # 上一次 Codex 窗口位置/大小
  themes\              # 自定义主题
  logs\boot.log
  logs\controller.log
  tmp\                 # 上传临时文件
```

## 故障排查

### 面板提示“回环未豁免” / CDP 连不上

1. 运行 `build\app\scripts\enable-loopback.ps1`，在 UAC 窗口点“是”；
2. 面板点“重启并应用”，让 Codex 带调试端口重启；
3. `node src\injector\cli.mjs doctor` 查看 PFN、AUMID、端口 owner、页面目标。

### Codex 正在运行，但皮肤没生效

商店版如果从普通图标启动，不会带 CDP 参数。直接重新运行 `泰拉终端.bat`，启动器会检测到旧实例并弹窗询问是否关闭/重启；选“是”即可。也可以从面板点“重启并应用”。

如果 Codex 最小化在托盘且不响应 `WM_CLOSE`，启动器/面板会在你已同意重启（面板有确认弹窗）后结束 Codex 的 GUI 进程；不做静默强制结束。

### 交接后又变成全屏 / 窗口大小不对

- 面板“外观参数 → 交接后窗口”选 **恢复上一次窗口大小**；
- 启动器每次正常启动都会把当前 Codex 窗口位置写入 `%LOCALAPPDATA%\TerraStudio\codex-window.json`，**启动动画窗口和最终 Codex 窗口都使用这个矩形**，下次优先恢复它；
- 如果保存的位置来自旧显示器或屏幕外，启动器会回退到本次窗口位置；删除 `codex-window.json` 可重置。

### 面板启动后 Codex 没置顶 / “重启并应用”窗口一闪就消失

- 启动器现在只在启动时把 Codex 窗口强制前置一次，不再反复抢焦点；如果仍被挡住，再点一次“启动 Codex”通常即可；
- “重启并应用”会先关闭 Codex，并清理 `codex.exe`/CUA 辅助进程，再等旧调试端口 9341 释放后重新启动；
- 如果日志出现“旧 Codex 的调试端口 9341 仍被占用”，说明还有后台进程占着端口，启动器会取消重启避免新窗口闪退；请手动退出 Codex 托盘/后台进程后重试；
- 如果日志出现“Codex 强制结束后仍在运行”，可能遇到受保护的系统进程，重启系统或手动从托盘退出最稳妥；
- 日志：`%LOCALAPPDATA%\TerraStudio\logs\boot.log`。

### 应用内启动动画不显示 / 只有黑底和“ESC 跳过”

- 启动器会把 Codex 窗口强制前置；如果你手动运行 `node src\injector\cli.mjs splash si` 测试，先确保 Codex 窗口在前台——后台/最小化的 Chromium 页面会暂停视频；
- 自定义视频建议 H.264/AAC、≤64MB；超过 64MB 或编码不支持时会回退为主题背景海报；
- 查看 `%LOCALAPPDATA%\TerraStudio\logs\boot.log` 是否有“启动动画注入进程”和“应用内启动动画已开始”；
- 仍不显示时可用 `TerraBoot.exe --external` 的独立动画窗口。

### 独立动画黑屏 / 只有声音

- MP4 必须是 H.264 + AAC、16:9；不支持的编码会让 `MediaElement` 失败，启动器会回退到 `poster.jpg` 动画；
- 没有海报时会显示主题渐变 + 文字；
- 远程桌面 / 虚拟机可能禁用 DWM 缩略图，启动器会自动退化为普通交接。

### 独立动画停在 7 秒

`--external` 启动器在等 `ready.json`（Codex 窗口稳定 + 皮肤注入完成）。如果控制器没起来：

- 面板是否在运行？`http://127.0.0.1:9342/api/ping`；
- 是否有重复/残留的 node 控制器？结束旧的 `node ... cli.mjs panel` 进程后重启；
- 最多等 20 秒会自动继续，不会永久卡住。

### 端口被占用

- 9341：只接受 Codex 进程持有的监听；如果被其他进程占用，控制器会拒绝连接；
- 9342：面板端口，结束旧的控制器进程后重试。

### Codex 更新后

AUMID 通过 `Get-AppxPackage OpenAI.Codex` 动态读取，主题注入不修改安装文件；如果 Codex 大版本改了 DOM class，背景/装饰/胶囊仍有 body 级兜底，内部表面透明度可能减弱。运行 `doctor` 和截图命令可快速确认。

## 开发

```powershell
# C# 启动器自检
build\app\TerraBoot.exe --self-test

# 状态 / 诊断 / 截图
node src\injector\cli.mjs status
node src\injector\cli.mjs doctor
node src\injector\cli.mjs screenshot --out logs\shot.png

# 重新生成海报（需要 Chrome/Edge + art/source.png）
node tools\gen\render-posters.mjs

# 重新生成 16 秒独立动画（headless Chrome 逐帧 + ffmpeg，输出 boot.mp4）
node tools\gen\render-motion.mjs si

# 生成 10 秒应用内动画（输出 splash.mp4）
$env:TERRA_MOTION_DURATION="10"; $env:TERRA_MOTION_OUT="splash.mp4"
$env:TERRA_MOTION_AUDIO="0"; $env:TERRA_MOTION_CRF="27"
node tools\gen\render-motion.mjs si

# 只播放一次应用内动画（Codex 已在前台、CDP 已连接）
node src\injector\cli.mjs splash si

# 独立 16 秒动画窗口
build\app\TerraBoot.exe --theme si --external

# 备用：旧的静态海报 + drawtext 视频生成器
node tools\gen\render-videos.mjs
```

- C# 用 Windows 自带 `csc.exe` 编译，目标 .NET Framework 4.8；
- Node 控制器只使用 Node 内置模块（`fetch`、`WebSocket`、`http`、`fs` 等）；
- `tools/gen/bin/ffmpeg.exe` 是构建期工具，不参与运行时；它被 `.gitignore` 排除；
- 面板上传的图片在浏览器内裁切压缩，服务端只做魔数/大小/路径校验。

## 卸载

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File build\app\scripts\uninstall.ps1
```

可加：

- `-RemoveData`：删除 `%LOCALAPPDATA%\TerraStudio`（含自定义主题）；
- `-KeepLoopback`：保留回环豁免；
- `-DryRun`：只打印将要执行的动作。

卸载不会修改 Codex 安装文件。彻底退出 Codex 后正常重新打开即可恢复官方界面。

## 边界

- 不替换桌面/开始菜单快捷方式，不注册开机自启；
- 不支持 macOS；
- 不修改 Codex 安装目录、`app.asar` 或签名资源；
- 应用内背景使用静态图片；MP4 只用于启动动画（动态背景留作后续可选功能）；
- 官方立绘及衍生素材不随仓库/Release 分发。

## 参考与致谢

技术路线参考了两个 MIT 项目（仅参考思路，代码为本项目独立实现）：

- [yushua0808-cpu/dragon-codex-boot](https://github.com/yushua0808-cpu/dragon-codex-boot)：WPF + DWM 启动动画交接；
- [HeiGeAi/heige-codex-skin-studio](https://github.com/HeiGeAi/heige-codex-skin-studio)：CDP 注入换肤、MSIX 回环处理。

代码许可证见 [LICENSE](LICENSE)；游戏素材版权与来源见 [NOTICE.md](NOTICE.md) 和 [ASSET_SOURCES.md](ASSET_SOURCES.md)。
