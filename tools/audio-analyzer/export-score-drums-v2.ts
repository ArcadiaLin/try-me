import fs from "node:fs";
import path from "node:path";

interface TimelineItem {
  id: string;
  startSec: number;
  endSec?: number;
  text: string;
}

interface TimelineNode {
  kind: "group" | "timeline";
  id: string;
  name: string;
  items?: TimelineItem[];
  children?: TimelineNode[];
}

export type ScoreDrumKind =
  | "kick"
  | "snare"
  | "clap"
  | "clap-1"
  | "clap-2"
  | "hat"
  | "cymbal";

export interface ScoreDrumEvent {
  id: string;
  sec: number;
  kind: ScoreDrumKind;
}

const root = process.cwd();
const proj = JSON.parse(
  fs.readFileSync(path.join(root, "annotations/try-me.timeline.json"), "utf8"),
) as { nodes: TimelineNode[] };

const trackMap = new Map<string, TimelineItem[]>();
function walk(nodes: TimelineNode[]) {
  for (const n of nodes) {
    if (n.kind === "timeline" && n.items) {
      trackMap.set(n.id, n.items);
    } else if (n.children) {
      walk(n.children);
    }
  }
}
walk(proj.nodes);

const kicks = trackMap.get("trk_score_kick_v2") ?? [];
const snares = trackMap.get("trk_score_snare_v2") ?? [];
const claps = trackMap.get("trk_score_clap_v2") ?? [];
const hats = trackMap.get("trk_score_hat_v2") ?? [];
const timbre = trackMap.get("trk_timbre_candidates_v1") ?? [];

const events: ScoreDrumEvent[] = [];

for (const k of kicks) {
  events.push({ id: k.id, sec: Number(k.startSec.toFixed(3)), kind: "kick" });
}

for (const s of snares) {
  events.push({ id: s.id, sec: Number(s.startSec.toFixed(3)), kind: "snare" });
}

// 区分单声鼓掌与双声快拍连击 (间隔 < 0.36s 的前后两声分别记为 clap-1 / clap-2)
const sortedClaps = [...claps].sort((a, b) => a.startSec - b.startSec);
const clapKinds: ("clap" | "clap-1" | "clap-2")[] = sortedClaps.map(
  () => "clap",
);
for (let i = 1; i < sortedClaps.length; i++) {
  if (sortedClaps[i].startSec - sortedClaps[i - 1].startSec < 0.36) {
    clapKinds[i - 1] = "clap-1";
    clapKinds[i] = "clap-2";
  }
}
for (let i = 0; i < sortedClaps.length; i++) {
  const c = sortedClaps[i];
  events.push({
    id: c.id,
    sec: Number(c.startSec.toFixed(3)),
    kind: clapKinds[i],
  });
}

for (const h of hats) {
  events.push({ id: h.id, sec: Number(h.startSec.toFixed(3)), kind: "hat" });
}

// 人工确认的两声特殊长镲片（TC_029 53.78s, TC_019 63.608s）
for (const t of timbre) {
  if (t.id === "TC_029" || t.id === "TC_019") {
    events.push({
      id: t.id,
      sec: Number(t.startSec.toFixed(3)),
      kind: "cymbal",
    });
  }
}

events.sort((a, b) => a.sec - b.sec || a.id.localeCompare(b.id));

const outPath = path.join(root, "apps/mv/src/timeline/score-drums-v2.ts");
const lines = events.map(
  (e) =>
    `  { id: ${JSON.stringify(e.id)}, sec: ${e.sec}, kind: ${JSON.stringify(e.kind)} },`,
);

const content = `// Auto-generated from annotations/try-me.timeline.json (grp_score_drums_v2: 全曲鼓组 · 鼓谱修订 v2)
// Total events: ${events.length} (kick: ${kicks.length}, snare: ${snares.length}, clap: ${claps.length}, hat: ${hats.length}, crash cymbal: 2)

export type ScoreDrumKind =
  | "kick"
  | "snare"
  | "clap"
  | "clap-1"
  | "clap-2"
  | "hat"
  | "cymbal";

export interface ScoreDrumEvent {
  readonly id: string;
  readonly sec: number;
  readonly kind: ScoreDrumKind;
}

/** 全曲原音源总时长（秒） */
export const FULL_SONG_DURATION_SEC = 209.72;

export const SCORE_DRUMS_V2_EVENTS: readonly ScoreDrumEvent[] = [
${lines.join("\n")}
] as const;
`;

fs.writeFileSync(outPath, content, "utf8");
console.log(
  `Generated ${events.length} full-song percussion events into apps/mv/src/timeline/score-drums-v2.ts`,
);
