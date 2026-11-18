import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import type { RhythmKey, RhythmPlan } from "../../apps/mv/src/timeline/rhythm-timing.ts";

const root = process.cwd();
const analysis = JSON.parse(fs.readFileSync(path.join(root, "local/analysis/rhythm-v1/analysis.json"), "utf8"));
assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, analysis.audio.path))).digest("hex"), analysis.audio.sha256);
type Candidate = { id: string; time_sec: number; strength?: number; score?: number; reason?: string; label?: string };
// Pose: [progress, label, candidate track?, authored source second override?]
type Pose = [number, string, string?, number?];
// fromSec: the plan begins at this second (progress = from) while later poses keep the start..end mapping with base `mapFrom`.
type Spec = { id: string; start: number; end: number; from?: number; to?: number; mapFrom?: number; fromSec?: number; poses: Pose[] };
// Hey 段 (wave-step progress 0 → 0.36) 由 apps/mv/src/timeline/hey-wave.ts 按半拍网格线性驱动，计划只接管 19.9s (HEY_END) 之后的前送与蹲起。
const HEY_END_SEC = 597 / 30;
const specs: Spec[] = [
  { id: "wave", start: 18.525, end: 22.721, from: .36, mapFrom: 0, fromSec: HEY_END_SEC, poses: [[.4788, "前送下压", "beat"], [.64, "前送结束"], [.74947, "蹲起峰值", "low"]] },
  { id: "invite", start: 22.721, end: 27.161, poses: [[.2, "邀请姿态展开", "beat"], [.68, "停顿结束"], [.92, "视线回正", "beat"]] },
  { id: "posture", start: 27.161, end: 31.695, poses: [[.12, "收拢下压", "beat"], [.24, "收拢结束"], [.35, "挺身峰值", "beat"], [.46, "挺身结束"], [.54, "第一次点头", "low"], [.62, "第一次回正"], [.73, "第二次点头", "low"], [.84, "点头结束"]] },
  { id: "present", start: 31.695, end: 34.026, poses: [[.14, "指向自己", "beat"], [.32, "内收保持结束"], [.44, "内收结束"], [.58, "展示张开", "beat"], [.82, "展示保持结束"]] },
  { id: "crouch", start: 34.026, end: 35.34, to: (35.34 - 34.026) / (35.82 - 34.026) * .65, poses: [[.21, "贴地下压", "low"], [.42, "下压回正"]] },
  // 左右两个重心极点与换向中心都落在相邻候选拍点 (F1244 / F1261 / F1278)，句尾 9 帧回正交接 L008
  { id: "sway", start: 40.8, end: 42.91, poses: [[.25, "右侧重心", "beat"], [.5, "换向中心", "beat", 1261 / 30], [.75, "左侧重心", "beat", 1278 / 30]] },
  { id: "reply", start: 43.95, end: 44.72, from: .62, to: .84, poses: [[.73, "回应点头", "beat"]] },
  { id: "read", start: 45.36, end: 49.892, poses: [[.12, "低头读书", "beat"], [.56, "跨句开始抬头"], [.7, "抬头挺身", "beat"], [.86, "挺身保持结束"]] },
  { id: "trumpet", start: 49.892, end: 52.576, poses: [[.22, "接住小号", "beat"], [.49, "吹奏中段", "beat"], [.76, "放低小号", "beat"]] },
  { id: "pop", start: 52.576, end: 54.476, poses: [[.14, "弹起前蓄力", "low"], [.21, "弹起伸展峰值", "high"], [.3, "回弹下压", "low"], [.46, "弹起回正"]] },
];
const fps = 30;
const plans: RhythmPlan[] = specs.map((s) => {
  const from = s.from ?? 0, to = s.to ?? 1, mapFrom = s.mapFrom ?? from;
  const sourceFrame = (p: number, overrideSec?: number) => Math.round((overrideSec !== undefined
    ? overrideSec
    : s.id === "read"
      ? p <= .56 ? 45.36 + p / .56 * (47.58 - 45.36) : 47.58 + (p - .56) / .44 * (49.892 - 47.58)
      : s.start + (p - mapFrom) / (to - mapFrom) * (s.end - s.start)) * fps);
  const allPoses: Pose[] = [[from, "开始", undefined, s.fromSec], ...s.poses, [to, "结束"]];
  const keys: RhythmKey[] = allPoses.map((p) => ({
    frame: sourceFrame(p[0], p[3]), sourceFrame: sourceFrame(p[0], p[3]), progress: p[0], label: p[1],
  }));
  // Keep phase boundaries fixed. Bounded, monotone targets avoid reversing or crushing poses.
  for (let i = 1; i < keys.length - 1; i++) {
    const track = s.poses[i - 1][2];
    if (!track) continue;
    const k = keys[i];
    const maxShift = s.id === "pop" ? 3 : 6;
    const previous = keys[i - 1], next = keys[i + 1];
    const min = previous.frame + Math.max(1, Math.ceil((k.sourceFrame - previous.sourceFrame) * .5));
    const max = next.sourceFrame - Math.max(1, Math.ceil((next.sourceFrame - k.sourceFrame) * .5));
    const choices = (analysis.tracks[track] as Candidate[]).map(e => ({ ...e, frame: Math.round(e.time_sec * fps) }))
      .filter(e => Math.abs(e.frame - k.sourceFrame) <= maxShift && e.frame >= min && e.frame <= max)
      .sort((a, b) => Math.abs(a.frame - k.sourceFrame) - Math.abs(b.frame - k.sourceFrame));
    if (choices[0]) Object.assign(k, { frame: choices[0].frame, sourceId: choices[0].id, sourceTrack: track });
  }
  for (let i = 1; i < keys.length; i++) assert(keys[i].frame > keys[i - 1].frame, `${s.id}: colliding frames`);
  return { id: s.id, keys };
});

// Reference beat grid (trk_rc_beat_v1). Runtime code fits a continuous grid from these integer frames.
const rawBeats = (analysis.tracks.beat as Candidate[]).filter(e => e.time_sec < 55.168);

const data = {
  fps,
  status: "candidate",
  audioSha256: analysis.audio.sha256,
  beatFrames: [...new Set(rawBeats.map(e => Math.round(e.time_sec * fps)))],
  plans,
};
fs.mkdirSync(path.join(root, "apps/mv/src/timeline"), { recursive: true });
fs.writeFileSync(path.join(root, "apps/mv/src/timeline/verse1-rhythm.ts"),
  "// Authored candidate timing snapshot. Regenerate only after reviewing the diff.\n" +
  "export const VERSE1_RHYTHM = " + JSON.stringify(data, null, 2) + " as const;\n");
const rows = plans.flatMap(p => p.keys.filter(k => k.sourceId).map(k =>
  `| ${p.id} | ${k.label} | ${k.sourceFrame} | ${k.frame} | ${k.frame - k.sourceFrame > 0 ? "+" : ""}${k.frame - k.sourceFrame} | ${k.sourceId} |`));
fs.writeFileSync(path.join(root, "docs/verse1-rhythm.md"),
  "# Verse 1 动作节奏对照\n\n当前试作 30 FPS；下表为整数执行帧。机器节奏仍待试听，不等于已确认重拍。\n\n" +
  `音源 SHA-256：\`${analysis.audio.sha256}\`。候选源：\`local/analysis/rhythm-v1/analysis.json\`。\n\n` +
  "## 1. 连续拍网格与待机律动\n\n" +
  "- `beatFrames` 是 `trk_rc_beat_v1` 的整数帧快照（间隔在 16/17/18 帧之间跳动）。运行时用最小二乘拟合出连续拍网格（候选约 16.82 帧/拍，残差 < 1 帧），待机摆动与律动相位按连续网格计算，避免整数取整造成的速度抖动。\n" +
  "- 待机律动为“快压慢回”：拍前约 0.12 拍压下、拍后约 0.45 拍回弹，拍间保持静止；左右重心极点落在拍点上，各句不重置相位。\n" +
  "- 叙事动作期间保留 22% 的纵向律动底层（只上下、不左右），避免长保持段完全静止；终端跃出与 365日点头保护区间 `[35.34s,40.8s)` 及 ほら！ 回弹不叠加。\n" +
  "- 小节第一拍尚未人工确认，因此暂不做强弱拍层级。\n\n" +
  "## 2. 动作关键姿态对拍\n\n" +
  "主要姿态按就近拍点/低高频起音调整时间，保持动作相序和句子起止。一般最多移动6帧，短促回弹最多3帧；无附近合适候选则保留原时点。以下仅列已关联候选的姿态；准备、保持和回正等阶段边界仍固定。\n\n" +
  "- `L001` Hey 段（`18.43s → 19.9s`，wave-step 进度 `0 → 0.36`）不走计划插值，由 `apps/mv/src/timeline/hey-wave.ts` 线性驱动：1 帧预备下沉 → 人声后 2 帧内抬身到位 → 三次挥爪各占半拍，爪尖最高点落在半拍网格上 → 半拍回落。`hey` 气泡与挥爪共用同一相位。\n" +
  "- `L007` 换重心：右极点、换向中心、左极点分别落在 `F1244 / F1261 / F1278`。\n\n" +
  "保护区间 `[35.34s,40.8s)` 的舞台位置、缩放、跳出、踮脚跳和365日双点头保持原样；不加入新摆动、呼吸或重定时。\n\n" +
  "| 动作 | 关键姿态 | 原帧 | 目标帧 | 移动帧数 | 候选来源 |\n|---|---|---:|---:|---:|---|\n" + rows.join("\n") + "\n");
console.log(`Generated ${plans.length} action plans and ${data.beatFrames.length} reference beats.`);