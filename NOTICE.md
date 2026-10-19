# 版权与素材说明 / Notices

## 本项目

Terra Skin Studio（泰拉换肤工作室；启动器仍叫「泰拉终端 / Terra Terminal」）是一个本地、非商业的 Codex Desktop 外观工具。源代码由本项目独立编写。

技术路线参考了以下 MIT 项目（仅参考思路，未复制其代码）：

- `yushua0808-cpu/dragon-codex-boot` — WPF 播放启动视频，并用 DWM 缩略图把真实窗口嵌入动画。
- `HeiGeAi/heige-codex-skin-studio` — 通过 Chrome DevTools Protocol 注入 CSS，不修改 `app.asar`。

如果后续引入了上述项目的任何代码片段，必须在该文件或源文件中保留其 MIT 许可证与版权声明。

## 游戏素材

《明日方舟》《明日方舟：终末地》的角色、名称、立绘、标志及相关素材版权归**鹰角网络 / Hypergryph / Gryphline** 所有。

本仓库不包含、也不应在公开 Release 中分发官方立绘或衍生素材。用户选择“官方图本地自用”后，相关图片只保存在本机主题目录中，仅用于个人桌面的非商业自定义；不得再分发、商用或冒充官方。

内置四套主题的立绘来源、直链与尺寸记录在 [ASSET_SOURCES.md](ASSET_SOURCES.md)。`themes/*/art/`、`hero.jpg`、`poster.jpg`、`preview.jpg`、`splash.mp4`、`boot.mp4` 均被 `.gitignore` 排除；如果公开仓库，请删除这些文件或替换为原创/授权素材。

内置的几何装饰、HUD 元素、扫描线、印章、排版与生成音效为本项目原创，不使用官方 Logo。

## Codex / OpenAI

Codex 与 OpenAI 是 OpenAI 的商标。本项目与 OpenAI 无隶属关系。工具不修改 Codex 安装文件，仅在本机通过调试端口注入运行时样式；用户可以随时还原官方界面并撤销回环豁免。

## 字体

界面使用 Windows 自带字体（Bahnschrift、Segoe UI、Microsoft YaHei UI、Consolas），不随项目分发字体文件。
