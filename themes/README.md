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
  art/source.png      # 可选：生成用原始图像；提交前确认公开再分发授权
```

> 仓库包含内置主题的 `theme.json`、图像和视频。生成器产生的 HTML 页面及逐帧文件仅供本机制作，不属于运行时主题资源。

- `theme.json`：格式见[主题制作说明](../docs/THEMES.md)；
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

## 素材与授权

内置主题的源图、背景图、预览图和视频随仓库分发。根目录 `LICENSE` 适用于软件代码，不自动授予主题媒体的版权或再利用许可。新增或替换主题素材前，必须确认有公开再分发授权，并遵守该授权的署名和用途要求。

## 自定义主题

普通用户不需要手动改这里：控制面板的“自定义主题”会把图片和可选 MP4 写到 `%LOCALAPPDATA%\ArknightsPRTS\themes\`，内置主题目录保持只读。
