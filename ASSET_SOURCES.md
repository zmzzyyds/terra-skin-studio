# 素材来源 / Asset sources

本文件记录内置主题使用的官方立绘来源。所有图片仅保存在本机，`.gitignore` 已排除 `themes/*/art/`、`themes/*/hero.*`、`themes/*/poster.*`、`themes/*/preview.*`、`themes/*/boot.mp4`、`themes/*/splash.mp4`。公开仓库只保留 `theme.json` 和生成脚本，不包含这些素材。

## 官方立绘

| 角色 | 主题 | 直链 | 来源页 | 尺寸 |
| --- | --- | --- | --- | --- |
| 祀（Si） | `si` | https://endfield.wiki.gg/images/Si_Splash_Art.png | https://endfield.wiki.gg/wiki/Si | 2048×2048 RGBA |
| 庄方宜（Zhuang Fangyi） | `zhuang-fangyi` | https://endfield.wiki.gg/images/Zhuang_Fangyi_Splash_Art.png | https://endfield.wiki.gg/wiki/Zhuang_Fangyi | 2048×2048 RGBA |
| 澄闪（Goldenglow） | `goldenglow` | https://media.prts.wiki/d/d0/%E7%AB%8B%E7%BB%98_%E6%BE%84%E9%97%AA_2.png | https://m.prts.wiki/w/澄闪 | 2048×2048 RGBA |
| 黍（Shu） | `shu` | https://media.prts.wiki/c/cf/%E7%AB%8B%E7%BB%98_%E9%BB%8D_2.png | https://m.prts.wiki/w/黍 | 2048×2048 RGBA |

官方终末地干员页：

- https://endfield.hypergryph.com/operator
- https://endfield.gryphline.com/en-us/operator

## 版权

《明日方舟》《明日方舟：终末地》的角色、名称、立绘与相关素材版权归 **鹰角网络 / Hypergryph / Gryphline** 所有。

这些图片只用于本机个人桌面的非商业自定义，**不随代码仓库或 Release 分发**。`hero.jpg`、`poster.jpg`、`preview.jpg`、`splash.mp4`、`boot.mp4` 是由官方立绘/视频合成的本地衍生文件，同样不公开分发。

如果要公开仓库或发布主题包，请删除官方立绘及其衍生文件，改用自己绘制、委托创作或明确授权的素材。主题引擎和原创几何装饰不依赖这些图片。

## 生成链

1. `node tools/gen/render-posters.mjs`：用 headless Chrome 把 `themes/<id>/art/source.png` 合成 `poster.jpg` / `hero.jpg` / `preview.jpg`。
2. `node tools/gen/render-videos.mjs`：用 `tools/gen/bin/ffmpeg.exe` 生成 `boot.mp4`（原创合成音效）。
3. 角色图片来源变更时，更新本文件。
