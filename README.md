# Try Me — MV project

使用 Remotion 为 Kero Kero Bonito《Try Me》制作个人 MV。当前阶段是仓库约定与前期设计，视觉方案及歌曲分析尚未完成。

仓库计划公开代码、原创文档与确认可再分发的素材。用户已购买正版音源，歌曲只在本地使用，不随仓库提供下载。公开代码与最终含音乐视频的发布安排分别管理。

## 目录

```text
docs/                    创作与制作文档（提交）
  storyboard/            分镜表及原创分镜草图
public/
  assets/                可公开的运行时素材（提交，子目录按需创建）
  private/audio/         try-me.flac 等本地音频（忽略）
local/                   非运行时参考资料、源工程、私人笔记（忽略）
src/                     Remotion 代码（提交）
scripts/                 项目辅助工具（提交）
out/                     渲染视频、静帧等产物（忽略）
build/、dist/            构建产物（忽略）
```

Remotion 推荐将运行时资源放在根目录 `public/`，通过 `staticFile()` 引用。`assets` 和 `private` 是本项目约定，`private` 不提供访问控制。含私有素材的构建包和 Studio 服务均按本地材料管理，不直接公开。参见 [官方资源说明](https://www.remotion.dev/docs/assets)。

## 本地开始

1. 安装 `package.json` 要求的 Node.js 版本，运行 `npm ci`。
2. 安装 `uv`，运行 `uv sync` 创建项目独立的 `.venv/`（Python 3.12）并安装锁定的音频分析依赖。
3. 自行准备合法取得的音源，放在 `public/private/audio/try-me.flac`。Git 不保存空目录，新克隆后需自行创建路径。
4. 运行 `npm run analyze:audio`（即 `uv run python scripts/analyze-audio.py`）校验本地 FLAC 并生成候选分析数据到 `local/analysis/`。
5. 运行 `npm run dev` 打开 Remotion Studio。目前仍是初始空白 `MyComp`，不会播放音频；音轨接入属于后续阶段。
6. 运行 `npm run lint` 检查代码；运行 `npm run check:repo` 检查 Git 索引是否混入受保护路径或音频。

未来通过 `staticFile("private/audio/try-me.flac")` 定位音轨，不写本机绝对路径。若实际预览或渲染遇到 FLAC 兼容问题，再生成 WAV 工作副本，放在同一私有目录并登记。

`npm run build` 是本地构建，会收集运行时素材，不直接作为公开网站发布。需要导出时再确定 composition 与参数，输出统一放 `out/`。后续接入音轨时将提供静音预览方式，供没有私有音源的人复现视觉效果。

## 文档与推进顺序

- [创作简报](docs/brief.md)：主题、视觉方向、交付规格和待定问题。
- [音乐结构](docs/music-map.md)：版本、实测时长、节拍、段落、时间点。
- [视频脚本](docs/script.md)：每个段落表达什么，情绪如何变化。
- [分镜表](docs/storyboard/README.md)：每个镜头的画面、运动、转场与实现位置。
- [素材清单](docs/assets.md)：来源、使用位置与是否可以公开。
- [推进计划](docs/roadmap.md)：阶段产物及完成条件。
- [制作准备与协作流程](docs/preparation.md)：环境现状、待装依赖、标注闭环与数据规则。
- [决策记录](docs/decisions.md)：已确认约定与变更理由。

下一步推进最小波形标注闭环（0.2），基于 `local/analysis/` 的自动候选数据通过播放与人工校正建立音乐结构；随后讨论视觉方向，选约 10–20 秒代表性片段制作动态分镜，确认后扩展全曲。当前已完成基础分析环境与候选数据生成，尚未进行人工听辨或开发标注界面。

## 提交与发布

先暂存本次代码和文档，再运行 `npm run check:repo`，检查 `git diff --cached --stat` 和 `git diff --cached`。检查脚本只检查当前 Git 索引中的路径，不能识别改名后的受保护内容，也不扫描历史或远端；不要用 `git add -f` 绕过忽略规则。

歌曲、转码音频、含歌曲的成片、含私有素材的 bundle 不上传到仓库、Release、Actions artifacts 或 Pages。Git LFS 仍会上传文件，不用来存放这首歌。

暂未选择开源许可证，`package.json` 保持 `UNLICENSED`。公开源码与授予再使用许可是不同决定，第三方素材来源与许可单独登记。
