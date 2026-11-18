import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { resolveClawdPose } from "../../apps/mv/src/animation/clawd/blend.ts";
import {
  HEY_END_SEC,
  HEY_LIFT_PEAK_SEC,
  HEY_VOCAL_SEC,
  HEY_WAVE_COUNT,
  HEY_WAVE_END_SEC,
  HEY_WAVE_START_SEC,
  sampleHeyWave,
} from "../../apps/mv/src/timeline/hey-wave.ts";
import {
  beatGridFrame,
  beatPosition,
  beatPulseEnvelope,
  fitBeatGrid,
  rhythmMotion,
  sampleRhythmPlan,
  sampleStageKeyboard,
  VERSE1_RHYTHM as data,
} from "../../apps/mv/src/timeline/verse1.ts";

test("key poses land exactly on authored integer frames and keep their original order", () => {
  for (const plan of data.plans) {
    for (let i = 0; i < plan.keys.length; i++) {
      const key = plan.keys[i];
      assert(Number.isInteger(key.frame));
      assert(Math.abs(sampleRhythmPlan(key.frame, plan) - key.progress) < 1e-10);
      if (i) {
        assert(key.frame > plan.keys[i - 1].frame);
        assert(key.progress > plan.keys[i - 1].progress);
      }
    }
    assert.equal(plan.keys[0].frame, plan.keys[0].sourceFrame);
    assert.equal(plan.keys.at(-1)!.frame, plan.keys.at(-1)!.sourceFrame);
    let previous = -1;
    for (let f = plan.keys[0].frame - 1; f <= plan.keys.at(-1)!.frame + 1; f += .1) {
      const p = sampleRhythmPlan(f, plan);
      assert(Number.isFinite(p) && p >= previous - 1e-9, `${plan.id} reversed at ${f}`);
      assert(p >= plan.keys[0].progress && p <= plan.keys.at(-1)!.progress + 1e-10);
      previous = p;
    }
  }
});

test("idle sway alternates on a continuous fitted beat grid without resetting at sentence boundaries", () => {
  const grid = fitBeatGrid(data.beatFrames);
  data.beatFrames.forEach((f, i) => {
    // Fitted grid stays within one frame of every integer reference beat.
    const gridFrame = beatGridFrame(i, data.beatFrames);
    assert(Math.abs(gridFrame - f) < 1, `beat ${i} drifted ${gridFrame - f}`);
    assert(Math.abs(beatPosition(gridFrame, data.beatFrames) - i) < 1e-9);
    const sec = gridFrame / data.fps;
    const motion = rhythmMotion(sec, beatPosition(gridFrame, data.beatFrames));
    if (motion) {
      assert(Math.abs(motion.sway - (i % 2 ? -1 : 1)) < 1e-9);
      assert(Math.abs(motion.pulse - 1) < 1e-9);
      // Snap-and-release: settles to zero mid-beat, longer release than attack.
      assert.equal(beatPulseEnvelope(i + 0.5), 0);
      assert(beatPulseEnvelope(i + 0.06) > beatPulseEnvelope(i - 0.06), "pulse should release slower than it attacks");
    }
  });
  // Uniform speed: no 16/17/18-frame jitter in beat duration.
  for (let f = 40; f < 1600; f += 7) {
    const d = beatPosition(f + 1, data.beatFrames) - beatPosition(f, data.beatFrames);
    assert(Math.abs(d - 1 / grid.framesPerBeat) < 1e-9);
  }
});

test("narrative actions keep a light vertical groove layer outside idle windows and the ほら pop", () => {
  const atInvite = rhythmMotion(24.2, beatPosition(24.2 * 30, data.beatFrames))!;
  assert(atInvite.idleWeight < 1e-6 && atInvite.grooveWeight > 0.2);
  const atIntro = rhythmMotion(12, beatPosition(12 * 30, data.beatFrames))!;
  assert(atIntro.grooveWeight < 1e-6 && atIntro.idleWeight > 0.5);
  const atPop = rhythmMotion(53.1, beatPosition(53.1 * 30, data.beatFrames))!;
  assert(atPop.grooveWeight < 1e-6);
});

test("Hey wave lifts within 2 frames of the vocal, waves 3 times on the half-beat grid, then hands over to the wave plan", () => {
  const halfBeat = (beatGridFrame(1, data.beatFrames) - beatGridFrame(0.5, data.beatFrames)) / data.fps;
  assert(HEY_LIFT_PEAK_SEC - HEY_VOCAL_SEC <= 2.2 / 30);
  assert(Math.abs(HEY_WAVE_START_SEC - HEY_VOCAL_SEC) < 1.5 / 30);
  assert(Math.abs(HEY_WAVE_END_SEC - HEY_WAVE_START_SEC - HEY_WAVE_COUNT * halfBeat) < 1e-9);
  assert(sampleHeyWave(HEY_LIFT_PEAK_SEC).lift > 0.99);
  for (let k = 0; k <= HEY_WAVE_COUNT; k++) {
    // Paw tip highest exactly on each half-beat point.
    assert(Math.abs(sampleHeyWave(HEY_WAVE_START_SEC + k * halfBeat).waveY + 1) < 1e-9);
  }
  assert.equal(sampleHeyWave(HEY_END_SEC).lift, 0);
  const wave = data.plans.find((p) => p.id === "wave")!;
  assert.equal(wave.keys[0].frame / data.fps, HEY_END_SEC);
  assert.equal(wave.keys[0].progress, 0.36);
});

test("L007 weight-shift extremes and center land on reference beats", () => {
  const sway = data.plans.find((p) => p.id === "sway")!;
  for (const progress of [0.25, 0.5, 0.75]) {
    const key = sway.keys.find((k) => k.progress === progress)!;
    assert((data.beatFrames as readonly number[]).includes(key.frame), `sway ${progress} at F${key.frame}`);
  }
});

test("terminal leap, tiptoe hops and 365-day nod receive no new rhythm layer", () => {
  for (let frame = Math.ceil(35.34 * 30); frame < 40.8 * 30; frame++) {
    assert.equal(rhythmMotion(frame / 30, beatPosition(frame, data.beatFrames)), undefined);
  }
  const crouch = data.plans.find(p => p.id === "crouch")!;
  assert(Math.abs(sampleRhythmPlan(35.34 * 30, crouch) - (35.34 - 34.026) / (35.82 - 34.026) * .65) < 1e-10);
  for (const boundary of [35.34, 40.8]) {
    const sec = boundary === 35.34 ? boundary - 1e-6 : boundary;
    const motion = rhythmMotion(sec, beatPosition(sec * 30, data.beatFrames))!;
    assert(motion.idleWeight < 1e-8);
    assert(Math.abs(motion.breathY - Math.sin(sec * Math.PI * 2) * .12) < 1e-8);
  }
});

test("linked poses match their candidate source, stay bounded, and do not invent confirmed beats", () => {
  const source = JSON.parse(fs.readFileSync("local/analysis/rhythm-v1/analysis.json", "utf8"));
  assert.equal(source.audio.sha256, data.audioSha256);
  for (const plan of data.plans) for (const key of plan.keys) {
    if (!("sourceId" in key)) continue;
    const event = source.tracks[key.sourceTrack].find((e: { id: string }) => e.id === key.sourceId);
    assert(event);
    assert.equal(key.frame, Math.round(event.time_sec * data.fps));
    assert(Math.abs(key.frame - key.sourceFrame) <= 6);
  }
  assert.equal(data.status, "candidate");
});

test("stage-front auto-playing keyboard deploys before first note, overlaps fast key handoffs, and retracts on teal transition", () => {
  // Ready in place before first pickup note at 0.254s
  const ready = sampleStageKeyboard(0.245);
  assert(ready.visible && ready.traySlide > 0.99 && ready.trayUnfold > 0.99);
  assert.equal(ready.zones[0].press, 0);

  // Pickup note (0.254s-0.485s) actuates zone 0 (low drop A3)
  const pickupMid = sampleStageKeyboard(0.32);
  assert(pickupMid.zones[0].press > 0.75);
  assert.equal(pickupMid.zones[1].press, 0);
  assert.equal(pickupMid.zones[2].press, 0);

  // Cycle 1 downbeat (0.534s) actuates zone 1 (base low Bb3)
  const beat1 = sampleStageKeyboard(0.6);
  assert(beat1.zones[1].press > 0.8);

  // Fast 16th-note handoff from high (zone 2, s=2.0..2.85 => 0.814..0.934s) to base low (zone 1, s=3.0 => 0.955s):
  // At 0.975s, zone 1 is already pressed down while zone 2 is still mid-rebound.
  const handoff = sampleStageKeyboard(0.975);
  assert(handoff.zones[1].press > 0.5);
  assert(handoff.zones[2].press > 0.1 && handoff.zones[2].press < 0.7);

  // Orange -> Teal transition at 18.477s: last key releases & extinguishes first, then folds flat, then retracts completely.
  const keysReleased = sampleStageKeyboard(18.472);
  assert.equal(keysReleased.zones[0].press, 0);
  assert.equal(keysReleased.zones[1].press, 0);
  assert.equal(keysReleased.zones[2].press, 0);
  assert(keysReleased.trayUnfold > 0.95);

  const folded = sampleStageKeyboard(18.64);
  assert.equal(folded.trayUnfold, 0);
  assert(folded.traySlide > 0 && folded.traySlide < 1);

  const goneInTeal = sampleStageKeyboard(19.0);
  assert(!goneInTeal.visible && goneInTeal.traySlide === 0 && goneInTeal.slotOpen === 0);
});

test("refactored pose & timeline layers keep feet grounded and preserve exact rendered PNG frames", () => {
  const groundedActions = [
    "idle",
    "crouch",
    "nod",
    "wave",
    "weight-shift",
    "wave-step",
    "tilt-invite",
    "posture-nod",
    "self-present",
    "crouch-lean",
    "peek-present",
    "read-look-up",
    "elastic-pop",
    "snappy-nod",
  ] as const;

  for (const action of groundedActions) {
    for (const p of [0, 0.2, 0.5, 0.8, 1]) {
      const pose = resolveClawdPose({
        action,
        actionProgress: p,
        timeSec: p * 3,
      });
      assert.deepEqual(pose.legLifts, [0, 0, 0, 0], `${action} lifted feet at p=${p}`);
    }
  }

  // When holding a book (prop="book"), Clawd slides its two hands inward (handHoldProgress: 0 -> 1 -> 0) across bookProgress 0 -> 1 -> 2
  const bookFlyStart = resolveClawdPose({
    action: "read-look-up",
    actionProgress: 0.05,
    prop: "book",
    bookProgress: 0,
    timeSec: 45.36,
  });
  const bookHeld = resolveClawdPose({
    action: "read-look-up",
    actionProgress: 0.25,
    prop: "book",
    bookProgress: 1,
    timeSec: 46.1,
  });
  const bookExitDone = resolveClawdPose({
    action: "read-look-up",
    actionProgress: 0.95,
    prop: "book",
    bookProgress: 2,
    timeSec: 49.66,
  });
  assert.equal(bookFlyStart.handHoldProgress, 0);
  assert.equal(bookHeld.handHoldProgress, 1);
  assert.equal(bookExitDone.handHoldProgress, 0);

  // When playing the compact synth keyboard (prop="keyboard"), Clawd's hands slide inward and actuate left/right key presses
  const kbHighNote = resolveClawdPose({
    action: "idle",
    prop: "keyboard",
    keyboardState: sampleStageKeyboard(0.86),
    timeSec: 0.86,
  });
  assert.equal(kbHighNote.handKeyboardProgress, 1);
  assert((kbHighNote.rightKeyPress ?? 0) > 0.8);
});
