# 制作主题

主题由一个目录、一份 `theme.json` 和可选媒体文件组成。仓库跟踪四个内置主题清单，以及各主题的原始图源、背景/海报/预览图和启动视频。`themes/*/art/*.html` 与 `motion-frames/` 是生成过程的中间文件，仍由 `.gitignore` 排除。

## 通过控制面板创建（推荐）

1. 打开控制面板，展开“自定义主题”。
2. 填写名称、副标题、系列和装饰，选择 JPG、PNG 或 WebP 背景图。
3. 可点“从背景图取色”，再按需调整主色、辅色、表面色和文字色。
4. 可选添加 MP4 启动视频，点击“创建并应用”。

浏览器会在本机将背景图裁切成 1920×1080 JPEG（质量 0.86）后上传；原图不会上传。服务器端还会检查文件扩展名、文件头和上传大小。上传上限由 `src/injector/panel-server.mjs` 规定：图片 30 MiB、视频 500 MiB。应用内启动动画通过 CDP 传输视频的上限是 64 MiB；较大的视频会回退到主题背景图。需要播放完整大视频时可尝试独立窗口模式：`TerraBoot.exe --theme <主题id> --external`。

自定义主题保存在 `%LOCALAPPDATA%\TerraStudio\themes\custom-<slug>-<hash>\`，不会修改内置主题目录。

## 手工新增一个内置主题

1. 复制模板并给目录和清单设置同一个 ID：

   ```powershell
New-Item -ItemType Directory -Path themes\my-theme
   Copy-Item themes\_template\theme.json themes\my-theme\theme.json
   ```

2. 编辑 `theme.json` 中的 ID、名称、颜色、文字、装饰和素材路径。
3. 将素材放进该主题目录；至少准备背景图。若主题清单指定 `boot.mode: "handoff"`，还必须准备启动视频和至少两个有效的 `screenFrames` 关键帧。
4. 运行 `npm run list` 查看主题是否被识别及素材是否可用；需要更新构建产物时再运行 `npm run build`。

主题 ID 必须是小写英文字母、数字和连字符组成，长度 1–41 个字符，并以字母或数字开头。主题目录名必须与 `theme.json` 的 `id` 一致。

## `theme.json` 结构

```json
{
  "schemaVersion": 1,
  "id": "my-theme",
  "name": "我的主题",
  "subtitle": "MY THEME",
  "series": "custom",
  "colors": {
    "accent": "#F2C94C",
    "secondary": "#7FE7FF",
    "surface": "#0A0F14",
    "text": "#EAF2F6",
    "mode": "dark"
  },
  "copy": {
    "brand": "TERRA TERMINAL // CUSTOM",
    "headline": "我的主题",
    "tagline": "PROTOCOL READY"
  },
  "background": {
    "image": "hero.jpg",
    "focus": { "x": 50, "y": 30 },
    "tint": "#0A0F14",
    "tintOpacity": 0.3
  },
  "decor": "custom",
  "boot": {
    "mode": "poster",
    "poster": "poster.jpg",
    "width": 1920,
    "height": 1080,
    "holdAt": 0,
    "transitionStart": 0,
    "transitionEnd": 0,
    "maxWaitSeconds": 60,
    "volume": 0
  },
  "preview": "preview.jpg"
}
```

主要字段约束由 `src/injector/theme-store.mjs` 验证：

- `schemaVersion` 当前必须为 `1`；颜色是 `#RRGGBB`；`colors.mode` 为 `dark` 或 `light`。
- `series` 可为 `arknights`、`endfield`、`custom`；`decor` 可为 `endfield`、`rhodes`、`sui`、`goldenglow`、`custom`。
- 图片扩展名可为 `.jpg`、`.jpeg`、`.png`、`.webp`；视频为 `.mp4`。素材路径必须相对主题目录，不能含 `..`。
- `background.focus.x/y` 取 0–100；`tintOpacity` 和 `boot.volume` 取 0–1。
- `boot.mode` 为 `poster`、`fade` 或 `handoff`。`fade` 和 `handoff` 要求视频；`handoff` 还要 `screenFrames`。时间要满足 `holdAt <= transitionStart <= transitionEnd`。
- `screenFrames` 为 2–32 个关键帧，时间严格递增；`x/y/width/height` 使用 0–1 的画面比例并保持在画面范围内。

上述拒绝规则来自 Node 主题存储器。C# 启动器另有自己的默认值和规范化逻辑，二者并非逐字段相同；调整清单格式时应同时检查 `src/injector/theme-store.mjs` 与 `src/boot/Models.cs`。

## 主题素材目录

| 文件 | 用途 |
|---|---|
| `theme.json` | 主题清单，必须有 |
| `hero.jpg` 等图片 | Codex 界面背景；自定义主题创建器生成 1920×1080 JPEG |
| `poster.jpg` | 独立启动窗口的海报回退 |
| `preview.jpg` | 面板主题卡片预览 |
| `splash.mp4` | 应用内动画优先使用的文件名；找不到时会尝试 `boot.mp4` |
| `boot.mp4` | `--external` 独立启动窗口所用视频；也可作为应用内动画候选 |
| `hero-paper.jpg` | 可选纸白模式背景 |
| `art/source.png` | 可选的本地原始素材，供生成脚本使用 |

内置主题图片和视频会随仓库分发。根目录 `LICENSE` 说明软件代码的 MIT 许可；它不会自动授予主题图像、角色立绘或视频的使用权。添加或替换媒体前，必须确认公开再分发授权，并按对应授权条件使用。

## 本地生成海报和动画

生成脚本只用于构建期，不参与运行时。先按 `tools/gen/README.md` 准备 Chrome/Edge 与 `tools/gen/bin/ffmpeg.exe`，然后把素材放到 `themes/<id>/art/source.png`：

```powershell
node tools\gen\render-posters.mjs
node tools\gen\render-motion.mjs my-theme
```

`render-posters.mjs` 会为有源图的主题生成 poster、hero、hero-paper 和 preview 图片。`render-motion.mjs` 默认生成 16 秒带音轨的 `boot.mp4`；可用环境变量调整：

```powershell
$env:TERRA_MOTION_DURATION = "10"
$env:TERRA_MOTION_OUT = "splash.mp4"
$env:TERRA_MOTION_AUDIO = "0"
$env:TERRA_MOTION_CRF = "27"
node tools\gen\render-motion.mjs my-theme
```

`TERRA_MOTION_SCALE` 可指定 ffmpeg 输出缩放；`CHROME_PATH` 可指定 Chrome/Edge 可执行文件路径。生成的 JPG/MP4 属于主题资源，会被 Git 跟踪；生成的 HTML 页面和逐帧目录仍被忽略。
