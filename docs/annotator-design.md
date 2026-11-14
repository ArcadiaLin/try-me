# Annotate 界面设计提案 v4

状态：2026-11-14。已补充配色要求与精简存储规格，仍是设计方案，尚未迁移真实标注或接入运行界面。

- [完整设计图](design.review.svg)：主界面与 15 个箭头说明框，包含配色和存储要求。
- [可编辑 Excalidraw](design.refined.excalidraw)、[净版主界面](design.refined.svg)。
- [精简类型定义](annotator-design.types.ts)、[完整 JSON 示例](annotator-design.example.json)。

图中时间、波形、事件和 JSON 示例都是合成示意。原始 design.excalidraw 不变；编辑前快照在 local/design/。类型文件仅作为设计规格，不被应用导入。

## 配色要求

延续已认可的低饱和青绿灰，使用浅底色与轻边框形成层次。

| 用途       | 色值      | 使用方式                     |
| ---------- | --------- | ---------------------------- |
| 页面背景   | `#f3f5f5` | 面板之间的背景               |
| 主编辑面板 | `#ffffff` | 列表、输入框与正文区         |
| 次级面板   | `#f8fafa` | Explorer、Header 等辅助区域  |
| 主音轨背景 | `#d7e4e7` | 比其余轨道更深，突出波形     |
| 波形线     | `#567e87` | 波形主体                     |
| 选中背景   | `#e7f2f2` | 选中的事件或轨道             |
| 强调色     | `#166b75` | 主要操作、选中描边、说明箭头 |
| 正文       | `#263238` | 主要文字                     |
| 辅助文字   | `#637079` | 提示与次要信息               |
| 边框       | `#cbd2d6` | 面板分隔与普通控件边框       |
| 播放头     | `#b44e32` | 少量使用，以区别于选区       |

文本保持完整不透明度，不通过降低父容器 opacity 来获得通透感。通透感主要来自浅色层次；选区叠层需要透明度时可从强调色约 10% alpha 起调，文字独立绘制。避免高饱和大面积填色、厚重阴影和模糊玻璃层。颜色不单独承载信息，人类/Agent 作者、锁定与选中均保留明确文字或控件表现。

配色属于界面规范，不复制到每个事件的业务 JSON。

## 存储要求：一份最小 JSON

需要表达的内容只有项目、多层分组、多条时间线、标注事件，以及人类和 Agent 的批注。JSON 易读、易修改，避免把分析清单、缓存或内部状态混进主文件。

| 对象     | 必需字段                        | 可选字段         |
| -------- | ------------------------------- | ---------------- |
| Project  | version、name、nodes            | audio、comments  |
| Group    | kind: group、id、name、children | comments         |
| Timeline | kind: timeline、id、name、items | comments         |
| Event    | id、startSec、text              | endSec、comments |
| Comment  | role: human 或 agent、text      | 无               |

`version: 1` 是本次精简格式的版本，不是旧格式 0.2.0 的自动升级结果。`audio` 是相对项目根目录的音源路径，可省略以便只查看标注。音源时长从实际音频读取，不在主文件重复记录采样率、采样数或指纹。

Group.children 可以继续包含 Group 或 Timeline，根 nodes 也可以直接放 Timeline；不限制为固定的音乐/视觉分组。数组顺序就是展示与导出顺序，不再额外存 parentId、collectionId、排序表等重复结构。稳定 ID 用于定位和修改，不是哈希。

事件统一保存音频秒数：startSec 表示开始或瞬时点；存在 endSec 时表示 `[startSec, endSec)` 区间，不存在时表示点。不再单独写 kind: point/region，也不同时保存视频帧、采样位置和多个原始时间副本。text 是标注正文，不重复设置 label、title、lyricText 等同义字段。

### 批注统一为 comments

项目、分组、时间线和事件都可以带同一种 comments 数组：

```json
"comments": [
  { "role": "human", "text": "文字提前出现，但不要改动人声边界。" },
  { "role": "agent", "text": "可以先调整视觉入场时机，保留标注时间。" },
  { "role": "human", "text": "先做预览。" }
]
```

每条批注只有作者角色与正文，数组顺序就是讨论顺序，支持连续追加多轮意见与回复。空批注直接省略 comments。全局要求写在项目批注，局部意见写在对应对象；画面构想、备注和处理说明也可以作为批注，不另造 agent_comment、agent_reply、scriptIdea、任务队列或状态机。

Agent 抽屉汇总并定位这些批注，可按对象、作者筛选；不根据最后发言者猜测“待办/完成”。列表中的批注数和最近作者从 comments 推导，不另存统计字段。简报由 JSON 派生，不成为另一份需要双向同步的事实来源。当前设计没有自动调用模型的后台任务，仍由用户在对话中发起处理。

### 从持久化格式中移除

- 音频 hash、SHA、revision、分析运行 ID、候选指纹和原始采样索引等校验/溯源字段。
- 独立的批注状态、指令/回复字段、全局备注对象、通用 metadata 和空值占位。
- preview_mapping、FPS、播放位置、倍速、循环、锁、可见性、面板宽度、离线草稿等编辑器状态。
- boundary_links 等会话关系。边界联动只保存操作后的事件起止，重载后不自动恢复编辑会话中的绑定。

以上不再是用户维护业务 JSON 的负担。播放器需要的秒帧换算、当前音源时长等由运行时配置与音频读取负责；机器分析如后续需要仍可作为独立本地文件使用，不嵌入人工主时间线。

读入只需做基本结构检查、稳定 ID 唯一检查、有限时间值及 startSec < endSec 等合法性检查；不设计额外 hash 验证流程。JSON 的序列化能还原树形不代表应用已完成保存重载实现，后续仍需实际运行验收。

## 主界面与编辑能力

保持 Header → Tracker → Explorer / 统一列表 / Workbench 的布局。所有标注共用 TimelineEvent 与一套 Workbench，不按歌词、节奏、结构或自定义语义切换编辑器。

- Explorer 管理递归 Group 和 Timeline，搜索、折叠、显隐、锁定属于界面能力。
- Tracker 共用一套时间窗口与播放头，波形、事件与未来画面预览使用相同时间映射。
- 列表展示正文、时间、批注数和最近作者，统计从 comments 推导。选择通过 trackId + eventId 定位，不使用列表下标。
- Workbench 编辑 text、startSec、可选 endSec 与 comments。没有事件选择时显示时间线设置。
- 所有事件可平移，区间可拖边界、切分、整段循环或做切点预听。点事件只隐藏区间操作，不更换编辑器。
- 联动已有公共边界与主动设为紧邻是不同动作；默认独立，保留真实人声留白。联动修改两端时作为一次可撤销操作处理。
- 预听窗口默认 500ms，输入文字时不截获 A / S / R / D / F；“下一条标注”只切换选择，不自动写入确认状态。

颜色、播放与布局偏好可由客户端单独管理，但不要求在导出的业务 JSON 中携带。现有保存中的 hash 与 revision 机制尚未改动；本轮精简的是下一版格式与实现要求，真实数据迁移另行实施。迁移时应把已有备注、画面构想、Agent 指令和回复映射到 comments，保留正文、ID、时间和层级，不直接删除真实内容。

## 工程类型与检查范围

持久化类型只有 TimelineProject、TimelineGroup、TimelineTrack、TimelineEvent、Comment；Commented 仅复用可选 comments 字段。类型文件内的 SelectionState、TimelineViewState、TransportState、WorkbenchCommand、BoundaryLink、WorkspaceLayoutState 和 PersistenceState 都是编辑器内存状态，不会自动变成 JSON 字段。EventAdapter 仅承担过渡期旧数据转换。

主界面及说明框由 tools/design/review-annotator-design.mjs 导出，执行前在 local/design 留存快照；后续手工修改设计后应先同步脚本，避免盲目重跑。旧 v1 生成器已保护现有设计，不会覆盖本稿。

本轮检查设计图实际渲染、简化类型、合成 JSON 与其类型的一致性、嵌套和批注示例、lint 与仓库静态规则。真实格式迁移、跨端同步、保存重载和试听不在本轮已实现范围。
