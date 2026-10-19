# 素材生成工具 / Generation tools

这个目录只用于**构建期**生成海报和启动视频，不参与运行时。`bin/` 里的 ffmpeg、字体和 Chrome profile 都被 `.gitignore` 排除。

## 准备 ffmpeg

从 <https://www.gyan.dev/ffmpeg/builds/> 下载 `ffmpeg-release-essentials.zip`，解压后把：

```text
bin/ffmpeg.exe
bin/ffprobe.exe
```

放到本目录的 `bin/` 下。当前机器上的版本是 9.0.2 essentials。

## 准备字体

把 Windows 的 Consolas 复制过来，供 `drawtext` 使用：

```powershell
Copy-Item "$env:WINDIR\Fonts\consola.ttf" tools\gen\bin\consola.ttf
```

## 生成

```powershell
# 海报 / hero / preview（需要 Chrome 或 Edge）
node tools\gen\render-posters.mjs

# 平面设计启动动画（headless Chrome 逐帧 + bin\ffmpeg.exe）
node tools\gen\render-motion.mjs

# 备用：旧的静态海报 + drawtext 视频
node tools\gen\render-videos.mjs

# 只生成一个主题
node tools\gen\render-motion.mjs si
```

- `render-posters.mjs` 用 headless Chrome 把 `themes/<id>/art/source.png` 合成 1920×1080 海报与背景：角色居中、透视色带、无网格；
- `render-motion.mjs` 启动 headless Chrome（CDP 9333），用 `window.__seek(t)` 逐帧渲染平面设计动画，再 ffmpeg 编码 + 原创合成音效；
- `render-videos.mjs` 是备用生成器，用 `zoompan` + `drawtext` 做较简单的版本；
- Chrome 路径可通过 `CHROME_PATH` 覆盖，默认查 Program Files 下的 Chrome/Edge；
- 生成的视频约 16 秒、1080p30、H.264 + AAC；新动画单条约 8–12MB；

## 自定义

- 想改海报排版：编辑 `render-posters.mjs` 里的 `themeCss` / `buildHtml`；
- 想改启动动画节奏：编辑 `render-motion.mjs` 的 `__seek(t)` 时间轴（或备用 `render-videos.mjs` 的 `PANEL` / `lines` / `DURATION`），同时同步 `themes/<id>/theme.json` 的 `holdAt` / `transitionStart` / `transitionEnd` / `handoffStyle` / `loopStart` / `loopEnd`；
- `render-posters.mjs` 同时生成深色 `hero.jpg` 和纸白模式 `hero-paper.jpg`；
- 想换音效：修改 `buildFilter` 里的 `sine` / `aevalsrc` 参数。不要使用有版权的音乐。
