# Terra Skin Studio 文档

本文档按使用场景分组。项目面向 Windows 上的 OpenAI Codex Desktop；实现由 C# 启动器、Node.js 控制器和本地网页面板组成。

## 想要使用工具

- [快速开始](GETTING_STARTED.md)：环境要求、构建、启动、回环豁免和常用命令。
- [制作主题](THEMES.md)：自定义主题、`theme.json` 字段、主题素材和生成脚本。
- [故障排查](TROUBLESHOOTING.md)：诊断命令、日志位置和常见问题处理顺序。

## 想要维护代码

- [技术栈](codebase/STACK.md)
- [目录与入口](codebase/STRUCTURE.md)
- [架构与运行流程](codebase/ARCHITECTURE.md)
- [代码约定](codebase/CONVENTIONS.md)
- [系统集成](codebase/INTEGRATIONS.md)
- [测试现状](codebase/TESTING.md)
- [风险与维护事项](codebase/CONCERNS.md)

## 文档边界

文档以当前工作区的源代码、配置和脚本为准。`build/`、`tmp/` 和生成媒体属于本地或构建产物；`.gitignore` 也排除了主题原图和衍生图片/视频，所以从 GitHub 克隆后需要自行准备可使用且有权使用的素材。
