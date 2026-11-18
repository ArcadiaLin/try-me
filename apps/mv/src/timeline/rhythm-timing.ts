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

export interface BeatGrid {
  /** 第 0 拍所在帧（可为小数） */
  originFrame: number;
  /** 每拍帧数（连续值） */
  framesPerBeat: number;
}

const beatGridCache = new WeakMap<readonly number[], BeatGrid>();

/**
 * 对整数帧候选拍点做最小二乘线性拟合，得到连续拍网格。
 * 整数取整的拍点间隔在 16/17/18 帧之间跳动，直接按分段线性插值会让摆动速度抖动约 ±6%。
 */
export function fitBeatGrid(beats: readonly number[]): BeatGrid {
  const cached = beatGridCache.get(beats);
  if (cached) return cached;
  const n = beats.length;
  const meanX = (n - 1) / 2;
  const meanY = beats.reduce((sum, f) => sum + f, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - meanX) * (beats[i] - meanY);
    sxx += (i - meanX) ** 2;
  }
  const framesPerBeat = sxy / sxx;
  const grid = { originFrame: meanY - framesPerBeat * meanX, framesPerBeat };
  beatGridCache.set(beats, grid);
  return grid;
}

/** 第 index 拍（可为小数，如 0.5 表示半拍）在连续网格上的帧位置 */
export function beatGridFrame(index: number, beats: readonly number[]): number {
  const grid = fitBeatGrid(beats);
  return grid.originFrame + grid.framesPerBeat * index;
}

/** 当前帧在连续拍网格上的拍位置（整数即拍点） */
export function beatPosition(frame: number, beats: readonly number[]): number {
  const grid = fitBeatGrid(beats);
  return Math.max(0, (frame - grid.originFrame) / grid.framesPerBeat);
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export interface ClawdRhythmMotion {
  breathY: number;
  sway: number;
  /** 快压慢回的拍点下压包络 (0 ~ 1)，拍点处为 1 */
  pulse: number;
  /** 待机窗口的完整律动权重（左右摆 + 下压） */
  idleWeight: number;
  /** 叙事动作期间的纵向律动底层权重（只下压，不左右摆） */
  grooveWeight: number;
}

/** 拍前压下所占拍长（约 2 帧） */
const PULSE_ATTACK_BEATS = 0.12;
/** 拍后回弹所占拍长（约 7.5 帧），其余时间保持静止 */
const PULSE_RELEASE_BEATS = 0.45;

/** 快压慢回：拍前 0.12 拍快速压到底，拍后 0.45 拍缓出回弹，拍间静止 */
export function beatPulseEnvelope(position: number): number {
  const ph = position - Math.floor(position);
  if (ph >= 1 - PULSE_ATTACK_BEATS) {
    const u = (ph - (1 - PULSE_ATTACK_BEATS)) / PULSE_ATTACK_BEATS;
    return u * u * (3 - 2 * u);
  }
  if (ph < PULSE_RELEASE_BEATS) {
    const u = 1 - ph / PULSE_RELEASE_BEATS;
    return u * u;
  }
  return 0;
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

/** 叙事动作期间纵向律动底层的强度（相对待机律动） */
export const GROOVE_LAYER_WEIGHT = 0.22;

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
  // 叙事动作期间保留纵向律动底层：不在待机窗口时补足，ほら！ 贴地回弹 (52.576–53.7s) 让位给动作本身
  const popWindow = smooth(52.42, 52.576, sec) * (1 - smooth(53.55, 53.7, sec));
  const groove = GROOVE_LAYER_WEIGHT * (1 - weight) * (1 - popWindow) * gain;
  return {
    breathY: oldBreath + (Math.cos(position * Math.PI * 2) * 0.07 - oldBreath) * gain,
    sway: Math.cos(position * Math.PI),
    pulse: beatPulseEnvelope(position),
    idleWeight: weight * gain * bassGain,
    grooveWeight: groove,
  };
}
