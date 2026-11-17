# 工作台批量操作接口

Agent 写入轨道、点/区间和脚本备注时，优先使用本接口，避免为每次任务重写备份、校验及持久化。音频检测算法仍独立存在于 `tools/audio-analyzer/`；它们产出数据，接口负责修改工作台。

## 命令行

在项目根目录执行，无需启动工作台，也不依赖固定端口：

```powershell
npm run annotate:project -- read --out local/annotations/snapshot-日期.json
npm run annotate:project -- preview --input local/annotations/plan-日期.json --out out/preview-日期.json
npm run annotate:project -- apply --input local/annotations/plan-日期.json --out out/applied-日期.json
```

`read` 返回 `{revision, project}`，revision 为主时间线原始字节的 SHA-256，不进入业务 JSON。把此次读到的 revision 填入计划的 `baseRevision`。`preview` 返回变更摘要与完整预期工程，不写工作台数据；`apply` 才写入。`--out` 必须为项目 `local/` 或 `out/` 下的新文件；省略时将完整 JSON 打印到标准输出。`--root` 仅用于明确指定其他工程根目录或隔离测试。

计划示例（合成数据，实际任务替换 ID 与时间；不要原样导入）：

```json
{
  "baseRevision": "填入本次read返回的revision",
  "operations": [
    {
      "op": "addTrack",
      "parentId": "col_lyrics",
      "afterId": "trk_01",
      "node": {
        "kind": "timeline",
        "id": "trk_example_candidates_v1",
        "name": "声音候选 · 待试听",
        "color": "#956644",
        "items": [
          {"id": "EXAMPLE_0001", "startSec": 12.345, "text": "起音候选"},
          {"id": "EXAMPLE_0002", "startSec": 14, "endSec": 14.5, "text": "区间候选"}
        ],
        "comments": [{"role": "agent", "text": "检测方法、参考ID、音源版本及确认状态。"}]
      }
    },
    {
      "op": "appendComment",
      "trackId": "trk_example_candidates_v1",
      "eventId": "EXAMPLE_0001",
      "comment": {"role": "agent", "text": "脚本建议第一行\n第二行，待用户确认。"}
    }
  ]
}
```

操作按顺序解释，后面的操作可以引用同一计划中新建的节点。不要依赖文件中的示例 ID；先读当前工程。

| 操作 | 参数与行为 |
|---|---|
| `addGroup` | `node: {kind:"group", id, name, children:[], comments?}`；可选 `parentId`、`afterId` |
| `addTrack` | `node: {kind:"timeline", id, name, items:[], color?, comments?}`；items也可直接包含事件；可选 `parentId`、`afterId` |
| `addEvents` | `trackId`、非空 `events` 数组，追加事件，拒绝重复ID |
| `updateEvent` | `trackId`、`eventId`、`patch`；只支持 `startSec`、`endSec`、`text`、`color`；`endSec:null` 转成点，`color:null` 恢复继承 |
| `updateTrack` | `trackId`、`patch:{name?,color?}`，`color:null` 删除覆盖色 |
| `appendComment` | `comment:{role,text}`；项目级省略目标，节点级用 `nodeId`，事件级用 `trackId`+`eventId`；保留既有评论及顺序 |

省略或设 `parentId:null` 表示根层；`afterId` 必须属于该父级，不设置则追加。点省略 `endSec`，区间使用 `[startSec,endSec)`，所有时间以原音源零点为准，单位秒。接口不把秒数转换成视频帧，也不全局舍入或排序已有人工数据。ID唯一，不能复用旧ID覆盖人工复核结果。修改已有评论、删除或移动节点目前仍使用工作台，不在这个首版批量接口中提供。

## HTTP

重启标注服务以载入新代码：`npm run annotate`，默认仅监听 `127.0.0.1:4321`。已经运行的旧进程不会自动载入新增路由；命令行入口可立即使用。

| 请求 | 返回/请求体 |
|---|---|
| `GET /api/agent/project` | `{revision,project}` |
| `POST /api/agent/operations` | `{baseRevision,operations,mode?:"preview"\|"apply"}`，默认preview |

成功返回 `mode`、`baseRevision`、`changes`、`project`；apply另返回新 `revision` 与相对 `backup` 路径。坏操作返回400，旧revision或写锁冲突返回409。遇409应重新读取、核对用户新修改并重建计划，不能只替换revision然后盲重试。

网页常规读取接口同时返回revision，新页面保存时带 `baseRevision`；Agent提交后旧页面保存会得到冲突提示。兼容保留的无revision旧请求不具备此保护，因此启用新服务后也应刷新页面加载新前端。独立的旧导入脚本和直接写文件不会自动遵守新锁，后续新增写入应使用本接口。

## 保存与边界

- 批次全量校验通过后才写入，不接受未知操作或未知字段；不提供整份工程替换或默认删除。
- apply获取项目写锁；备份七份当前工件及请求到 `out/annotator-operations/batch-*/`，提交前再次检查revision，随后复用 `persistProjectArtifacts` 同步主时间线、两份简报、本地备份、ASS/LRC及预览。
- 保存过程抛出异常时恢复七份原文件；进程突然终止或系统断电不保证跨文件原子性，保留备份供恢复。遗留 `.write-lock` 时先检查是否仍有写进程，不能自动删除仍被使用的锁。
- 未改动的节点、事件、评论及高精度秒数按原数据保留。先保存页面内需要保留的编辑，再做外部批量修改；导入后在页面点「重载」。接口不强制重载页面、不读取未保存草稿或会话锁定状态，也不证明声音已人工确认。
- 所有测试使用 `out/` 下合成工程；`npm run test:agent-operations` 不写真实标注。前端交互与音频试听另行验证。
