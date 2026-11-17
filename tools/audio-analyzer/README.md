# 本地声音分析

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
