# 本地声音分析

## 全曲鼓组与鼓掌对照

```powershell
npm run annotate:project -- read --out out/full-rhythm-snapshot-日期.json
.venv\Scripts\python.exe tools/audio-analyzer/analyze-full-rhythm.py --snapshot out/full-rhythm-snapshot-日期.json --output local/analysis/full-rhythm-日期
npm run annotate:project -- preview --input local/analysis/full-rhythm-日期/plan.json
npm run annotate:project -- apply --input local/analysis/full-rhythm-日期/plan.json
```

全曲HPSS中/高频瞬态结合已有共同网格，分别输出主节奏、弱拍/加花、鼓掌、重合/紧邻四条点轴。所有鼓组候选必须有实际起音证据，40ms内才吸附；原混合轴只读，鼓掌复制时保留确认、排除人类鼓组/Bass及高度匹配反例，再从旧原音波形分数补检少量常规鼓掌。分析依赖现有 `claps-v1` 参数/分数和当前 `trk_claps_v1`，不是通用乐器转录器。

首次结果为 `local/analysis/full-rhythm-v1/`：主节奏201、弱拍388、鼓掌205、配对64。配对中23处差≤40ms用红色，41处40–160ms用暖色；这表示起音接近，不证明两个已分离乐器同时演奏。HPSS打击成分可能含鼓掌本身，其他声源也可能误入弱拍；所有新增推断待试听。`analysis.json`保存音源哈希/版本/参数/全部证据，`curves.npz`保存完整曲线，`plan.json`交给统一接口预览与写入。

输出目录不可覆盖；已导入固定v1组时拒绝重跑覆盖用户修订。如需新一轮分析，先确定新版本组ID与新的输出目录，不能用旧计划重复导入。

## 鼓掌参考驱动的点轴

```powershell
.venv\Scripts\python.exe tools/audio-analyzer/analyze-claps.py
node tools/audio-analyzer/import-claps.ts
node tools/audio-analyzer/import-claps.ts --apply
```

分析读取当前七个「鼓掌音一声」和一个「鼓掌音两声」区间，各取最强的一次/两次起音。使用现有依赖，原音只在内存重采样。120ms mel 瞬态残差与3–10kHz波形互相关必须对同一个参考同时通过阈值；低音双声的第一下另设模板。鼓组重合参考不用于检索模板。节拍由参考和全曲强匹配拟合，细分到约140ms网格，只有距离网格35ms以内的音频匹配才吸附，不机械补点。

首次结果为 `local/analysis/claps-v1/analysis.json`（来源、哈希、参数、版本、原始起音及吸附记录）、`scores.npz`（完整分数）与 `candidate-track.json`（纯点轴，省略 `endSec`）。230个点中33个为低音变体候选。七个单声与双声共九次起音全部覆盖；排除同区间模板后八个常规实例仍检出。低音变体只有一个已标实例，尚无法独立验证，混音共享采样、人声遮挡等仍可能误检或漏检，需试听。

后续人工复核证明首次结果混入鼓组和Bass，不能再把旧「低音变体」作为统一鼓掌类别。2026-11-17的修订以14处人类备注为依据，范围截至71.461s，三频段/频谱对比及统一接口计划保存在 `local/analysis/claps-human-review-v2/`；原轴改为鼓掌/鼓组/Bass分色混合点轴，保留人工否定例与原ID，补回有音频证据的68.377s候选，合计231点。该范围后未重新分类，原始分析仍保留用于追溯；不要重跑v1覆盖已复核结果。

分析与导入都不覆盖已有结果：分析的 `--output` 必须指向 `local/analysis/` 内新目录；v1导入器固定读取 `claps-v1`，校验分析时主时间线/音源哈希、拒绝重复轨道或ID冲突，先隔离保存、备份再添加独立「鼓掌 · 全曲点轴」并同步七份工件。复跑不能直接替换用户已复核的轨道；当前人工参考变更或增加时需要相应调整分析入口。导入后在工作台点「重载」。

## 按参考区间检索音色

```powershell
.venv\Scripts\python.exe tools/audio-analyzer/find-timbre.py --output local/analysis/timbre-review-日期
```

读取当前 `trk_01` 的 `E001` / `E002` 人工参考，使用原混音及 HPSS 谐波成分的 mel / MFCC 窗口特征、全曲白化和附近背景对比检索全曲。只使用现有依赖；不安装模型、不上传、不改原音频或主时间线。输出目录必须是 `local/analysis/` 内的新目录，已有目录拒绝覆盖。

输出 `analysis.json`（参数、版本、音源与标注哈希、两个样本互检和24个候选）、`scores.npz`（全曲分数）、`report.md`、`review.html`（直接试听原 FLAC，候选前后各加0.5秒）。试听页保持原目录位置；浏览器本地文件播放限制见下文。

首次完整结果在 `local/analysis/timbre-v1-review/`。互检显示仍有约12.5% / 29.5%的全曲窗口比另一个已知样本得分更高，可靠性有限。候选分数只用于排序，不是识别概率；窗口长度沿用参考，不代表检测到了起止边界。HPSS 不是乐器分轨，混音中的相同人声、音高、和弦或背景均可能误检；需要人工试听，不应按此直接扩充已确认轨迹，也不能据未检出断言音色缺席。

## 节奏分析

基础分析入口仍为 `npm run analyze:audio`。新增节奏分析使用项目现有 `.venv`，不安装模型、不转码或修改原 FLAC。

```powershell
.venv\Scripts\python.exe tools/audio-analyzer/analyze-rhythm.py
.venv\Scripts\python.exe tools/audio-analyzer/test-rhythm.py
```

首次生成 `local/analysis/rhythm-v1/`。输出目录已存在时拒绝覆盖；复算可用 `--output local/analysis/rhythm-recheck-日期` 写入新目录并比较结果。`--focus-end 55.168` 控制供工作台复核的区间，连续特征与机器事件始终分析全曲。此版本的候选组 ID 固定为 v1，复算结果不能直接替换已导入、可能经过人工修订的组；后续版本需另设 ID 并人工筛选。

| 文件 | 用途 |
|---|---|
| `analysis.json` | 音源哈希、版本、参数、原采样索引、全曲机器事件与约50ms采样的连续强度曲线 |
| `candidate-group.json` | 前段工作台候选组，不含连续密集采样 |
| `report.md` | 数量、突变位置及使用限制 |
| `review.html` | 内嵌数据的本地诊断页，播放原 FLAC、选段循环、点击定位、查看频段响应和稀疏动作提示 |

试听页相对引用项目 `public/private/audio/try-me.flac`，无需第三方服务。应保持原目录位置。若浏览器不允许本地文件播放，可在本机项目根目录启动仅绑定回环地址的静态服务，再访问 `/local/analysis/rhythm-v1/review.html`；不得把含私有音源的项目服务公开。

算法使用 `22050 Hz` 内存重采样、`2048` 点居中 STFT、`220` 采样 hop；原始文件保持不变。低/中/高频分别为 `35–180 / 180–2000 / 2000–10000 Hz`。正向对数谱通量提取各频段起音；HPSS 的打击性通量用于节拍候选，谐波低频活动供持续低音变化对照。HPSS 不是乐器分离。

六条连续曲线是 `low / mid / high / harmonic_low / percussive / mix`。每条以全曲95百分位归一并限幅到 `[0,1]`，只用于本轨的相对强弱，不能跨轨比较音量；低频虚线是独立归一的谐波低频。若用于环境动画，需另设计幅度上限、衰减与视觉层级，不直接把所有尖峰变成大幅运动。

突变比较前后各约250ms窗口的能量与三频段比例；动作初筛每10秒至多取一个机器突变，与已选点至少间隔4秒，并优先保留主轨显式标注的“有bass”进入点。初筛只减轻复核负担，不推断乐句结构或音乐上的重要性。没有检测到的声音也可能值得强调。

机器起音的标称分辨范围约 ±50ms、突变约 ±250ms，均未经人工对齐验证。节拍有相位与半速/倍速歧义，不包含已确认的小节第一拍。输出秒数以原音源采样零点为基准，`original_sample_index` 使用原采样率；进入 Remotion 后再按已确认 FPS 和偏移换算整数帧。

初次导入工具：

```powershell
node tools/audio-analyzer/import-rhythm-candidates.ts --apply
```

工具固定读取 v1，校验音源与分析时主时间线哈希，校验项目格式，在 `out/` 隔离目录演练真实持久化并检查原节点保留，然后备份已有工件并追加候选组、同步派生文件。哈希变化、重复组或 ID 冲突均拒绝执行。默认不带 `--apply` 只运行隔离验证。人工编辑以当前主时间线为准，自动分析脚本本身不写主时间线。

分析与诊断页的首次验收时浏览器连接不可用，诊断页的实际布局/播放仍待确认。后续按用户要求，MV试作已接入待机拍点和部分Clawd姿态的候选时点；环境元素尚未接入连续频段曲线。

动作执行快照的复现入口（会重写候选时序代码与对照文档，运行后须检查差异）：

```powershell
node tools/audio-analyzer/plan-verse1-rhythm.ts
node --test tools/audio-analyzer/test-verse1-rhythm.ts
```

快照仅含数值拍点、姿态帧、候选ID与音源哈希，不在运行时读取私人原始分析。详见 `docs/verse1-rhythm.md`。终端出场、踮脚跳与365日原双点头是显式保护区间，不参与重定时。
