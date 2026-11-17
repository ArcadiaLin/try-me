---
name: try-me-annotator
description: 在 Try Me 项目的标注工作台中新增或编辑时间轴、点、区间和脚本备注，或将本地声音分析结果导入工作台时使用。使用项目批量接口保留人工标注并同步派生文件；不用于一般音频知识问答或 Remotion 动画制作。
---

# Try Me 标注协作

将用户描述或分析结果变成工作台可审阅的数据。修改范围以本次授权为准；分析和工作台写入分开，结果应实际出现在工作台中。

## 入口

从仓库根目录运行 `npm run annotate:project -- read`，获取当前 `{revision,project}`。首次使用或需要确定操作参数时，阅读 [批量接口说明](../../../docs/annotator/agent-api.md)。接口实现为 `apps/annotator/server/agent-operations.ts`，类型以 `apps/annotator/web/src/types.ts` 为准。

用 JSON 计划表达 `addGroup`、`addTrack`、`addEvents`、`updateEvent`、`updateTrack` 或 `appendComment`，设置 `baseRevision` 为本次读取结果；先 `preview --input 文件`，检查目标与摘要，然后按用户已授权范围 `apply --input 文件`。计划和分析文件放 `local/`，预览、备份和验收产物放 `out/`；不用 shell 拼接 JSON 或每次另写备份/导入脚本。

接口已负责批量校验、重复ID检查、备份、写锁、冲突拒绝与七份持久化文件同步。遇409重新读工程并核对差异后重建计划；不要只更新revision重试。旧版导入脚本不统一遵守此锁，新增写入优先走批量接口。

## 数据与协作

- 使用稳定ID和当前工程实际父级。点省略 `endSec`，区间使用 `[startSec,endSec)`；原音源零点的秒数不与视频帧混用。删除、搬移节点或修改已有评论不在首版接口中，按实际任务使用工作台能力。
- 新声音检测结果放独立候选轨道，注明参考ID、方法及待试听状态；保留用户原参考和已修改的候选，不按同色、相似节奏或频段直接确认同种乐器。用户已明确确认的内容照其授权记录。
- 脚本建议用 `appendComment` 追加独立 `agent` 记录，保留人类原文、多行、空行和作者；只有实际用户提供的内容才记作 `human`，不要冒充人工确认。
- 音频分析使用项目 `.venv/`。先看 `tools/audio-analyzer/README.md` 的现有工具；`analyze-claps.py` 和 `find-timbre.py` 当前绑定特定参考，不是通用声音识别器。新算法可编写脚本，通用写入部分不再重复实现。原音、模型、机器曲线和分轨保持本地；不自动上传或转码原音轨。
- API操作不读取页面未保存草稿和会话锁；避免在用户仍编辑同一内容时覆盖其意图。写入后通过读取接口验证ID、点/区间类型、数量及来源；说明页面需「重载」，不要把磁盘/API验证说成已经试听。

修改接口代码时运行隔离的 `npm run test:agent-operations`，再按项目要求运行lint和仓库检查。不要直接运行会写真实工程的旧集成测试；使用合成fixture。最后报告新增/修改范围、实际验证和仍待试听部分。
