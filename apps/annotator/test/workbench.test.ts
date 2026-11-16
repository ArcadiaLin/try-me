import test from "node:test";
import assert from "node:assert/strict";
import { useWorkbenchStore as store } from "../web/src/store/workbenchStore.ts";
import { connectAudioTransport } from "../web/src/utils/audio-transport.ts";
import type { TimelineProject } from "../web/src/types.ts";

const a = { trackId: "track", eventId: "A" };
const b = { trackId: "track", eventId: "B" };
function setup() {
  const project: TimelineProject = { version: 1, name: "isolated", nodes: [
    { kind: "timeline", id: "track", name: "Track", items: [
      { id: "A", startSec: 1, endSec: 3, text: "first" },
      { id: "B", startSec: 4, endSec: 6, text: "second" },
      { id: "C", startSec: 7, text: "point" },
    ] },
    { kind: "timeline", id: "other", name: "Other", items: [
      { id: "D", startSec: 8, endSec: 9, text: "other" },
    ] },
  ] };
  store.getState().hydrate({ project });
  store.getState().setIsPlaying(false);
  store.getState().setCurrentTimeSec(1);
  const audio = { currentTime: 1, paused: true, playCalls: 0,
    play() { this.paused = false; this.playCalls++; return Promise.resolve(); },
    pause() { this.paused = true; } };
  const controller = connectAudioTransport(audio, store);
  return { audio, controller, state: store.getState };
}

test("loop reads edited boundaries, preserves position inside and follows undo/redo", () => {
  const { audio, controller, state } = setup();
  try {
    state().loopCurrentEvent();
    audio.currentTime = 2;
    state().runWorkbenchCommand({ type: "setBoundary", ref: a, edge: "end", timeSec: 3.5 });
    assert.equal(audio.currentTime, 2);
    assert.deepEqual(state().transport.loopRange, [1, 3.5]);
    audio.currentTime = 3.1; controller.tick();
    assert.equal(audio.currentTime, 3.1);
    audio.currentTime = 3.51; controller.tick();
    assert.equal(audio.currentTime, 1);
    state().undo(); assert.deepEqual(state().transport.loopRange, [1, 3]);
    state().redo(); assert.deepEqual(state().transport.loopRange, [1, 3.5]);
  } finally { controller.dispose(); }
});

test("shrinking past the playhead restarts once; paused edits never start playback", () => {
  const { audio, controller, state } = setup();
  try {
    state().loopCurrentEvent(); audio.currentTime = 2.8;
    state().runWorkbenchCommand({ type: "setBoundary", ref: a, edge: "end", timeSec: 2.5 });
    assert.equal(audio.currentTime, 1);
    state().setIsPlaying(false);
    const calls = audio.playCalls;
    state().runWorkbenchCommand({ type: "setBoundary", ref: a, edge: "start", timeSec: 1.5 });
    assert.equal(audio.paused, true); assert.equal(audio.playCalls, calls);
    assert.deepEqual(state().transport.loopRange, [1.5, 2.5]);
  } finally { controller.dispose(); }
});

test("next and double-click requests preserve editing, playback and loop until confirmed", () => {
  const { audio, controller, state } = setup();
  try {
    state().loopCurrentEvent(); audio.currentTime = 2;
    state().selectNextEvent();
    assert.deepEqual(state().view.selection.primary, a);
    assert.deepEqual(state().transport.loopRange, [1, 3]);
    assert.equal(audio.currentTime, 2);
    state().cancelEventSwitch(); assert.equal(state().pendingEventSwitch, null);
    assert.equal(state().selectEvent(b, false, true), false);
    state().confirmEventSwitch();
    assert.deepEqual(state().view.selection.primary, b);
    assert.deepEqual(state().transport.loopRange, [4, 6]);
    assert.equal(audio.currentTime, 4); assert.equal(audio.paused, false);
    assert.equal(state().persistence.dirty, false);
  } finally { controller.dispose(); }
});

test("plain confirmation while paused stays paused and cross-track navigation is guarded", () => {
  const { audio, controller, state } = setup();
  try {
    state().selectNode("other");
    assert.deepEqual(state().view.selection.primary, a);
    state().confirmEventSwitch();
    assert.equal(state().view.selection.primary?.eventId, "D");
    assert.equal(audio.currentTime, 8); assert.equal(audio.paused, true);
  } finally { controller.dispose(); }
});

test("latest target wins; shift selection is applied only after confirmation", () => {
  const { controller, state } = setup();
  try {
    state().selectEvent(b);
    state().selectEvent({ trackId: "track", eventId: "C" }, true);
    assert.deepEqual(state().view.selection.selected, [a]);
    state().confirmEventSwitch();
    assert.equal(state().view.selection.primary?.eventId, "C");
    assert.equal(state().view.selection.selected.length, 3);
  } finally { controller.dispose(); }
});

test("deleted pending targets are cleared and point conversion disables stale loops", () => {
  const { controller, state } = setup();
  try {
    state().loopCurrentEvent(); state().selectEvent(b);
    state().runWorkbenchCommand({ type: "delete", refs: [b] });
    assert.equal(state().pendingEventSwitch, null);
    state().runWorkbenchCommand({ type: "update", ref: a, patch: { endSec: null } });
    assert.equal(state().transport.loopEnabled, false);
    assert.equal(state().transport.loopRange, null);
  } finally { controller.dispose(); }
});

test("short audition ignores loop bounds and old audition stops cannot truncate an edited loop", () => {
  const { audio, controller, state } = setup();
  try {
    state().loopCurrentEvent(); controller.setAuditionEnd(3.5);
    audio.currentTime = 3.2; controller.tick();
    assert.equal(audio.currentTime, 3.2);
    audio.currentTime = 3.6; controller.tick();
    assert.equal(audio.paused, true); assert.equal(audio.currentTime, 3.5);
    state().loopCurrentEvent(); controller.setAuditionEnd(3);
    state().runWorkbenchCommand({ type: "setBoundary", ref: a, edge: "end", timeSec: 3.8 });
    audio.currentTime = 3.2; controller.tick();
    assert.equal(audio.paused, false); assert.equal(audio.currentTime, 3.2);
  } finally { controller.dispose(); }
});
