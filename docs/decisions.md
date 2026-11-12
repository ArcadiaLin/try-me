# 决策记录

仅记录已确认约定，候选创意留在简报里。变更时追加记录，注明替代哪条及影响范围。

## D001 — 2026-11-11：公开代码，私有音源本地管理

- Remotion 运行时素材放根目录 `public/`。本地歌曲为 `public/private/audio/try-me.flac`，整个 `public/private/` 忽略，常见音频扩展名额外默认忽略。
- 可公开素材放 `public/assets/`，非运行时材料放 `local/`，渲染产物放 `out/`，构建目录也忽略。
- 含私有资源的构建包仅在本地使用。后续接入音轨时提供静音预览路径。

## D002 — 2026-11-11：先设计，再制作

- 维护创作简报、音乐结构、视频脚本、分镜表、素材清单和推进计划。
- 段落使用 `P001`，镜头使用 `S001`，素材使用 `A001` 等稳定 ID。
- 时间线使用整数帧与左闭右开区间。正式规格和真实音乐时间点待确定。
- 先做代表性片段，再展开全曲。当前保留初始空白 composition，不渲染。

## D003 — 2026-11-11：自动分析候选，人工校正，逐步验证

- 在正式设计前增加独立分析环境与最小标注闭环，详见 `preparation.md` 和 `roadmap.md`。
- 第一批使用 uv 管理 Python 与基础分析依赖；波形标注采用 wavesurfer.js，按需求接入与现有版本一致的 Remotion Player。
- 不先训练声音模型、不先生成完整乐谱；分轨、歌词对齐和音符转录按实际问题引入。
- 机器分析、人工修订、创作时间线分别保存；重新分析不得覆盖人工确认数据。
- 当前只确认准备方案，依赖安装、歌曲分析和标注工具均尚未实施。

## D004 — 2026-11-12：独立波形标注与脚本协作台 + Agent 简报双向交互

- 采用 `wavesurfer.js` 独立本地标注页（`npm run annotate`，仅监听 `127.0.0.1`）配合 Remotion Studio 的诊断型同步预览 Composition（`src/Composition.tsx`，非正式分镜实现），替代在 Studio 时间轴直接塞入数百个候选拍点。
- 人工标注主数据保存在 `local/annotations/annotations.json`（唯一事实来源），支持串行写入锁与内容哈希乐观锁（`revision` / `409 Conflict`）防止网页自动保存与 Agent 修改互相覆盖；损坏 JSON 或音源哈希不匹配时拒绝覆盖。
- 每个时间点标记（`markers`）与区间标记（`regions`）维护稳定单调递增 ID（删除后不复用）、候选溯源信息（`origin_candidate_id`、`origin_analysis_run_id`、原候选秒数与采样帧）、状态（`candidate` / `confirmed`）、关联镜头，以及 `note`（音乐特征）、`script_idea`（画面脚本构想）、`agent_comment` / `agent_status`（`none | open | in_progress | resolved`）/ `agent_reply` 与仅存本地的 `lyric_hint`（私人歌词定位提示）。所有自由文本在转入公开 `docs/` 或 `src/timeline/` 前仍需人工复核。
- 每次保存自动同步重建两份派生文件：
  1. `local/annotations/agent-brief.md`：供 Agent 直接读取的结构化 Markdown 协作简报（自动排除 `lyric_hint`）；
  2. `public/private/annotations-preview.json`：按显式字段白名单导出的 Remotion 运行时预览数据。
