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

- 根据用户在 `docs/annotator/design.excalidraw` 中的意见，设计目标为所有标注共用一种事件类型，当前所有区间共用一套 Workbench；不预先按歌词、节奏、结构、自定义轨道拆分编辑器或 profile。
- 导航 Group 使用同一递归类型，允许多级嵌套，层级与顺序必须进入持久化导出的 JSON，不能仅以界面缩进模拟。
- 用户认可现有低饱和配色与通透观感，并要求主波形背景加深；继续采用该视觉方向，以箭头加文字框解释设计。
- 根据后续澄清，设计图统一为主界面加外围模块说明；允许清理旧批注，不保留问答档案。工程类型与交互介绍并入各箭头说明框，移除图内独立的“模块与类型对照”区。
- 本条确认设计需求，不表示已实现。`0.3.0-design` 为候选结构，未替代 D006 的现行 0.2.0 文件格式。边界联动的具体规则见设计提案；人声留白仍遵守 D006，不能自动抹去。

## D008 — 2026-11-14：精简主时间线 JSON 与配色规范

- 按用户要求，替代 D007 配套的复杂候选结构：下一版 JSON 只表达项目、递归 Group、多条 Timeline、事件及人类/Agent 批注，不要求 hash、revision 或分析溯源清单。
- 项目、分组、时间线和事件统一使用可选 `comments: { role: "human" | "agent", text: string }[]`，不拆分指令、回复和任务状态。事件仅要求 ID、开始秒数与正文，结束秒数可选，省略即瞬时点。
- 配色沿用低饱和青绿灰；色值、用途和透明度规则附在 `docs/annotator/README.md` 与图中的箭头说明框。界面配色与编辑器状态不进入业务 JSON。
- 精简示例使用 `version: 1`，仅为目标格式；本轮不迁移真实数据或移除现有服务端校验。人声留白继续遵守 D006。

## D009 — 2026-11-14：上下文菜单与可选事件配色

- 根据用户新增意见，事件列表右键支持新建、切分和删除，Explorer 右键支持层级新建、重命名和删除；提供 ··· 等价入口，遵守继承锁并支持撤销。非空分组删除需明确影响范围。
- 主波形背景继续加深为 #b8cdd2，波形线 #355f69。轨道默认色与事件覆盖色以可选 color: #RRGGBB 保存；优先事件、再轨道、再界面默认。此条更新 D008 中“配色不进入业务 JSON”的范围：基础主题仍不保存，用户自定义色需要随文件重载。
- 不引入 hash、revision 或额外样式对象；仍为 version: 1 候选设计。菜单交互、真实数据迁移与运行时配色尚未实现。

## D010 — 2026-11-14：部署 Annotator v5 统一工作台与 `version: 1` `TimelineProject` 主格式

- **替代与生效范围**：正式将 `docs/annotator/` v5 规范（D007、D008、D009）落码部署到 `apps/annotator/`，并将 `annotations/try-me.timeline.json` 与 `local/annotations/annotations.json` 迁移为 `version: 1` `TimelineProject` 精简结构（替代 D006 中的 `schema_version: "0.2.0"` 冗余字段结构；严格人声对轴 Vocal Truth 原则与受 Git 追踪约定继续保留）。
- **数据迁移与持久化**：
  - 完整保留 `L001`–`L063`（63 句歌词严格人声区间）、`P001`–`P012`（12 个曲式段落）、`CLIP_01`（代表性验证片段）、`M0002`–`M0017`（14 个小节第一拍与 2 个拍点标记）、`sfx_accents` 与多级嵌套 `col_custom / grp_storyboard / visual_shots`；所有历史备注与协作批注统一迁移为 `comments: Comment[]`（`role: "human" | "agent"`），移除 JSON 中的哈希、溯源、确认状态与 UI 会话状态。
  - 保存时自动派生 `annotations/agent-brief.md`、`local/annotations/agent-brief.md`、`local/annotations/lyrics/try-me.ass`、`local/annotations/lyrics/try-me.lrc` 与 `public/private/annotations-preview.json`。
- **统一界面与交互能力**：
  - 实现低饱和青绿灰浅色界面（`#f3f5f5` 页面底、`#ffffff` 主面板、`#f8fafa` 次级栏、`#b8cdd2` 加深主波形底、`#355f69` 波形线、`#e7f2f2` 选中底、`#166b75` 主强调色、`#b44e32` 播放头，正文保持 `100%` 不透明）。
  - 落地递归 `TimelineExplorer`（显隐、继承锁、右键与 `···` 新建/重命名/非空子树影响统计与确认删除）、`EventListPane`（统一事件列表、右键与 `···` 新建点/新建区间/播放头切分/删除、时间轴设置与评论）、`UnifiedWorkbench`（单一 `TimelineEvent` 工作台、色退链 `event.color → track.color → #166b75` 实时预览与确认/取消/恢复自动、会话态 `BoundaryLink` 独立/联动/紧邻、500ms 切点试听 `A/S/R/D/F`、`下一条标注`、评论线程）与底部 `AgentBriefDrawer`。

## D011 — 2026-11-14：主波形沿用旧版 WaveSurfer

- 用户明确要求保留 Git 旧版波形显示。恢复 f8208f5 中的 WaveSurfer、Regions 与 Timeline 插件及 138px 波形／24px 刻度、原深色底、波形色与播放进度色，取消 v5 手绘 Canvas 和事件卡片叠层。这一要求替代 D009／D010 中主波形青灰配色的部分，其他面板与统一模型保持现状。
- 区间使用统一事件及可选颜色供给，不恢复旧版歌词专用模型。显示选中及相邻区间、其他事件起点；区域修改交给现有命令处理继承锁和边界关系。当前 App 音频元素仍是唯一播放时钟，WaveSurfer 仅同步显示。
- 实测真实分析数据读入、WaveSurfer 画布与 Regions 挂载、缩放及点击定位后的播放进度显示；实际听音、连续播放与拖动边界体验仍待验收。

## D012 — 2026-11-15：显隐与锁定图标

- 用户要求将时间轴树的“显”和“锁”替换为常见眼睛、锁图标，关闭态以 `/` 斜杠划去；因此可见/已锁定显示正常图标，隐藏/未锁定显示斜杠图标。
- 图标读取当前有效继承状态，不改变显隐与锁定模型；保留按钮文字提示、可访问名称与键盘聚焦入口。使用 Feather 的 MIT 图标形状，来源和许可见素材 A002，未添加依赖。
