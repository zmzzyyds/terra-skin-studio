# 故障排查

先按顺序检查 Codex 包、回环豁免、CDP 端口和页面目标。面板“运行状态”和日志区域也能显示这些信息。

## 诊断命令

在项目根目录运行：

```powershell
npm run doctor
npm run status
npm run list
```

`doctor` 会输出应用包、运行数据目录、当前状态、端口所有者、CDP 版本和可连接的页面目标；`list` 会显示每个主题的背景图、视频等素材可用情况。

日志位置：

```text
%LOCALAPPDATA%\TerraStudio\logs\controller.log
%LOCALAPPDATA%\TerraStudio\logs\boot.log
```

控制器与启动器日志各自按约 2 MiB 轮转为 `.1` 文件。

## 面板提示回环豁免未启用

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\enable-loopback.ps1 -Status
```

如果未启用，运行同一脚本（不带 `-Status`）并在 UAC 窗口确认。回环豁免让商店版 Codex AppContainer 能连接本机 CDP；撤销命令为：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\enable-loopback.ps1 -Remove
```

## Codex 在线，但 CDP 端口不在线

项目默认 CDP 端口为 `9341`。如果 Codex 是从普通快捷方式启动的，可能没有带调试参数。先保存未发送内容，再从 Terra 启动器启动，或在面板点“重启并应用”。重启时会先请求正常退出；程序确认后仍无法退出时才可能强制结束 Codex GUI 进程。

若端口已被其他程序占用，`doctor` 会显示端口所有者。不要让控制器连接未知进程；停止占用者或在两端统一配置未占用的端口。

## 主题应用后没有背景或启动动画

`npm run list` 会显示 `no-hero`、`no-video` 等状态。内置媒体现在随仓库跟踪；若仍显示缺少素材，检查对应 `themes/<id>/theme.json` 路径是否与文件名一致，并确认 `build\app\themes\<id>` 含有这些文件。修改源码主题后重新运行 `npm run build`。

应用内动画最多通过 CDP 注入 64 MiB 视频；较大视频会改用背景图动画。若要播放完整的大视频，可尝试 `TerraBoot.exe --theme <主题id> --external`。当应用内视频无法解码时，也会回退到背景图。

## 主题切换入口消失

在控制面板点“显示主题胶囊”，或在 Codex 中按 `Ctrl+Shift+T`。胶囊隐藏状态保存在 Codex 页面的 `localStorage` 中。

## 重启后界面变回原样或 Codex 更新后主题样式不完整

常驻面板/控制器会在 CDP 重连后重新注入样式；仅运行 `apply` 的一次性注入不会在刷新后自动恢复。重新启动面板并确认 `doctor` 能看到 Codex 页面。

主题依赖 Codex 当前页面结构和选择器。Codex 更新后若内部页面 DOM 改动，背景或部分面板透明效果可能变化；先记录应用版本、查看 `controller.log`，再检查 `src/injector/skin-css.mjs` 中的选择器。

## 卸载或还原

只还原外观：面板点“还原原生界面”，或在 Codex 页面运行 `npm run restore`。

停止控制器并撤销回环豁免：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\uninstall.ps1
```

卸载默认保留设置、日志和自定义主题。添加 `-RemoveData` 会删除 `%LOCALAPPDATA%\TerraStudio` 下的运行数据；添加 `-DryRun` 先查看操作计划。
