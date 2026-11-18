import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import {
  cueStartFrame,
  sampleLyricTerminal,
  TERMINAL_SCROLL_FRAMES,
  TERMINAL_VISIBLE_ROWS,
  VERSE1_LYRIC_CUES,
} from "../../apps/mv/src/timeline/verse1-lyrics.ts";

const FPS = 30;

test("lyric cues match the annotated trk_lyrics boundaries and text", () => {
  const project = JSON.parse(
    fs.readFileSync("annotations/try-me.timeline.json", "utf8"),
  );
  const track = project.nodes[0].children.find(
    (n: { id: string }) => n.id === "trk_lyrics",
  );
  for (const cue of VERSE1_LYRIC_CUES) {
    if (cue.mode === "input") continue;
    const item = track.items.find((i: { id: string }) => i.id === cue.id);
    assert(item, `${cue.id} missing from timeline`);
    assert.equal(cue.startSec, item.startSec, `${cue.id} startSec`);
    assert.equal(cue.endSec, item.endSec, `${cue.id} endSec`);
    const annotated = String(item.text).replace(/[()（）\s]/g, "");
    assert.equal(cue.text.replace(/\s/g, ""), annotated, `${cue.id} text`);
  }
});

test("each line appears whole on its integer start frame and scrolls in within the ease window", () => {
  for (const cue of VERSE1_LYRIC_CUES) {
    const f = cueStartFrame(cue, FPS);
    assert(Number.isInteger(f));
    const before = sampleLyricTerminal(f - 1, FPS);
    assert(!before.lines.some((l) => l.cue.id === cue.id));
    const at = sampleLyricTerminal(f, FPS);
    const line = at.lines.find((l) => l.cue.id === cue.id)!;
    assert.equal(line.isNewest, true);
    assert.equal(line.cue.text, cue.text);
    const settled = sampleLyricTerminal(f + TERMINAL_SCROLL_FRAMES, FPS);
    const s = settled.lines.find((l) => l.cue.id === cue.id)!;
    assert(Math.abs(s.row - (TERMINAL_VISIBLE_ROWS - 1)) < 1e-9);
    assert.equal(s.depthOpacity, 1);
  }
});

test("history keeps order, fades upward and never exceeds the visible rows", () => {
  const end = cueStartFrame(VERSE1_LYRIC_CUES.at(-1)!, FPS) + 30;
  for (let f = 0; f <= end; f++) {
    const { lines } = sampleLyricTerminal(f, FPS);
    assert(lines.filter((l) => l.depthOpacity > 0).length <= TERMINAL_VISIBLE_ROWS + 1);
    for (let i = 1; i < lines.length; i++) {
      assert(lines[i].row > lines[i - 1].row);
      assert(lines[i].depthOpacity >= lines[i - 1].depthOpacity);
    }
  }
});

test("terminal is empty with an idle prompt during the intro, then standby and typing around L005", () => {
  const intro = sampleLyricTerminal(Math.round(10 * FPS), FPS);
  assert.equal(intro.lines.length, 0);
  assert.equal(intro.input.standby, false);
  assert.equal(sampleLyricTerminal(Math.round(36 * FPS), FPS).input.standby, true);
  const typing = sampleLyricTerminal(Math.round(37.2 * FPS), FPS).input;
  assert.equal(typing.typing, true);
  assert(typing.text.length > 0 && "claude".startsWith(typing.text));
  const after = sampleLyricTerminal(cueStartFrame(VERSE1_LYRIC_CUES[5], FPS), FPS);
  assert.equal(after.input.text, "");
  assert.equal(after.lines.at(-1)!.cue.id, "SYS_L005_CLAUDE");
});
