import type { ClawdPose } from "../../components/clawd/types.ts";

/**
 * 碎步跳位移（hop travel）：Clawd 只有四条固定在躯干下的短腿，无法逐脚迈步，
 * 因此水平位移只发生在四足全部离地的腾空段；着地时 X 完全锁死，脚不打滑。
 * 每一跳 = 预备下压（load）→ 腾空平移（air）→ 落地缓冲（land）。
 */
export interface HopSpec {
  /** 起跳（离地）时刻，秒 */
  takeoffSec: number;
  /** 落地时刻，秒 */
  landSec: number;
  /** 本跳落点（舞台水平偏移，px） */
  toX: number;
}

export type HopPhase = "stand" | "load" | "air" | "land";

export interface HopTravelState {
  /** 当前舞台水平偏移（px） */
  x: number;
  phase: HopPhase;
  /** 预备下压量 (0 ~ 1) */
  load: number;
  /** 腾空弧线 (0 ~ 1 ~ 0) */
  air: number;
  /** 落地缓冲量 (0 ~ 1 ~ 0) */
  land: number;
  /** 移动方向：1 向画面右，-1 向画面左 */
  dir: -1 | 0 | 1;
  /** 已完成的落点（含起点），供调试显示脚印 */
  plantedXs: number[];
}

export interface HopTravelOptions {
  loadSec?: number;
  landSec?: number;
}

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export function sampleHopTravel(
  sec: number,
  startX: number,
  hops: readonly HopSpec[],
  { loadSec = 0.09, landSec = 0.13 }: HopTravelOptions = {},
): HopTravelState {
  let x = startX;
  const plantedXs = [startX];
  let landing: { amount: number; dir: -1 | 0 | 1 } | null = null;

  for (const hop of hops) {
    const dir: -1 | 0 | 1 = hop.toX > x ? 1 : hop.toX < x ? -1 : 0;
    const loadStart = hop.takeoffSec - loadSec;
    if (sec < loadStart) break;
    if (sec < hop.takeoffSec) {
      const t = (sec - loadStart) / loadSec;
      return { x, phase: "load", load: Math.sin(t * Math.PI * 0.5), air: 0, land: 0, dir, plantedXs };
    }
    if (sec < hop.landSec) {
      const t = (sec - hop.takeoffSec) / (hop.landSec - hop.takeoffSec);
      return {
        x: x + (hop.toX - x) * easeInOutSine(t),
        phase: "air",
        load: 0,
        air: Math.sin(t * Math.PI),
        land: 0,
        dir,
        plantedXs,
      };
    }
    x = hop.toX;
    plantedXs.push(x);
    const sinceLand = sec - hop.landSec;
    landing = sinceLand < landSec ? { amount: Math.sin((sinceLand / landSec) * Math.PI), dir } : null;
  }

  if (landing) {
    return { x, phase: "land", load: 0, air: 0, land: landing.amount, dir: landing.dir, plantedXs };
  }
  return { x, phase: "stand", load: 0, air: 0, land: 0, dir: 0, plantedXs };
}

/**
 * 把碎步跳叠加到任意基础姿态上：保留手臂动作与表情，覆盖垂直弹跳、压缩与腿部收起。
 * height 为腾空高度（网格单位，1 格约 13.8px @ width 310）。
 */
export function applyHopToPose(
  pose: ClawdPose,
  s: HopTravelState,
  height = 0.85,
): ClawdPose {
  if (s.phase === "stand") return pose;
  const next: ClawdPose = { ...pose, legLifts: [...pose.legLifts] as ClawdPose["legLifts"] };
  let dy = 0;

  if (s.phase === "load") {
    dy = 0.38 * s.load;
    next.bodyOffsetX += s.dir * 0.3 * s.load;
    next.scaleX *= 1 + 0.06 * s.load;
    next.scaleY *= 1 - 0.06 * s.load;
  } else if (s.phase === "air") {
    // 腾空：整体离地，靠近前进方向的一对腿收得更高
    dy = -height * s.air;
    next.isAirborneAction = true;
    const lead = 0.55 * s.air;
    const trail = 0.32 * s.air;
    next.legLifts =
      s.dir >= 0 ? [trail, trail, lead, lead] : [lead, lead, trail, trail];
    next.torsoTiltDeg += s.dir * 3 * s.air;
    next.scaleX *= 1 - 0.03 * s.air;
    next.scaleY *= 1 + 0.04 * s.air;
  } else {
    dy = 0.32 * s.land;
    next.scaleX *= 1 + 0.06 * s.land;
    next.scaleY *= 1 - 0.05 * s.land;
  }

  next.bodyOffsetY += dy;
  // 手臂跟随躯干，腾空时略微甩起
  const armLift = s.phase === "air" ? -0.25 * s.air : 0;
  next.leftArmOffsetY += dy + armLift;
  next.rightArmOffsetY += dy + armLift;
  return next;
}

/** 让一个量带延迟地追向目标（用于追光“跟人慢半拍”），按秒采样，无状态 */
export function laggedFollow(
  sample: (sec: number) => number,
  sec: number,
  lagSec: number,
): number {
  // 对过去 lagSec 内的目标做三角加权平均，等效于平滑延迟
  const steps = 8;
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const w = 1 - t * 0.85;
    sum += sample(sec - t * lagSec) * w;
    wsum += w;
  }
  return sum / wsum;
}
