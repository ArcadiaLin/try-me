# Try Me — 多轨时间轴、脚本设计与 Agent 协作简报

> 本文件由 `apps/annotator/server/index.ts` 根据主时间线 `annotations/try-me.timeline.json` 自动生成并受 Git 追踪。

- 更新时间 (UTC)：`2026-11-12T16:34:15.906Z`
- 音源：`public/private/audio/try-me.flac` (SHA-256: `f0ec600dbf3d5571ed37fe58cd6832e697a737a431200df63ba7b6fadf72476d`, 采样率: `44100Hz`, 总采样帧: `9248635`, 时长: `209.719615s`)
- 关联自动分析轮次：`run_da87013e5373dbb1`
- 预览帧映射：`FPS = 60` (仅预览，非最终成片规格), `audioOffsetSeconds = 0s`, 全片帧公式 `videoFrame = Math.round((audioSeconds + audioOffsetSeconds) * fps)`
- 主唱人声严格对轴进度：`14 / 63` 句已人工确认（严格剥离句尾伴奏空隙）

## 1. 全局创作设定与给 Agent 的总体指令

- **核心概念 (Overall Concept)**：（暂未填写）
- **视觉风格与运动规则 (Visual Style)**：（暂未填写）
- **给 Agent 的总体要求 (Instructions for Agent)**：（暂未填写）

## 2. 待 Agent 处理的评论与任务队列 (Agent Action Queue)

当前没有待处理的专项评论或指令。

## 3. 区间标注与段落脚本设计 (Regions & Sections)

| ID | 标题 | 分类 | 状态 | 起止时间 (秒) | 全片预览帧 `[start, end)` | 关联镜头 | 音乐特征备注 | 画面脚本与设计构想 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P001` | Intro (前奏合成器与鼓进入) | `section` | `candidate` | `0.000s - 18.239s` (00:00.000–00:18.239) | `[F0, F1094)` | - | 8 小节纯器乐前奏（约 107.0 BPM，第 1 小节第一拍候选于 0.580s），建立轻快电子合成器律动。 | - |
| `P002` | Verse 1 (主歌 A：自我介绍与特长) | `section` | `confirmed` | `18.201s - 54.757s` (00:18.201–00:54.757) | `[F1092, F3285)` | - | 16 小节主歌（Bar 9–24）：前 8 小节每 2 小节一句英日交替，后 8 小节加密为每 1 小节一句，句尾『ほら！』带停顿。 | - |
| `P003` | Pre-Chorus 1 (导歌 1：Superstar 铺垫) | `section` | `candidate` | `54.750s - 63.031s` (00:54.750–01:03.031) | `[F3285, F3782)` | - | 4 小节导歌（Bar 25–28）：伴奏织体收敛，人声旋律拉长，为副歌『Try me!』蓄力。 | - |
| `CLIP_01` | CLIP_01 代表性验证片段 (Pre-Chorus 1 -> Chorus 1A) | `representative_clip` | `candidate` | `54.750s - 71.960s` (00:54.750–01:11.960) | `[F3285, F4318)` | - | 涵盖 Pre-Chorus 1 (Bar 25-28) 到 Chorus 1 前半 (Bar 29-32) 的情绪爆发转换（17.21s），适合验证歌词对轴、重拍切镜与画面同步。 | - |
| `P004` | Chorus 1 (副歌 1：Try me! 核心 Hook) | `section` | `candidate` | `63.031s - 81.150s` (01:03.031–01:21.150) | `[F3782, F4869)` | - | 8 小节主副歌（Bar 29–36，含弱起 63.031s）：全曲核心 Hook『Try me! Try me!』，高能量紧凑律动。 | - |
| `P005` | Post-Chorus 1 (副歌延伸：活动报菜名) | `section` | `candidate` | `81.150s - 90.250s` (01:21.150–01:30.250) | `[F4869, F5415)` | - | 4 小节副歌后段（Bar 37–40）：口白式连续报出三项活动，极具画面卡点潜力。 | - |
| `P006` | Verse 2 (主歌 B：性格原则与座右铭) | `section` | `candidate` | `90.250s - 125.841s` (01:30.250–02:05.841) | `[F5415, F7550)` | - | 16 小节第二段主歌（Bar 41–56）：结构与 Verse 1 对称（前 8 小节疏朗、后 8 小节密集），不经导歌直接推入 Chorus 2。 | - |
| `P007` | Chorus 2 (副歌 2：Try me! 第二次爆发) | `section` | `candidate` | `125.841s - 144.030s` (02:05.841–02:24.030) | `[F7550, F8642)` | - | 8 小节第二段副歌（Bar 57–64）：省略 Post-Chorus 报菜名，句尾直接切入 Bridge 上楼梯意象。 | - |
| `P008` | Bridge (桥段：Step by step 拾级而上) | `section` | `candidate` | `144.030s - 162.450s` (02:24.030–02:42.450) | `[F8642, F9747)` | - | 8 小节桥段（Bar 65–72）：每小节一句，围绕攀登阶梯、踊り場小憩与眺望风景展开。 | - |
| `P009` | Pre-Chorus 2 (导歌 2：终局前蓄力) | `section` | `candidate` | `162.450s - 170.661s` (02:42.450–02:50.661) | `[F9747, F10240)` | - | 4 小节导歌再现（Bar 73–76）：承接桥段尾句悬念，重新回到 Superstar 主题并引爆双副歌。 | - |
| `P010` | Chorus 3 (副歌 3：终局双副歌前半) | `section` | `candidate` | `170.661s - 188.610s` (02:50.661–03:08.610) | `[F10240, F11317)` | - | 8 小节副歌（Bar 77–84）：双副歌前半段，维持满编能量。 | - |
| `P011` | Chorus 4 (副歌 4：Fine society 终局变奏) | `section` | `candidate` | `188.610s - 206.634s` (03:08.610–03:26.634) | `[F11317, F12398)` | - | 8 小节终局副歌（Bar 85–92）：最后一句歌词变为『I'm seeking a position in a fine society』。 | - |
| `P012` | Outro (尾奏定格：Try me!) | `section` | `candidate` | `206.634s - 209.719s` (03:26.634–03:29.719) | `[F12398, F12583)` | - | 收尾定格呼喊『Try me!』（206.634s–207.830s）及尾音自然衰减至 209.719s。 | - |

## 4. 时间点标记 (Point Markers: 小节第一拍 / 重音 / 切镜点)

| ID | 标题 | 分类 | 状态 | 时间 (秒) | 全片预览帧 | 来源候选 | 关联镜头 | 音乐备注 | 视觉动作 / 切镜设计 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `M0003` | P002 Bar 9 (Verse 1) | `downbeat` | `candidate` | `15.506s` (00:15.506) | `F930` | manual | - | Verse 1 起始第一拍候选 (Bar 9.1) | - |
| `M0002` | P001 Bar 1 (Intro) | `downbeat` | `candidate` | `18.188s` (00:18.188) | `F1091` | manual | - | Intro 起始第一拍候选 (Bar 1.1) | - |
| `M0014` | M0014 | `beat` | `confirmed` | `18.530s` (00:18.530) | `F1112` | C_ONSET_0093@18.529524s | - | - | - |
| `M0015` | Bar (M0015) | `downbeat` | `confirmed` | `18.530s` (00:18.530) | `F1112` | C_ONSET_0093@18.529524s | - | - | - |
| `M0016` | M0016 | `beat` | `confirmed` | `18.530s` (00:18.530) | `F1112` | C_ONSET_0093@18.529524s | - | - | - |
| `M0017` | Bar (M0017) | `downbeat` | `confirmed` | `18.530s` (00:18.530) | `F1112` | C_ONSET_0093@18.529524s | - | - | - |
| `M0004` | P003 Bar 25 (Pre-Chorus 1) | `downbeat` | `candidate` | `54.404s` (00:54.404) | `F3264` | C_BEAT_0097@54.404354s | - | Pre-Chorus 1 起始第一拍候选 (Bar 25.1) | - |
| `M0005` | P004 Bar 29 (Chorus 1) | `downbeat` | `candidate` | `63.379s` (01:03.379) | `F3803` | C_BEAT_0113@63.378866s | - | Chorus 1 起始第一拍候选 (Bar 29.1) | - |
| `M0006` | P005 Bar 37 (Post-Chorus 1) | `downbeat` | `candidate` | `81.293s` (01:21.293) | `F4878` | C_BEAT_0145@81.293061s | - | Post-Chorus 1 起始第一拍候选 (Bar 37.1) | - |
| `M0007` | P006 Bar 41 (Verse 2) | `downbeat` | `candidate` | `90.279s` (01:30.279) | `F5417` | C_BEAT_0161@90.279184s | - | Verse 2 起始第一拍候选 (Bar 41.1) | - |
| `M0008` | P007 Bar 57 (Chorus 2) | `downbeat` | `candidate` | `126.189s` (02:06.189) | `F7571` | C_BEAT_0225@126.188844s | - | Chorus 2 起始第一拍候选 (Bar 57.1) | - |
| `M0009` | P008 Bar 65 (Bridge) | `downbeat` | `candidate` | `144.126s` (02:24.126) | `F8648` | C_BEAT_0257@144.126259s | - | Bridge 起始第一拍候选 (Bar 65.1) | - |
| `M0010` | P009 Bar 73 (Pre-Chorus 2) | `downbeat` | `candidate` | `162.075s` (02:42.075) | `F9725` | C_BEAT_0289@162.075283s | - | Pre-Chorus 2 起始第一拍候选 (Bar 73.1) | - |
| `M0011` | P010 Bar 77 (Chorus 3) | `downbeat` | `candidate` | `171.050s` (02:51.050) | `F10263` | C_BEAT_0305@171.049796s | - | Chorus 3 起始第一拍候选 (Bar 77.1) | - |
| `M0012` | P011 Bar 85 (Chorus 4) | `downbeat` | `candidate` | `188.987s` (03:08.987) | `F11339` | C_BEAT_0337@188.987211s | - | Chorus 4 起始第一拍候选 (Bar 85.1) | - |
| `M0013` | P012 Bar 93 (Outro) | `downbeat` | `candidate` | `206.367s` (03:26.367) | `F12382` | C_BEAT_0368@206.367347s | - | Outro 起始第一拍候选 (Bar 93.1) | - |

## 5. 自由扩展时间轴轨道 (Custom Timeline Tracks)

### 轨道 `sfx_accents` — 效果音与器乐特色音轴 (SFX & Instruments) (type: `sfx`, allow_overlap: `true`)

- **Agent 轨道用途说明**：标记铜管乐器（如 L012 句尾ほら！）、合成器滑音、鼓组过门 Fill 等需要特殊视觉响应的声音事件，允许与人声轴或同轨内其他事件任意重叠。

（暂无标注项）

### 轨道 `visual_shots` — MV 分镜与画面动作轴 (Storyboard Shots) (type: `shot`, allow_overlap: `true`)

- **Agent 轨道用途说明**：标记 S001 等镜头区间、句间伴奏空隙的插入镜头及角色表演卡点，挂载完整的画面脚本与 Agent 批注。

（暂无标注项）
