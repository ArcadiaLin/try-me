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

- 采用 `wavesurfer.js` 独立本地标注页（`npm run annotate`，仅监听 `127.0.0.1`）配合 Remotion Studio 的诊断型同步预览 Composition（`apps/mv/src/Composition.tsx`，非正式分镜实现），替代在 Studio 时间轴直接塞入数百个候选拍点。
- 人工标注主数据保存在 `local/annotations/annotations.json`（唯一事实来源），支持串行写入锁与内容哈希乐观锁（`revision` / `409 Conflict`）防止网页自动保存与 Agent 修改互相覆盖；损坏 JSON 或音源哈希不匹配时拒绝覆盖。
- 每个时间点标记（`markers`）与区间标记（`regions`）维护稳定单调递增 ID（删除后不复用）、候选溯源信息（`origin_candidate_id`、`origin_analysis_run_id`、原候选秒数与采样帧）、状态（`candidate` / `confirmed`）、关联镜头，以及 `note`（音乐特征）、`script_idea`（画面脚本构想）、`agent_comment` / `agent_status`（`none | open | in_progress | resolved`）/ `agent_reply` 与仅存本地的 `lyric_hint`（私人歌词定位提示）。所有自由文本在转入公开 `docs/` 或 `apps/mv/src/timeline/` 前仍需人工复核。
- 每次保存自动同步重建两份派生文件：
  1. `local/annotations/agent-brief.md`：供 Agent 直接读取的结构化 Markdown 协作简报（自动排除 `lyric_hint`）；
  2. `public/private/annotations-preview.json`：按显式字段白名单导出的 Remotion 运行时预览数据。

## D005 — 2026-11-12：Monorepo 目录重组与跨端共享时间映射包

- 采用原生 `npm workspaces` 将仓库重组为 Monorepo：
  - `apps/mv`（`@try-me/mv`）：Remotion 视频渲染与预览工程，通过 `Config.setPublicDir` 复用根目录 `public/`。
  - `apps/annotator`（`@try-me/annotator`）：独立波形标注、脚本设计与 Agent 协作台（含 `server/`、`web/`、`test/`）。
  - `packages/shared`（`@try-me/shared`）：跨端唯一权威的 `audioSecToGlobalFrame`、`globalFrameToAudioSec` 与 `computePreviewTimeline` 时间映射包，由标注前端、标注服务端与 Remotion 共同引用。
  - `tools/audio-analyzer/` 与 `tools/repo-guard/`：存放 Python 音频特征提取脚本与 Git 索引隐私边界检查脚本（`check-repo.ts`）；全仓 Node 与前端代码统一使用 TypeScript（`.ts` / `.tsx`）；Python 环境配置（`pyproject.toml`、`uv.lock`、`.venv/`）与 `public/`、`local/`、`docs/`、`out/` 保持在仓库根目录。

## D006 — 2026-11-13：Git 追踪的统一多轨时间轴格式（annotations/try-me.timeline.json）与严格人声对轴约定

- **替代范围**：更新 D001 与 D004 中“人工标注与歌词时间轴仅保存在 `local/annotations/`”的存储约定；原音轨（`public/private/audio/try-me.flac`）、机器自动分析原始产物（`local/analysis/`）与渲染成片（`out/`）仍保持私有忽略，禁止提交。
- **Git 追踪的统一多轨主时间线**：
  - 新增受 Git 版本控制的 `annotations/try-me.timeline.json`（`schema_version: "0.2.0"`）与 `annotations/agent-brief.md`，保存完整歌词文本、精确人声时间轴、曲式段落、节拍重音、自由扩展轨道、画面脚本构想（`script_idea`）与 Agent 协作批注（`agent_comment` / `agent_status` / `agent_reply`）。
  - 同时继续同步写入 `local/annotations/`（含 `.json`、`.ass`、`.lrc` 派生文件）与 `public/private/annotations-preview.json`，当全新克隆仓库不存在 `local/annotations/` 时，服务端自动从 `annotations/try-me.timeline.json` 恢复完整工作台状态。
- **单一主时间线 + 自由多轨重叠 + 层级分组模型**：
  - 全曲以单一音源时间线为基准（当前预览帧率已由用户设定为 `60 FPS`），在其上挂载多条独立或相互重叠的时间轴（`tracks`）。
  - 每条时间轴的顶层类型 `type` 完全自由（如 `"lyrics"`、`"structure"`、`"rhythm"`、`"sfx"`、`"shot"` 或用户自定义类型），并自带 `purpose_for_agent`（向 Agent 解释该轨道语义）与 `allow_overlap`（是否允许同轨内事件重叠）。
  - 每个标注事件（`items`）支持区间（`region`）或瞬时点（`point`）、层级归属（`group_id` 段落分组与 `parent_id` 父节点嵌套）、脚本设计（`script_idea`）、听感备注（`note`）、关联镜头（`linked_shots`）与 Agent 专项指令。
- **严格人声对轴（Vocal Truth）原则**：
  - `lyrics_main` 轨道人工确认时严格对齐主唱真实发声起止（剥离句尾纯器乐伴奏空隙），不强行将上一句句尾拉到下一句句首；句与句之间的时间空隙即代表纯伴奏留白或换气区间，供效果音轴（`sfx_accents`）或分镜轴（`visual_shots`）自由叠加设计。

## D007 — 2026-11-14：标注工作台统一能力与递归分组需求

- 根据用户在 `docs/design.refined.excalidraw` 中的意见，设计目标为所有标注共用一种事件类型，当前所有区间共用一套 Workbench；不预先按歌词、节奏、结构、自定义轨道拆分编辑器或 profile。
- 导航 Group 使用同一递归类型，允许多级嵌套，层级与顺序必须进入持久化导出的 JSON，不能仅以界面缩进模拟。
- 用户认可现有低饱和配色与通透观感，并要求主波形背景加深；继续采用该视觉方向，以箭头加文字框解释设计。
- 根据后续澄清，设计图统一为主界面加外围模块说明；允许清理旧批注，不保留问答档案。工程类型与交互介绍并入各箭头说明框，移除图内独立的“模块与类型对照”区。
- 本条确认设计需求，不表示已实现。`0.3.0-design` 为候选结构，未替代 D006 的现行 0.2.0 文件格式。边界联动的具体规则见设计提案；人声留白仍遵守 D006，不能自动抹去。

## D008 — 2026-11-14：精简主时间线 JSON 与配色规范

- 按用户要求，替代 D007 配套的复杂候选结构：下一版 JSON 只表达项目、递归 Group、多条 Timeline、事件及人类/Agent 批注，不要求 hash、revision 或分析溯源清单。
- 项目、分组、时间线和事件统一使用可选 `comments: { role: "human" | "agent", text: string }[]`，不拆分指令、回复和任务状态。事件仅要求 ID、开始秒数与正文，结束秒数可选，省略即瞬时点。
- 配色沿用低饱和青绿灰；色值、用途和透明度规则附在 `docs/annotator-design.md` 与图中的箭头说明框。界面配色与编辑器状态不进入业务 JSON。
- 精简示例使用 `version: 1`，仅为目标格式；本轮不迁移真实数据或移除现有服务端校验。人声留白继续遵守 D006。
