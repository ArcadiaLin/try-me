import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { persistProjectArtifacts } from "../../apps/annotator/server/index.ts";
import { validateAndNormalizeProject } from "../../apps/annotator/web/model.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const folder = path.join(root, "local/analysis/rhythm-v1");
const timeline = path.join(root, "annotations/try-me.timeline.json");
const digest = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");
const analysis = JSON.parse(fs.readFileSync(path.join(folder, "analysis.json"), "utf8"));
const group = JSON.parse(fs.readFileSync(path.join(folder, "candidate-group.json"), "utf8"));
const originalBytes = fs.readFileSync(timeline);
const original = JSON.parse(originalBytes.toString("utf8"));
assert.equal(digest(originalBytes), analysis.annotation_snapshot_sha256, "Annotations changed since analysis; review latest edits before importing");
assert.equal(digest(fs.readFileSync(path.join(root, analysis.audio.path))), analysis.audio.sha256, "Audio hash mismatch");
assert.equal(analysis.status, "candidate");
assert.equal(group.id, "grp_rhythm_candidates_v1");
assert(!original.nodes.some((n: { id: string }) => n.id === group.id), "Candidate group already exists; never overwrite reviewed events");
const updated = { ...original, nodes: [...original.nodes, group] };
validateAndNormalizeProject(updated, analysis.audio.duration_sec); // validate without normalizing the human objects

// Exercise the real persistence code in an isolated fixture first.
const snapshot = path.join(root, "out", `rhythm-import-${Date.now()}`);
const fixture = path.join(snapshot, "fixture");
persistProjectArtifacts(updated, fixture);
const persistedFixture = JSON.parse(fs.readFileSync(path.join(fixture, "annotations/try-me.timeline.json"), "utf8"));
assert.deepEqual(persistedFixture.nodes.slice(0, -1), original.nodes);
assert.deepEqual({ ...persistedFixture, nodes: original.nodes }, original);
assert.equal(fs.readFileSync(path.join(fixture, "annotations/try-me.timeline.json"), "utf8"), fs.readFileSync(path.join(fixture, "local/annotations/annotations.json"), "utf8"));
console.log(`Validated ${group.children.length} candidate tracks; original nodes preserved; isolated save verified.`);
if (process.argv.includes("--apply")) {
  const artifacts = ["annotations/try-me.timeline.json", "annotations/agent-brief.md", "local/annotations/annotations.json", "local/annotations/agent-brief.md", "local/annotations/lyrics/try-me.ass", "local/annotations/lyrics/try-me.lrc", "public/private/annotations-preview.json"];
  for (const rel of artifacts) {
    const source = path.join(root, rel);
    if (fs.existsSync(source)) {
      const dest = path.join(snapshot, "before", rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(source, dest);
    }
  }
  assert.equal(digest(fs.readFileSync(timeline)), digest(originalBytes), "Concurrent annotation edit; import aborted");
  persistProjectArtifacts(updated, root);
  assert.deepEqual(JSON.parse(fs.readFileSync(timeline, "utf8")), persistedFixture);
  assert.equal(fs.readFileSync(timeline, "utf8"), fs.readFileSync(path.join(root, "local/annotations/annotations.json"), "utf8"));
  console.log(`Appended candidate group; synchronized artifacts; snapshot: ${snapshot}`);
}
