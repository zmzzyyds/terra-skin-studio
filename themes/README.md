# 主题目录 / Themes

每个主题一个文件夹：

```text
themes/<id>/
  theme.json
  hero.jpg
  hero-paper.jpg     # 纸白模式背景（可选）
  poster.jpg
  preview.jpg
  splash.mp4         # 应用内启动动画（10s 1080p；自定义可不限时长，≤64MB）
  boot.mp4           # 独立动画（16s 1080p，--external）
  art/source.png      # 可选：原始立绘，仅本地
```

> 公开仓库只包含 `theme.json`，不包含官方立绘、`hero.*`、`splash.mp4`、`boot.mp4` 等素材。请使用自己的/授权素材；最方便的是面板“自定义主题”。

- `theme.json`：格式见根目录 README；
- `hero.jpg`：应用内背景，建议 1920×1080；
- `poster.jpg`：启动动画海报，建议 1920×1080；
- `preview.jpg`：面板卡片 640×360；
- `splash.mp4`：应用内启动动画，内置为 10 秒 1080p30、无音频；自定义只限制 64MB，不限制时长；
- `boot.mp4`：独立动画（`--external`）16 秒 1080p30，H.264 + AAC；
- `hero-paper.jpg`：纸白模式的奶油白/炭黑分栏背景，可选；缺省回退 `hero.jpg`；
- `art/source.png`：角色原图，透明背景最佳。

## 从一张立绘生成一套主题

1. 把原图放到 `themes/<id>/art/source.png`；
2. 复制 `themes/_template/theme.json`，改 `id`、`name`、`colors`、`copy`；
3. 生成海报、深色背景和纸白背景：

   ```powershell
   node tools\gen\render-posters.mjs
   ```

4. 生成启动动画（headless Chrome 逐帧渲染 + `tools\gen\bin\ffmpeg.exe`）：

   ```powershell
   node tools\gen\render-motion.mjs
   ```

   如果要退回旧的静态海报 + drawtext 版本，用 `node tools\gen\render-videos.mjs`。

5. 在面板里点“刷新”，新主题会出现。

只生成某一个主题：

```powershell
node tools\gen\render-posters.mjs
node tools\gen\render-motion.mjs si
```

## 素材版权

官方立绘及其衍生文件（`hero.jpg`、`poster.jpg`、`preview.jpg`、`splash.mp4`、`boot.mp4`）不随仓库分发，`.gitignore` 已排除。来源见根目录 [ASSET_SOURCES.md](../ASSET_SOURCES.md)。公开仓库前请替换为原创或授权素材。

## 自定义主题

普通用户不需要手动改这里：控制面板的“自定义主题”会把图片和可选 MP4 写到 `%LOCALAPPDATA%\TerraStudio\themes\`，内置主题目录保持只读。
