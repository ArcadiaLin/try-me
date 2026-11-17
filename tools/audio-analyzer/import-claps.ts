import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { persistProjectArtifacts } from "../../apps/annotator/server/index.ts";
import { validateAndNormalizeProject } from "../../apps/annotator/web/model.ts";
import type { TimelineNode, TimelineProject, TimelineTrack } from "../../apps/annotator/web/src/types.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const analysisFolder = path.join(root, "local/analysis/claps-v1");
const timeline = path.join(root, "annotations/try-me.timeline.json");
const digest = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");
const analysis = JSON.parse(fs.readFileSync(path.join(analysisFolder, "analysis.json"), "utf8"));
const track: TimelineTrack = JSON.parse(fs.readFileSync(path.join(analysisFolder, "candidate-track.json"), "utf8"));
const bytes = fs.readFileSync(timeline);
const original: TimelineProject = JSON.parse(bytes.toString("utf8"));
assert.equal(digest(bytes), analysis.annotation_sha256, "Annotations changed since analysis; review before importing");
assert.equal(digest(fs.readFileSync(path.join(root, analysis.audio))), analysis.audio_sha256, "Audio changed");
assert.equal(analysis.status, "candidate");
assert.equal(track.id, "trk_claps_v1");
assert.equal(track.items.length, analysis.counts.points);
assert(track.items.every(e => e.endSec === undefined), "Claps must be points");
assert.equal(new Set(track.items.map(e => e.startSec)).size, track.items.length, "Duplicate clap point");

function flatten(nodes: TimelineNode[]): TimelineNode[] {
  return nodes.flatMap(n => [n, ...(n.kind === "group" ? flatten(n.children) : [])]);
}
const all = flatten(original.nodes);
const existingIds = new Set(all.flatMap(n => [n.id, ...(n.kind === "timeline" ? n.items.map(e => e.id) : [])]));
assert(!existingIds.has(track.id), "Clap track already exists; do not overwrite reviewed points");
for (const event of track.items) assert(!existingIds.has(event.id), `Duplicate ID ${event.id}`);
const source = all.find(n => n.kind === "timeline" && n.items.some(e => e.id === analysis.references[0].id));
assert(source);
const updated = structuredClone(original);
function insert(nodes: TimelineNode[]) {
  const index = nodes.findIndex(n => n.id === source!.id);
  if (index >= 0) {
    nodes.splice(index + 1, 0, track);
    return true;
  }
  return nodes.some(n => n.kind === "group" && insert(n.children));
}
assert(insert(updated.nodes));
validateAndNormalizeProject(updated, analysis.duration_sec);
function strip(nodes: TimelineNode[]): TimelineNode[] {
  return nodes.filter(n => n.id !== track.id).map(n => n.kind === "group" ? { ...n, children: strip(n.children) } : n);
}
assert.deepEqual({ ...updated, nodes: strip(updated.nodes) }, original);

const snapshot = path.join(root, "out", `clap-import-${Date.now()}`);
const fixture = path.join(snapshot, "fixture");
persistProjectArtifacts(updated, fixture);
const artifacts = ["annotations/try-me.timeline.json", "annotations/agent-brief.md", "local/annotations/annotations.json", "local/annotations/agent-brief.md", "local/annotations/lyrics/try-me.ass", "local/annotations/lyrics/try-me.lrc", "public/private/annotations-preview.json"];
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixture, artifacts[0]), "utf8")), updated);
console.log(`Validated ${track.items.length} clap points; all prior annotations preserved. Isolated save: ${snapshot}`);
if (process.argv.includes("--apply")) {
  for (const rel of artifacts) {
    const sourcePath = path.join(root, rel);
    if (!fs.existsSync(sourcePath)) continue;
    const dest = path.join(snapshot, "before", rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(sourcePath, dest);
  }
  assert.equal(digest(fs.readFileSync(timeline)), digest(bytes), "Concurrent edit; import aborted");
  persistProjectArtifacts(updated, root);
  for (const rel of artifacts) {
    const actual = fs.readFileSync(path.join(root, rel), "utf8");
    const expected = fs.readFileSync(path.join(fixture, rel), "utf8");
    if (rel.endsWith("annotations-preview.json")) {
      const a = JSON.parse(actual), b = JSON.parse(expected);
      delete a.updated_at;
      delete b.updated_at;
      assert.deepEqual(a, b);
    } else {
      assert.equal(actual, expected, rel);
    }
  }
  console.log("Imported clap point track; seven artifacts synchronized (preview timestamp excluded).");
}
