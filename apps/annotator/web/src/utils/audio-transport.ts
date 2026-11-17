import type { WorkbenchStoreState } from "../store/workbenchStore.ts";

type AudioPort = Pick<HTMLAudioElement, "currentTime" | "paused" | "play" | "pause">;
type Store = {
  getState: () => WorkbenchStoreState;
  subscribe: (listener: () => void) => () => void;
};

// The audio element is the only clock. Both polling and timeupdate read live bounds.
export function connectAudioTransport(audio: AudioPort, store: Store) {
  let auditionEnd: number | null = null;
  let previous = store.getState();
  const key = (s: WorkbenchStoreState) => {
    const ref = s.view.selection.primary;
    return ref ? `${ref.trackId}/${ref.eventId}` : "";
  };
  const seek = (sec: number) => {
    audio.currentTime = sec;
    store.getState().setCurrentTimeSec(sec);
  };
  const unsubscribe = store.subscribe(() => {
    const state = store.getState();
    const before = previous;
    previous = state; // Set before seeking: store notifications are synchronous.
    const switched = key(state) !== key(before);
    const range = state.transport.loopRange;
    const changed = range?.[0] !== before.transport.loopRange?.[0] ||
      range?.[1] !== before.transport.loopRange?.[1] ||
      state.transport.loopEnabled !== before.transport.loopEnabled;
    if (switched || changed) auditionEnd = null;
    if (switched) seek(state.transport.currentTimeSec);
    else if (changed && state.transport.loopEnabled && range && !audio.paused &&
      (audio.currentTime < range[0] || audio.currentTime >= range[1])) seek(range[0]);
    if (state.transport.isPlaying !== before.transport.isPlaying) {
      if (state.transport.isPlaying && audio.paused) {
        void audio.play().catch(() => store.getState().setIsPlaying(false));
      } else if (!state.transport.isPlaying && !audio.paused) audio.pause();
    }
  });
  return {
    // Manual positioning changes only the playback clock, not selection or loop bounds.
    seekTo: (sec: number) => {
      if (!Number.isFinite(sec)) return;
      auditionEnd = null;
      store.getState().setCurrentTimeSec(sec);
      audio.currentTime = store.getState().transport.currentTimeSec;
    },
    setAuditionEnd: (end: number | null) => { auditionEnd = end; },
    tick: () => {
      if (audio.paused) return;
      const state = store.getState();
      if (auditionEnd !== null) {
        if (audio.currentTime >= auditionEnd) {
          const end = auditionEnd;
          auditionEnd = null;
          audio.pause();
          state.setIsPlaying(false);
          seek(end);
        } else state.setCurrentTimeSec(audio.currentTime);
        return; // A short audition is independent of the sentence loop.
      }
      const range = state.transport.loopRange;
      if (state.transport.loopEnabled && range && audio.currentTime >= range[1]) seek(range[0]);
      else state.setCurrentTimeSec(audio.currentTime);
    },
    ended: () => {
      const state = store.getState();
      const range = state.transport.loopRange;
      if (auditionEnd === null && state.transport.loopEnabled && range) {
        seek(range[0]);
        void audio.play().then(() => store.getState().setIsPlaying(true), () => store.getState().setIsPlaying(false));
      } else {
        auditionEnd = null;
        state.setIsPlaying(false);
      }
    },
    dispose: unsubscribe,
  };
}
