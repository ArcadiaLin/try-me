import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { resolveClawdPose } from "../../apps/mv/src/animation/clawd/blend.ts";
import {
  beatPosition,
  rhythmMotion,
  sampleRhythmPlan,
  sampleStageKeyboard,
  sampleStageRhythm,
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

test("idle sway alternates on every reference beat without resetting at sentence boundaries", () => {
  data.beatFrames.forEach((f, i) => {
    assert.equal(beatPosition(f, data.beatFrames), i);
    const sec = f / data.fps;
    const motion = rhythmMotion(sec, beatPosition(f, data.beatFrames));
    if (motion) {
      assert(Math.abs(motion.sway - (i % 2 ? -1 : 1)) < 1e-10);
      assert.equal(motion.pulse, 1);
    }
  });
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

test("stage base plates tighten on rhythm beat keyframes, lag lower plate by 2 frames, and settle to zero between beats", () => {
  const source = JSON.parse(fs.readFileSync("local/analysis/rhythm-v1/analysis.json", "utf8"));
  assert.equal(data.stageBeats.length, 99);
  for (let i = 0; i < data.stageBeats.length; i++) {
    const sb = data.stageBeats[i];
    const rawBeat = source.tracks.beat.find((b: { id: string }) => b.id === sb.id);
    assert(rawBeat);
    assert.equal(sb.beatFrame, Math.round(rawBeat.time_sec * data.fps));
    assert(Math.abs(sb.frame - sb.beatFrame) <= 1);
    if ("onsetId" in sb && sb.onsetId && "onsetTrack" in sb && sb.onsetTrack) {
      const onset = source.tracks[sb.onsetTrack].find((e: { id: string }) => e.id === sb.onsetId);
      assert(onset);
      assert(Math.abs(Math.round(onset.time_sec * data.fps) - sb.beatFrame) <= 2);
    }

    // Upper plate peaks right on sb.frame; lower plate peaks 2 frames later at sb.frame + 2.
    const atBeat = sampleStageRhythm(sb.frame, data.stageBeats, data.stagePulses);
    const beforeBeat = sampleStageRhythm(sb.frame - 1, data.stageBeats, data.stagePulses);
    const afterBeat = sampleStageRhythm(sb.frame + 1, data.stageBeats, data.stagePulses);
    assert(atBeat.upperLiftPx > beforeBeat.upperLiftPx && atBeat.upperLiftPx > afterBeat.upperLiftPx);
    assert(atBeat.upperLiftPx > atBeat.lowerLiftPx);

    const atLag = sampleStageRhythm(sb.frame + 2, data.stageBeats, data.stagePulses);
    const afterLag = sampleStageRhythm(sb.frame + 3, data.stageBeats, data.stagePulses);
    assert(atLag.lowerLiftPx > atBeat.lowerLiftPx && atLag.lowerLiftPx > afterLag.lowerLiftPx);

    // Between consecutive beats (e.g. sb.frame + 11), both plates rest completely at 0px lift.
    if (i < data.stageBeats.length - 1 && data.stageBeats[i + 1].frame - sb.frame >= 14) {
      const restState = sampleStageRhythm(sb.frame + 11, data.stageBeats, data.stagePulses);
      assert.equal(restState.upperLiftPx, 0);
      assert.equal(restState.lowerLiftPx, 0);
    }
  }
});

test("stage accent pulses match break/accent candidates, pause during orange keyboard intro, and remain sparse", () => {
  const source = JSON.parse(fs.readFileSync("local/analysis/rhythm-v1/analysis.json", "utf8"));
  assert.equal(data.stagePulses.length, 13);
  for (const p of data.stagePulses) {
    const ev = source.tracks[p.sourceTrack].find((e: { id: string }) => e.id === p.sourceId);
    assert(ev);
    assert.equal(p.frame, Math.round(ev.time_sec * data.fps));
    const startState = sampleStageRhythm(p.frame, data.stageBeats, data.stagePulses);
    if (p.frame / data.fps < 18.9) {
      // Pulses are paused while the stage-front keyboard is the primary bottom instrument.
      assert(!startState.pulse.active);
    } else {
      const midState = sampleStageRhythm(p.frame + 6, data.stageBeats, data.stagePulses);
      const afterState = sampleStageRhythm(p.frame + 17, data.stageBeats, data.stagePulses);
      assert(startState.pulse.active);
      assert.equal(startState.pulse.progress, 0);
      assert(midState.pulse.active && midState.pulse.progress > 0.5);
      assert(!afterState.pulse.active);
    }
  }
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
