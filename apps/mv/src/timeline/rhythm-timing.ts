/** Frame-authored timing. Spectral candidates remain references pending listening. */
export interface RhythmKey {
  frame: number;
  sourceFrame: number;
  progress: number;
  label: string;
  sourceId?: string;
  sourceTrack?: string;
}

export interface RhythmPlan {
  id: string;
  keys: readonly RhythmKey[];
}

/** Monotone cubic interpolation keeps poses in order and velocity continuous. */
export function sampleRhythmPlan(frame: number, plan: RhythmPlan): number {
  const keys = plan.keys;
  if (frame <= keys[0].frame) return keys[0].progress;
  if (frame >= keys[keys.length - 1].frame) return keys[keys.length - 1].progress;
  const slopes = keys.slice(1).map((k, i) =>
    (k.progress - keys[i].progress) / (k.frame - keys[i].frame),
  );
  const tangent = (i: number) => {
    if (i === 0) return slopes[0];
    if (i === slopes.length) return slopes[i - 1];
    const a = slopes[i - 1], b = slopes[i];
    // Harmonic mean stays within the monotonicity bound even for uneven spacing.
    return a <= 0 || b <= 0 ? 0 : 2 * a * b / (a + b);
  };
  const i = keys.findIndex((k, index) => index < keys.length - 1 && frame < keys[index + 1].frame);
  const a = keys[i], b = keys[i + 1], span = b.frame - a.frame;
  const t = (frame - a.frame) / span;
  return (2 * t ** 3 - 3 * t ** 2 + 1) * a.progress
    + (t ** 3 - 2 * t ** 2 + t) * span * tangent(i)
    + (-2 * t ** 3 + 3 * t ** 2) * b.progress
    + (t ** 3 - t ** 2) * span * tangent(i + 1);
}

export function beatPosition(frame: number, beats: readonly number[]): number {
  if (frame <= beats[0]) return 0;
  const last = beats.length - 1;
  if (frame >= beats[last]) return last + (frame - beats[last]) / (beats[last] - beats[last - 1]);
  const next = beats.findIndex((f) => f > frame);
  return next - 1 + (frame - beats[next - 1]) / (beats[next] - beats[next - 1]);
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export interface ClawdRhythmMotion {
  breathY: number;
  sway: number;
  pulse: number;
  idleWeight: number;
}

export interface StageBeatKey {
  id: string;
  frame: number;
  beatFrame: number;
  strength: number;
  onsetId?: string;
  onsetTrack?: string;
}

export interface StagePulseKey {
  id: string;
  frame: number;
  sourceId: string;
  sourceTrack: string;
  strength: number;
  label: string;
}

export interface StageRhythmState {
  /** 上层薄底板向上靠近舞台上沿的收紧位移 (px, >= 0) */
  upperLiftPx: number;
  /** 下层薄底板稍晚跟随向上收紧的位移 (px, >= 0) */
  lowerLiftPx: number;
  /** 上层薄底板收紧时的水平微展宽度 (px, >= 0) */
  upperWidthDeltaPx: number;
  /** 下层薄底板收紧时的水平微展宽度 (px, >= 0) */
  lowerWidthDeltaPx: number;
  /** 上层薄底板亮部响应 (0 ~ 1) */
  upperHighlight: number;
  /** 下层薄底板亮部响应 (0 ~ 1) */
  lowerHighlight: number;
  /** 最下层底板内部短槽的中央向两端传递脉冲状态 */
  pulse: {
    active: boolean;
    progress: number;
    opacity: number;
    strength: number;
    sourceId?: string;
  };
}

export interface StageKeyboardZoneState {
  /** 对应固定演奏键位的按下深度 (0 ~ 1)，同时驱动琴键前端压下、橙色内衬与前侧机械指示窗翻出 */
  press: number;
  /** 当前音符的力度/亮度权重 (0 ~ 1)，用于区分强音与弱音的橙色内衬亮度 */
  velocity: number;
}

export interface StageKeyboardState {
  /** 是否处于可见时段（首次滑出前至橙色转青绿完全收回后为 false） */
  visible: boolean;
  /** 舞台前侧窄缝开启度 (0 ~ 1) */
  slotOpen: number;
  /** 键盘托盘向下滑出位移进度 (0 ~ 1) */
  traySlide: number;
  /** 键盘托盘向观众展开/收平进度 (0 ~ 1) */
  trayUnfold: number;
  /** 三个固定演奏键位（0: 左低半音下切 A3, 1: 左基准音 B♭3, 2: 右高八度音 B♭4）的实时机械状态 */
  zones: readonly [
    StageKeyboardZoneState,
    StageKeyboardZoneState,
    StageKeyboardZoneState,
  ];
}

/** 单轮 2 小节（32 个十六分音符）内的 19 个固定键位音符：[startSlot, endSlot, zoneIndex(0|1|2), velocity] */
const CYCLE_KEYBOARD_NOTES: readonly [number, number, 0 | 1 | 2, number][] = [
  // 前半句（第 1 小节）：强 | 强弱 | 强弱 | 强弱 | 间断
  [0.0, 1.65, 1, 0.88],
  [2.0, 2.85, 2, 1.0],
  [3.0, 4.65, 1, 0.72],
  [5.0, 5.85, 2, 0.96],
  [6.0, 7.65, 1, 0.74],
  [8.0, 9.6, 2, 1.0],
  [10.0, 11.65, 1, 0.72],
  [12.0, 13.65, 2, 0.9],
  [14.0, 15.65, 0, 0.86],
  // 后半句（第 2 小节）：强 | 强弱 | 强弱 | 强弱 | 强弱强
  [16.0, 17.65, 1, 0.88],
  [18.0, 18.85, 2, 1.0],
  [19.0, 20.65, 1, 0.72],
  [21.0, 21.85, 2, 0.96],
  [22.0, 23.65, 1, 0.74],
  [24.0, 25.6, 2, 1.0],
  [26.0, 27.65, 1, 0.72],
  [28.0, 28.85, 2, 0.96],
  [29.0, 29.85, 1, 0.74],
  [30.0, 31.42, 2, 1.0],
];

/** 前奏橙色段（SYNTH_001–SYNTH_004）的四轮双小节起止秒数 */
const INTRO_ORANGE_CYCLES: readonly [number, number][] = [
  [0.534, 5.02],
  [5.02, 9.51],
  [9.51, 13.996],
  [13.996, 18.477],
];

function evalKeyNoteEnvelope(
  sec: number,
  tStart: number,
  tEnd: number,
  velocity: number,
  releaseDur = 0.082,
): { press: number; velocity: number } {
  // 强音按下更快（~28ms），弱音稍缓（~42ms）
  const attackDur = velocity >= 0.9 ? 0.028 : 0.042;
  if (sec < tStart || sec > tEnd + releaseDur) {
    return { press: 0, velocity: 0 };
  }
  if (sec < tStart + attackDur) {
    const u = (sec - tStart) / attackDur;
    const ease = u * (2 - u);
    return { press: ease * velocity, velocity };
  }
  if (sec <= tEnd) {
    // 按到底部时保持稳定机械行程
    const holdT = (sec - (tStart + attackDur)) / Math.max(0.01, tEnd - tStart);
    const depth = velocity * (1 - 0.04 * holdT);
    return { press: depth, velocity };
  }
  // 松开后短促回弹，橙色随之熄灭，不留长光尾；但 82ms 回弹期允许与紧邻下一键（间隔 ~21ms）形成重叠交接
  const r = 1 - (sec - tEnd) / releaseDur;
  const rebound = r * r * (3 - 2 * r);
  return { press: rebound * velocity * 0.96, velocity: velocity * rebound };
}

/**
 * 计算舞台前侧抽出的自动演奏键盘状态（橙色段 0.254s–18.477s 专属装置）：
 * - 0.02s–0.23s：窄缝打开 -> 键盘向下滑出并向观众展开（在 0.254s 第一个音符前完成落位）
 * - 0.254s–18.465s：按音高与强弱在三个固定键位（0: A3下切, 1: B♭3基准, 2: B♭4高音）间机械跳动
 * - 18.465s–18.92s：最后一键松开、橙色熄灭 -> 键盘收平 -> 向下缩回舞台遮挡范围，青绿段完全离开
 */
export function sampleStageKeyboard(sec: number): StageKeyboardState {
  if (sec < 0.01 || sec >= 18.95) {
    return {
      visible: false,
      slotOpen: 0,
      traySlide: 0,
      trayUnfold: 0,
      zones: [
        { press: 0, velocity: 0 },
        { press: 0, velocity: 0 },
        { press: 0, velocity: 0 },
      ],
    };
  }

  // 进退场包络：确保 0.254s 首音前完全就位；18.465s 末音松开熄灭后再收平退出
  const slotOpen =
    smooth(0.01, 0.1, sec) * (1 - smooth(18.82, 18.94, sec));
  const traySlide =
    smooth(0.06, 0.2, sec) * (1 - smooth(18.6, 18.86, sec));
  const trayUnfold =
    smooth(0.11, 0.235, sec) * (1 - smooth(18.475, 18.63, sec));

  const zones: [
    StageKeyboardZoneState,
    StageKeyboardZoneState,
    StageKeyboardZoneState,
  ] = [
    { press: 0, velocity: 0 },
    { press: 0, velocity: 0 },
    { press: 0, velocity: 0 },
  ];

  const accumulate = (
    zoneIdx: 0 | 1 | 2,
    tStart: number,
    tEnd: number,
    vel: number,
    relDur = 0.082,
  ) => {
    const ev = evalKeyNoteEnvelope(sec, tStart, tEnd, vel, relDur);
    if (ev.press > zones[zoneIdx].press) {
      zones[zoneIdx] = ev;
    }
  };

  // SYNTH_000 (0.254s–0.534s): 开场前导最低音 A3 (zone 0)
  accumulate(0, 0.254, 0.485, 0.8, 0.075);

  // SYNTH_001–SYNTH_004 (0.534s–18.477s): 4 轮双小节循环
  for (let c = 0; c < INTRO_ORANGE_CYCLES.length; c++) {
    const [cStart, cEnd] = INTRO_ORANGE_CYCLES[c];
    const slotDur = (cEnd - cStart) / 32;
    const isLastCycle = c === INTRO_ORANGE_CYCLES.length - 1;
    for (let n = 0; n < CYCLE_KEYBOARD_NOTES.length; n++) {
      const [s0, s1, zIdx, vel] = CYCLE_KEYBOARD_NOTES[n];
      const t0 = cStart + s0 * slotDur;
      const t1 = cStart + s1 * slotDur;
      // 第 4 轮最后一个音在 18.465s 前干净收束熄灭，随后才执行键盘收平
      const rel = isLastCycle && n === CYCLE_KEYBOARD_NOTES.length - 1 ? 0.062 : 0.082;
      accumulate(zIdx, t0, t1, vel, rel);
    }
  }

  return {
    visible: slotOpen > 0.005,
    slotOpen,
    traySlide,
    trayUnfold,
    zones,
  };
}

/** 单次拍点的“短促收紧—明确回落”包络：2 帧快速收紧至峰值，7 帧回落归零，其余时间保持落位静止 */
function beatEnvelope(deltaFrames: number): number {
  const tightenFrames = 2;
  const releaseFrames = 7;
  if (deltaFrames < -tightenFrames || deltaFrames > releaseFrames) {
    return 0;
  }
  if (deltaFrames <= 0) {
    const u = (deltaFrames + tightenFrames) / tightenFrames;
    return u * u * (3 - 2 * u);
  }
  const u = 1 - deltaFrames / releaseFrames;
  return u * u * (3 - 2 * u);
}

/**
 * 计算舞台下方两层悬浮薄底板的基础律动（上层先收紧、下层滞后 2 帧跟随、依次回落）
 * 与最下层内部短槽的稀疏重点脉冲（从中央向两端传递并消退）。
 * 舞台上沿保持 0 位移，不影响 Clawd 脚部接触与本体动作。
 */
export function sampleStageRhythm(
  frame: number,
  stageBeats: readonly StageBeatKey[],
  stagePulses: readonly StagePulseKey[],
): StageRhythmState {
  const lowerLagFrames = 2;
  let upperNorm = 0;
  let lowerNorm = 0;

  for (const beat of stageBeats) {
    const uEnv = beatEnvelope(frame - beat.frame) * beat.strength;
    if (uEnv > upperNorm) {
      upperNorm = uEnv;
    }
    const lEnv =
      beatEnvelope(frame - (beat.frame + lowerLagFrames)) * beat.strength;
    if (lEnv > lowerNorm) {
      lowerNorm = lEnv;
    }
  }

  const sec = frame / 30;
  // 橙色键盘段（0.00s–18.88s）将键盘按动作为唯一主要底部效果：压低悬浮底板律动幅度，并暂停向两端跑的脉冲
  const plateGain = 0.22 + 0.78 * smooth(18.88, 19.0, sec);
  const pulsePaused = sec < 18.9;

  const pulseDurationFrames = 16;
  let activePulse: StageRhythmState["pulse"] = {
    active: false,
    progress: 0,
    opacity: 0,
    strength: 0,
  };

  if (!pulsePaused) {
    for (const p of stagePulses) {
      if (p.frame / 30 < 18.9) continue;
      const dt = frame - p.frame;
      if (dt >= 0 && dt <= pulseDurationFrames) {
        const t = dt / pulseDurationFrames;
        // 从中央快速向两端推进并在末端柔和减速
        const progress = 1 - Math.pow(1 - t, 2.15);
        const fadeIn = Math.min(1, (dt + 1) / 2);
        const fadeOut = 1 - smooth(0.46, 1.0, t);
        const opacity = fadeIn * fadeOut * p.strength;
        if (opacity > activePulse.opacity) {
          activePulse = {
            active: opacity > 0.01,
            progress,
            opacity,
            strength: p.strength,
            sourceId: p.sourceId,
          };
        }
      }
    }
  }

  return {
    upperLiftPx: upperNorm * 9.5 * plateGain,
    lowerLiftPx: lowerNorm * 12.5 * plateGain,
    upperWidthDeltaPx: upperNorm * 14 * plateGain,
    lowerWidthDeltaPx: lowerNorm * 12 * plateGain,
    upperHighlight: upperNorm * plateGain,
    lowerHighlight: lowerNorm * plateGain,
    pulse: activePulse,
  };
}

export function rhythmMotion(sec: number, position: number): ClawdRhythmMotion | undefined {
  // Protect terminal entrance, leap, tiptoe hops and the original 365-day double nod.
  if (sec >= 35.34 && sec < 40.8) return undefined;
  const protection = 1 - smooth(34.95, 35.34, sec) + smooth(40.8, 41.15, sec);
  const gain = Math.min(1, protection);
  const idleWindows = [[0, 18.525], [42.91, 43.95],
    [44.72, 45.36], [49.892, 52.576], [53.7, 55.168]];
  const weight = Math.max(0, ...idleWindows.map(([a, b]) =>
    smooth(a, a + 0.16, sec) * (1 - smooth(b - 0.16, b, sec)),
  ));
  const bassGain = 0.45 + 0.35 * smooth(9.35, 9.67, sec);
  const oldBreath = Math.sin(sec * Math.PI * 2) * 0.12;
  return {
    breathY: oldBreath + (Math.cos(position * Math.PI * 2) * 0.07 - oldBreath) * gain,
    sway: Math.cos(position * Math.PI),
    pulse: (1 + Math.cos(position * Math.PI * 2)) / 2,
    idleWeight: weight * gain * bassGain,
  };
}
