import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import type { RhythmKey, RhythmPlan, StageBeatKey, StagePulseKey } from "../../apps/mv/src/timeline/rhythm-timing.ts";

const root = process.cwd();
const analysis = JSON.parse(fs.readFileSync(path.join(root, "local/analysis/rhythm-v1/analysis.json"), "utf8"));
assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, analysis.audio.path))).digest("hex"), analysis.audio.sha256);
type Candidate = { id: string; time_sec: number; strength?: number; score?: number; reason?: string; label?: string };
type Pose = [number, string, string?];
type Spec = { id: string; start: number; end: number; from?: number; to?: number; poses: Pose[] };
const specs: Spec[] = [
  { id: "wave", start: 18.525, end: 22.721, poses: [[.19, "挥手主姿态", "high"], [.38, "挥手结束"], [.4788, "前送下压", "beat"], [.64, "前送结束"], [.74947, "蹲起峰值", "low"]] },
  { id: "invite", start: 22.721, end: 27.161, poses: [[.2, "邀请姿态展开", "beat"], [.68, "停顿结束"], [.92, "视线回正", "beat"]] },
  { id: "posture", start: 27.161, end: 31.695, poses: [[.12, "收拢下压", "beat"], [.24, "收拢结束"], [.35, "挺身峰值", "beat"], [.46, "挺身结束"], [.54, "第一次点头", "low"], [.62, "第一次回正"], [.73, "第二次点头", "low"], [.84, "点头结束"]] },
  { id: "present", start: 31.695, end: 34.026, poses: [[.14, "指向自己", "beat"], [.32, "内收保持结束"], [.44, "内收结束"], [.58, "展示张开", "beat"], [.82, "展示保持结束"]] },
  { id: "crouch", start: 34.026, end: 35.34, to: (35.34 - 34.026) / (35.82 - 34.026) * .65, poses: [[.21, "贴地下压", "low"], [.42, "下压回正"]] },
  { id: "sway", start: 40.8, end: 42.91, poses: [[.25, "右侧重心", "beat"], [.5, "换向中心"], [.75, "左侧重心", "beat"]] },
  { id: "reply", start: 43.95, end: 44.72, from: .62, to: .84, poses: [[.73, "回应点头", "beat"]] },
  { id: "read", start: 45.36, end: 49.892, poses: [[.12, "低头读书", "beat"], [.56, "跨句开始抬头"], [.7, "抬头挺身", "beat"], [.86, "挺身保持结束"]] },
  { id: "trumpet", start: 49.892, end: 52.576, poses: [[.22, "接住小号", "beat"], [.49, "吹奏中段", "beat"], [.76, "放低小号", "beat"]] },
  { id: "pop", start: 52.576, end: 54.476, poses: [[.14, "弹起前蓄力", "low"], [.21, "弹起伸展峰值", "high"], [.3, "回弹下压", "low"], [.46, "弹起回正"]] },
];
const fps = 30;
const plans: RhythmPlan[] = specs.map((s) => {
  const from = s.from ?? 0, to = s.to ?? 1;
  const sourceFrame = (p: number) => Math.round((s.id === "read"
    ? p <= .56 ? 45.36 + p / .56 * (47.58 - 45.36) : 47.58 + (p - .56) / .44 * (49.892 - 47.58)
    : s.start + (p - from) / (to - from) * (s.end - s.start)) * fps);
  const keys: RhythmKey[] = [[from, "开始"], ...s.poses, [to, "结束"]].map((p) => ({
    frame: sourceFrame(p[0] as number), sourceFrame: sourceFrame(p[0] as number), progress: p[0] as number, label: p[1] as string,
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

// Sample continuous waveform envelopes at a given timestamp.
function sampleEnvelope(key: "low" | "mid" | "high" | "percussive" | "mix", sec: number): number {
  const times = analysis.envelopes.times_sec as number[];
  const values = analysis.envelopes[key] as number[];
  const idx = Math.max(0, Math.min(values.length - 1, Math.round(sec / analysis.parameters.curve_step_sec)));
  assert(Math.abs(times[idx] - sec) <= 0.08);
  return values[idx];
}

// Build stage base tightening keyframes from trk_rc_beat_v1 and nearby band onsets.
const rawBeats = (analysis.tracks.beat as Candidate[]).filter(e => e.time_sec < 55.168);
const lowOnsets = (analysis.tracks.low as Candidate[]).filter(e => e.time_sec < 55.168);
const midOnsets = (analysis.tracks.mid as Candidate[]).filter(e => e.time_sec < 55.168);
const highOnsets = (analysis.tracks.high as Candidate[]).filter(e => e.time_sec < 55.168);

const stageBeats: StageBeatKey[] = rawBeats.map((b) => {
  const beatFrame = Math.round(b.time_sec * fps);
  const isPreBass = b.time_sec < 9.45;
  const searchPools: [string, Candidate[]][] = isPreBass
    ? [["mid", midOnsets], ["high", highOnsets], ["low", lowOnsets]]
    : [["low", lowOnsets], ["mid", midOnsets], ["high", highOnsets]];

  let matchedOnset: Candidate | undefined;
  let matchedTrack: string | undefined;
  for (const [trackName, pool] of searchPools) {
    const near = pool
      .map(e => ({ ...e, frame: Math.round(e.time_sec * fps) }))
      .filter(e => Math.abs(e.frame - beatFrame) <= 1)
      .sort((a, c) => Math.abs(a.time_sec - b.time_sec) - Math.abs(c.time_sec - b.time_sec))[0];
    if (near) {
      matchedOnset = near;
      matchedTrack = trackName;
      break;
    }
  }
  // If no onset within ±1 frame, check ±2 frames for onset strength reference while keeping frame within ±1 of beatFrame.
  if (!matchedOnset) {
    for (const [trackName, pool] of searchPools) {
      const near2 = pool
        .map(e => ({ ...e, frame: Math.round(e.time_sec * fps) }))
        .filter(e => Math.abs(e.frame - beatFrame) <= 2)
        .sort((a, c) => Math.abs(a.time_sec - b.time_sec) - Math.abs(c.time_sec - b.time_sec))[0];
      if (near2) {
        matchedOnset = near2;
        matchedTrack = trackName;
        break;
      }
    }
  }

  const targetFrame = matchedOnset && Math.abs(Math.round(matchedOnset.time_sec * fps) - beatFrame) <= 1
    ? Math.round(matchedOnset.time_sec * fps)
    : beatFrame;

  const lowEnv = sampleEnvelope("low", b.time_sec);
  const midEnv = sampleEnvelope("mid", b.time_sec);
  const percEnv = sampleEnvelope("percussive", b.time_sec);
  const onsetStr = matchedOnset?.strength ?? 0.65;

  let strength: number;
  if (isPreBass) {
    // L066 前奏（无bass）：纯合成器段幅度克制，保留清晰结构
    strength = 0.36 + 0.22 * (0.5 * midEnv + 0.5 * onsetStr);
  } else {
    // 9.512s bass 进入后：按低频、打击分量与起音强度组织收紧幅度
    strength = 0.58 + 0.42 * Math.min(1, 0.42 * lowEnv + 0.30 * percEnv + 0.28 * onsetStr);
  }

  // 角色与道具密集表演段适度降低底座律动幅度，避免抢戏；重点卡点处恢复强调
  if (b.time_sec >= 35.34 && b.time_sec < 39.20) {
    strength *= 0.68;
  } else if (b.time_sec >= 45.36 && b.time_sec < 49.60) {
    strength *= 0.76;
  }
  if (b.id === "RC_BEAT_0018" || b.id === "RC_BEAT_0072" || b.id === "RC_BEAT_0095") {
    strength = Math.max(strength, 0.94);
  }

  const entry: StageBeatKey = {
    id: b.id,
    frame: targetFrame,
    beatFrame,
    strength: Number(Math.max(0.32, Math.min(1, strength)).toFixed(3)),
  };
  if (matchedOnset && matchedTrack) {
    entry.onsetId = matchedOnset.id;
    entry.onsetTrack = matchedTrack;
  }
  return entry;
});

// Select sparse accent pulses for the lower plate's internal slot from trk_rc_accent_v1 & trk_rc_break_v1.
const pulseSelection: { sourceId: string; sourceTrack: "accent" | "break" | "high"; strength: number; label: string }[] = [
  { sourceId: "RC_ACCENT_0001", sourceTrack: "accent", strength: 0.74, label: "前奏合成器首段切分" },
  { sourceId: "RC_CHANGE_0002", sourceTrack: "break", strength: 0.76, label: "前奏中段突变" },
  { sourceId: "RC_ACCENT_0002", sourceTrack: "accent", strength: 1.00, label: "人工参考 · bass 进入" },
  { sourceId: "RC_ACCENT_0003", sourceTrack: "accent", strength: 0.88, label: "L001 招呼段重点" },
  { sourceId: "RC_CHANGE_0006", sourceTrack: "break", strength: 0.80, label: "L002 提问后留白突变" },
  { sourceId: "RC_ACCENT_0004", sourceTrack: "accent", strength: 0.95, label: "L003 能量上升重点" },
  { sourceId: "RC_ACCENT_0005", sourceTrack: "accent", strength: 0.92, label: "L004 自己アピール展示峰值" },
  { sourceId: "RC_CHANGE_0010", sourceTrack: "break", strength: 0.84, label: "L064 缩入后台待命槽" },
  { sourceId: "RC_CHANGE_0012", sourceTrack: "break", strength: 0.96, label: "L006 365日双拍点头重音" },
  { sourceId: "RC_CHANGE_0013", sourceTrack: "break", strength: 0.85, label: "L008 听众共鸣点头" },
  { sourceId: "RC_ACCENT_0006", sourceTrack: "accent", strength: 0.88, label: "L009 预训练矩阵涌现" },
  { sourceId: "RC_CHANGE_0015", sourceTrack: "break", strength: 0.86, label: "L011 铜管吹奏切入前导" },
  { sourceId: "RC_HIGH_0189", sourceTrack: "high", strength: 1.00, label: "L065 (ほら！) 贴地回弹峰值" },
];

const stagePulses: StagePulseKey[] = pulseSelection.map((spec, idx) => {
  const pool = analysis.tracks[spec.sourceTrack] as Candidate[];
  const ev = pool.find(e => e.id === spec.sourceId);
  assert(ev, `Missing pulse candidate ${spec.sourceId} in track ${spec.sourceTrack}`);
  return {
    id: `STAGE_PULSE_${String(idx + 1).padStart(2, "0")}`,
    frame: Math.round(ev.time_sec * fps),
    sourceId: spec.sourceId,
    sourceTrack: spec.sourceTrack,
    strength: spec.strength,
    label: spec.label,
  };
});

const data = {
  fps,
  status: "candidate",
  audioSha256: analysis.audio.sha256,
  beatFrames: [...new Set(rawBeats.map(e => Math.round(e.time_sec * fps)))],
  stageBeats,
  stagePulses,
  plans,
};
fs.mkdirSync(path.join(root, "apps/mv/src/timeline"), { recursive: true });
fs.writeFileSync(path.join(root, "apps/mv/src/timeline/verse1-rhythm.ts"),
  "// Authored candidate timing snapshot. Regenerate only after reviewing the diff.\n" +
  "export const VERSE1_RHYTHM = " + JSON.stringify(data, null, 2) + " as const;\n");
const rows = plans.flatMap(p => p.keys.filter(k => k.sourceId).map(k =>
  `| ${p.id} | ${k.label} | ${k.sourceFrame} | ${k.frame} | ${k.frame - k.sourceFrame > 0 ? "+" : ""}${k.frame - k.sourceFrame} | ${k.sourceId} |`));
const pulseRows = stagePulses.map(p =>
  `| ${p.id} | ${p.frame} (${(p.frame / fps).toFixed(2)}s) | ${p.sourceId} | ${p.sourceTrack} | ${p.strength.toFixed(2)} | ${p.label} |`);
fs.writeFileSync(path.join(root, "docs/verse1-rhythm.md"),
  "# Verse 1 动作与舞台底座节奏对照\n\n当前试作 30 FPS；下表为整数执行帧。机器节奏仍待试听，不等于已确认重拍。\n\n" +
  `音源 SHA-256：\`${analysis.audio.sha256}\`。候选源：\`local/analysis/rhythm-v1/analysis.json\`。\n\n` +
  "## 1. Clawd 本体待机与动作关键姿态对拍\n\n" +
  "待机左右重心按连续拍点相位交替，9.512 秒附近逐渐增强；各句不重置相位。主要姿态按就近拍点/低高频起音调整时间，保持动作相序和句子起止。一般最多移动6帧，短促回弹最多3帧；无附近合适候选则保留原时点。以下仅列已关联候选的姿态；准备、保持和回正等阶段边界仍固定。\n\n" +
  "保护区间 `[35.34s,40.8s)` 的舞台位置、缩放、跳出、踮脚跳和365日双点头保持原样；不加入新摆动、呼吸或重定时。根据用户试看反馈，已撤回365日点头的时间扭曲与新增呼吸，避免改变原有干脆的双点节奏。\n\n" +
  "| 动作 | 关键姿态 | 原帧 | 目标帧 | 移动帧数 | 候选来源 |\n|---|---|---:|---:|---:|---|\n" + rows.join("\n") + "\n\n" +
  "## 2. 舞台下方两层悬浮薄底板与内部短槽重点脉冲\n\n" +
  "- **基础收紧—释放（`stageBeats`，共 99 拍）**：以 `trk_rc_beat_v1`（`RC_BEAT_0001`–`RC_BEAT_0099`）组织拍点，在 `±1` 帧内贴合就近频段起音（`RC_LOW` / `RC_MID` / `RC_HIGH`）。拍点到达时上层薄底板先向固定舞台上沿轻微收紧（2 帧收紧、7 帧回落归零），下层薄底板滞后 2 帧跟随收紧并回落；两拍之间保持明确落位静止，舞台上沿 0 位移。\n" +
  "- **前奏与密集段落主次控制**：`0.000–9.512s` 无 bass 合成器段收紧幅度控制在 `0.36–0.58`，`9.512s`（`RC_ACCENT_0002` / `RC_BEAT_0018`）进入后按低频与打击包络放大至 `0.58–1.00`；角色与道具密集表演段适度压低幅度。\n" +
  "- **最下层底板内部短槽重点脉冲（`stagePulses`，共 13 处稀疏触发）**：筛选自 `trk_rc_accent_v1` 与 `trk_rc_break_v1`（含 `L065` 回弹峰值 `RC_HIGH_0189`），触发时短亮块从底板中央向左右两端传递 16 帧并消退。\n\n" +
  "| 脉冲 ID | 触发帧 (秒) | 候选来源 | 候选轨 | 强度 | 对应节点说明 |\n|---|---:|---|---|---:|---|\n" + pulseRows.join("\n") + "\n");
console.log(`Generated ${plans.length} action plans, ${stageBeats.length} stage beats, and ${stagePulses.length} stage pulses.`);
