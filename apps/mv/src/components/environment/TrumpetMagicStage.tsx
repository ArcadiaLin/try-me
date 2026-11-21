import React from "react";
import { interpolate } from "remotion";
import { clamp01, linearProg } from "../../animation/clawd/motion-style";
import { POP_PALETTE } from "../../styles/palette";
import { CLAWD_MODEL, getClawdViewBox } from "../clawd/model";

export interface TrumpetMagicStageProps {
  /** 当前秒数 */
  sec: number;
  /** Clawd 当前水平舞台偏移 (px) */
  clawdX: number;
  /** L011 小号动作进度 (0..1) */
  trumpetProgress: number;
  /** 当前全局节拍相位 (用于点亮后的克制呼吸微动) */
  beatPulse?: number;
}

/** L011 指令纸带魔术关键时间点（对齐 RC_BEAT_0091–0094 与 L065 ほら！） */
export const L011_TAPE_BURST_SEC = 50.43;
export const L011_STAFF_START_SEC = 50.62;
export const L011_TAPE_RETRACT_SEC = 52.08;
/** 4 枚乐器工具贴纸在 L065 (ほら！) 期间保留展示“看我都会这些”，至 54.52s 随 ほら！ 同步清场 */
export const L011_BADGES_CLEAR_START_SEC = 54.52;
export const L011_BADGES_CLEAR_END_SEC = 54.82;

export type MagicInstrumentKind = "keyboard" | "cymbal" | "snare" | "bass";

export interface MagicInstrumentSpec {
  id: MagicInstrumentKind;
  /** 极简终端工具调用名，明确表达 Clawd 正在调用该乐器 tool */
  toolLabel: string;
  x: number;
  y: number;
  rotDeg: number;
  lightSec: number;
  accent: string;
  accentSoft: string;
}

const TOOL_MONO_FONT =
  '"JetBrains Mono", "Cascadia Mono", "Fira Code", Consolas, monospace';

/**
 * 舞台两侧 4 枚待点亮的乐器贴纸徽章（与后续 L023 小分身乐队分工呼应）：
 * 置于中内侧（|x - 640| = 278..345），既避开中央 Clawd 主体与右上「ほら！」，也避开外侧 RhythmPopups（|x| >= 440）。
 */
export const L011_MAGIC_INSTRUMENTS: readonly MagicInstrumentSpec[] = [
  {
    id: "keyboard",
    toolLabel: "synth()",
    x: 640 + 312,
    y: 318,
    rotDeg: 5,
    lightSec: 50.88,
    accent: POP_PALETTE.mint,
    accentSoft: POP_PALETTE.mintLight,
  },
  {
    id: "cymbal",
    toolLabel: "hihat()",
    x: 640 + 368,
    y: 446,
    rotDeg: -6,
    lightSec: 51.18,
    accent: POP_PALETTE.yellow,
    accentSoft: POP_PALETTE.yellowLight,
  },
  {
    id: "snare",
    toolLabel: "snare()",
    x: 640 - 292,
    y: 274,
    rotDeg: -5,
    lightSec: 51.48,
    accent: POP_PALETTE.pink,
    accentSoft: POP_PALETTE.pinkLight,
  },
  {
    id: "bass",
    toolLabel: "kick()",
    x: 640 - 356,
    y: 418,
    rotDeg: 6,
    lightSec: 51.78,
    accent: POP_PALETTE.lime,
    accentSoft: POP_PALETTE.mint,
  },
] as const;

interface Point2D {
  x: number;
  y: number;
}

/** 三次贝塞尔采样 */
function cubicBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number,
): Point2D {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function cubicBezierTangent(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number,
): Point2D {
  const u = 1 - t;
  const dx =
    3 * u * u * (p1.x - p0.x) +
    6 * u * t * (p2.x - p1.x) +
    3 * t * t * (p3.x - p2.x);
  const dy =
    3 * u * u * (p1.y - p0.y) +
    6 * u * t * (p2.y - p1.y) +
    3 * t * t * (p3.y - p2.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** 估算小号喇叭口在 1280×720 舞台逻辑画布中的实时坐标 */
function computeTrumpetBellPoint(
  clawdX: number,
  trumpetProgress: number,
): { x: number; y: number; angleRad: number } {
  const { viewBoxWidth, viewBoxHeight } = getClawdViewBox();
  const clawdWidth = 310;
  const clawdHeight = Math.round(clawdWidth * (viewBoxHeight / viewBoxWidth));
  const svgLeft = 640 + clawdX - clawdWidth / 2;
  const svgTop = 720 - 162 - clawdHeight;
  const scaleX = clawdWidth / viewBoxWidth;
  const scaleY = clawdHeight / viewBoxHeight;

  const isPlaying = trumpetProgress >= 0.22 && trumpetProgress <= 0.76;
  const playPhase = isPlaying ? (trumpetProgress - 0.22) / 0.54 : 0;
  const bellSwayDeg = isPlaying
    ? Math.sin(playPhase * Math.PI * 2) * -6.5
    : interpolate(trumpetProgress, [0.76, 1], [0, 14], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  const pivotX = 9.5;
  const pivotY = 4.2;
  const rawBellX = 17.65;
  const rawBellY = 4.1;
  const rad = (bellSwayDeg * Math.PI) / 180;
  const dx = rawBellX - pivotX;
  const dy = rawBellY - pivotY;
  const rotX = pivotX + dx * Math.cos(rad) - dy * Math.sin(rad);
  const rotY = pivotY + dx * Math.sin(rad) + dy * Math.cos(rad);

  return {
    x: svgLeft + (rotX + CLAWD_MODEL.grid.padX) * scaleX,
    y: svgTop + (rotY + CLAWD_MODEL.grid.padTop) * scaleY,
    angleRad: rad,
  };
}

/** Snap-Lock 弹性过冲（带体积守恒 squash & stretch） */
function samplePopSpring(t: number): {
  sx: number;
  sy: number;
  opacity: number;
} {
  if (t <= 0) return { sx: 0.2, sy: 0.2, opacity: 0 };
  if (t >= 1) return { sx: 1, sy: 1, opacity: 1 };
  const s = interpolate(t, [0, 0.35, 0.65, 0.85, 1], [0.22, 1.18, 0.94, 1.03, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // 轻微体积守恒纵横挤压，随稳定迅速收敛
  const squash =
    interpolate(t, [0, 0.35, 0.65, 1], [0.14, -0.08, 0.04, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  return {
    sx: s * (1 + squash),
    sy: s / (1 + squash),
    opacity: clamp01(t / 0.22),
  };
}

/** 构造带真实厚度的打孔指令纸带多边形与表面符号采样点 */
function buildPaperTapeGeometry(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  tStart: number,
  tEnd: number,
  halfWidth: number,
) {
  const steps = 28;
  const topPts: Point2D[] = [];
  const botPts: Point2D[] = [];
  const marks: Array<{
    x: number;
    y: number;
    angleDeg: number;
    index: number;
  }> = [];

  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const t = tStart + (tEnd - tStart) * frac;
    const pt = cubicBezier(p0, p1, p2, p3, t);
    const tan = cubicBezierTangent(p0, p1, p2, p3, t);
    const nx = -tan.y;
    const ny = tan.x;
    // 靠近喇叭口一端略微收窄，更有吹出透视感
    const taper = interpolate(t, [0, 0.18, 1], [0.58, 1, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const hw = halfWidth * taper;
    topPts.push({ x: pt.x + nx * hw, y: pt.y + ny * hw });
    botPts.push({ x: pt.x - nx * hw, y: pt.y - ny * hw });
  }

  // 在固定参数位置放置纸带上的打孔点与清晰可读的 tool_call 极简符号（避免随长度抖动）
  const fixedTs = [0.14, 0.3, 0.48, 0.66, 0.82, 0.93];
  fixedTs.forEach((ft, index) => {
    if (ft > tStart + 0.03 && ft < tEnd - 0.03) {
      const pt = cubicBezier(p0, p1, p2, p3, ft);
      const tan = cubicBezierTangent(p0, p1, p2, p3, ft);
      marks.push({
        x: pt.x,
        y: pt.y,
        angleDeg: (Math.atan2(tan.y, tan.x) * 180) / Math.PI,
        index,
      });
    }
  });

  const outline = [
    ...topPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    ...botPts
      .slice()
      .reverse()
      .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    "Z",
  ].join(" ");

  const tipPt = cubicBezier(p0, p1, p2, p3, tEnd);
  const tipTan = cubicBezierTangent(p0, p1, p2, p3, tEnd);
  const tipAngleDeg = (Math.atan2(tipTan.y, tipTan.x) * 180) / Math.PI;

  return { outline, marks, tipPt, tipAngleDeg };
}

/** 构造一条平行偏移的 SVG 曲线路径，用于漫画三线谱 */
function buildOffsetCurvePath(
  points: readonly Point2D[],
  offsetPx: number,
): string {
  if (points.length < 2) return "";
  const shifted: Point2D[] = points.map((pt, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    return { x: pt.x + nx * offsetPx, y: pt.y + ny * offsetPx };
  });
  return shifted
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

/** 4 枚高辨识度波普漫画乐器内部图形（均在 0..88 × 0..74 贴纸坐标系中） */
const InstrumentGlyph: React.FC<{
  kind: MagicInstrumentKind;
  accent: string;
  accentSoft: string;
}> = ({ kind, accent, accentSoft }) => {
  const ink = POP_PALETTE.ink;

  if (kind === "keyboard") {
    return (
      <g>
        {/* 迷你波普合成器机身 */}
        <rect
          x={14}
          y={18}
          width={60}
          height={40}
          rx={7}
          fill={accent}
          stroke={ink}
          strokeWidth={3}
        />
        {/* 顶部控制条与两颗小旋钮 */}
        <circle cx={24} cy={26} r={3.2} fill={POP_PALETTE.yellow} stroke={ink} strokeWidth={2} />
        <circle cx={34} cy={26} r={3.2} fill={POP_PALETTE.pink} stroke={ink} strokeWidth={2} />
        <rect
          x={44}
          y={23}
          width={22}
          height={6}
          rx={2.5}
          fill={ink}
        />
        <rect x={47} y={25} width={8} height={2} rx={1} fill={POP_PALETTE.lime} />
        {/* 6 枚白键 */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={18 + i * 8.6}
            y={33}
            width={8.6}
            height={21}
            rx={1.5}
            fill={i === 2 ? POP_PALETTE.yellowLight : POP_PALETTE.creamLight}
            stroke={ink}
            strokeWidth={2}
          />
        ))}
        {/* 4 枚黑键 */}
        {[0, 1, 3, 4].map((i) => (
          <rect
            key={i}
            x={23.8 + i * 8.6}
            y={33}
            width={5.4}
            height={12.5}
            rx={1.2}
            fill={ink}
          />
        ))}
      </g>
    );
  }

  if (kind === "cymbal") {
    return (
      <g>
        {/* 立杆 */}
        <line x1={44} y1={13} x2={44} y2={62} stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
        <path d="M 33 62 L 44 54 L 55 62" fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {/* 下层镲盘 */}
        <ellipse
          cx={44}
          cy={38}
          rx={25}
          ry={6.5}
          fill={POP_PALETTE.amberMid}
          stroke={ink}
          strokeWidth={3}
        />
        {/* 上层镲盘 */}
        <ellipse
          cx={44}
          cy={31}
          rx={26}
          ry={7}
          fill={accent}
          stroke={ink}
          strokeWidth={3}
        />
        {/* 镲帽与高光 */}
        <ellipse cx={44} cy={28.5} rx={7} ry={3.2} fill={accentSoft} stroke={ink} strokeWidth={2.2} />
        {/* 两侧清脆震动短弧 */}
        <path
          d="M 14 24 Q 10 31 14 38 M 74 24 Q 78 31 74 38"
          fill="none"
          stroke={POP_PALETTE.mint}
          strokeWidth={2.8}
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (kind === "snare") {
    return (
      <g>
        {/* 鼓腔圆柱 */}
        <path
          d="M 20 32 L 20 50 A 24 8 0 0 0 68 50 L 68 32 Z"
          fill={accent}
          stroke={ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        {/* 鼓腔折线拉杆 */}
        <path
          d="M 25 38 L 32 50 L 40 38 L 48 50 L 56 38 L 63 50"
          fill="none"
          stroke={POP_PALETTE.creamLight}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 顶面鼓皮 */}
        <ellipse
          cx={44}
          cy={32}
          rx={24}
          ry={8.5}
          fill={POP_PALETTE.creamLight}
          stroke={ink}
          strokeWidth={3}
        />
        {/* 交叉双鼓槌 */}
        <line x1={22} y1={14} x2={48} y2={30} stroke={ink} strokeWidth={5.2} strokeLinecap="round" />
        <line x1={22} y1={14} x2={48} y2={30} stroke={POP_PALETTE.yellow} strokeWidth={2.4} strokeLinecap="round" />
        <line x1={66} y1={14} x2={40} y2={30} stroke={ink} strokeWidth={5.2} strokeLinecap="round" />
        <line x1={66} y1={14} x2={40} y2={30} stroke={POP_PALETTE.yellow} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    );
  }

  // bass: 立式低音大鼓 + 低音声波弧
  return (
    <g>
      {/* 左右斜撑支脚 */}
      <line x1={26} y1={52} x2={18} y2={62} stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
      <line x1={62} y1={52} x2={70} y2={62} stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
      {/* 外鼓壳 */}
      <circle
        cx={44}
        cy={38}
        r={22}
        fill={accentSoft}
        stroke={ink}
        strokeWidth={3.2}
      />
      {/* 内鼓皮 */}
      <circle
        cx={44}
        cy={38}
        r={16.5}
        fill={POP_PALETTE.creamLight}
        stroke={ink}
        strokeWidth={2.6}
      />
      {/* 鼓心圆环与低音标识点 */}
      <circle cx={44} cy={38} r={6.5} fill={accent} stroke={ink} strokeWidth={2.4} />
      {/* 底部毛毡击槌 */}
      <line x1={44} y1={59} x2={44} y2={44} stroke={ink} strokeWidth={3} strokeLinecap="round" />
      <circle cx={44} cy={43} r={3.5} fill={POP_PALETTE.pink} stroke={ink} strokeWidth={2} />
      {/* 顶部低音声波弧 */}
      <path
        d="M 32 12 Q 44 6 56 12"
        fill="none"
        stroke={POP_PALETTE.mint}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
    </g>
  );
};

/** 漫画手绘四角星芒 */
const FourPointStar: React.FC<{
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: string;
}> = ({ cx, cy, r, fill, stroke = POP_PALETTE.ink }) => {
  const ir = r * 0.3;
  const d = [
    `M ${cx} ${cy - r}`,
    `Q ${cx + ir * 0.4} ${cy - ir * 0.4} ${cx + r} ${cy}`,
    `Q ${cx + ir * 0.4} ${cy + ir * 0.4} ${cx} ${cy + r}`,
    `Q ${cx - ir * 0.4} ${cy + ir * 0.4} ${cx - r} ${cy}`,
    `Q ${cx - ir * 0.4} ${cy - ir * 0.4} ${cx} ${cy - r}`,
    "Z",
  ].join(" ");
  return <path d={d} fill={fill} stroke={stroke} strokeWidth={2} strokeLinejoin="round" />;
};

/**
 * L011 吹奏指令纸带 → 展开谱线 → 点亮舞台两侧乐器图形
 *
 * - 50.43s (RC_BEAT_0091): 喇叭口爆出卷曲的暖奶油打孔指令纸带（带螺旋纸卷头）
 * - 50.62s–51.80s: 纸带顺势舒展为横贯舞台上方的弧形漫画三线谱，按拍依次点亮两侧 4 枚乐器贴纸徽章
 * - 52.08s–52.44s: 小号放低送出，纸带与谱线利落追收
 * - 52.58s–52.86s: 衔接 L065 (ほら！) 蓄力，4 枚乐器徽章干净弹缩清场，把焦点 100% 留给贴地回弹与红奶油大字
 */
export const TrumpetMagicStage: React.FC<TrumpetMagicStageProps> = ({
  sec,
  clawdX,
  trumpetProgress,
  beatPulse = 0,
}) => {
  if (sec < L011_TAPE_BURST_SEC - 0.02 || sec > L011_BADGES_CLEAR_END_SEC + 0.05) {
    return null;
  }

  const bell = computeTrumpetBellPoint(clawdX, trumpetProgress);

  // 1. 指令纸带展开 (50.43s -> 50.86s) 与收回 (52.08s -> 52.40s)
  const tapeGrowRaw = linearProg(sec, L011_TAPE_BURST_SEC, 50.86);
  const tapeGrow = 1 - Math.pow(1 - tapeGrowRaw, 2.4);
  const tapeRetractRaw = linearProg(sec, L011_TAPE_RETRACT_SEC, 52.4);
  const tapeRetract = tapeRetractRaw * tapeRetractRaw;

  const tapeStartT = tapeRetract;
  const tapeEndT = Math.max(tapeStartT, tapeGrow);
  const showTape = tapeEndT - tapeStartT > 0.02;

  // 纸带从喇叭口向右上方弧形喷出，并在顶端顺滑向左上方弯转，与三线谱起点保持切线连续
  const tapeP0: Point2D = { x: bell.x + 2, y: bell.y - 2 };
  const tapeP1: Point2D = { x: bell.x + 122, y: bell.y - 8 };
  const tapeP2: Point2D = { x: 914, y: 274 };
  const tapeP3: Point2D = { x: 856, y: 190 };

  const tapeGeom = showTape
    ? buildPaperTapeGeometry(tapeP0, tapeP1, tapeP2, tapeP3, tapeStartT, tapeEndT, 15)
    : null;

  // 纸带展开过程中的螺旋纸卷头（展开到 0.92 后自然舒展消失）
  const curlFade =
    tapeGrowRaw > 0.02 && tapeGrowRaw < 0.96 && tapeRetractRaw <= 0.01
      ? interpolate(tapeGrowRaw, [0.02, 0.14, 0.72, 0.96], [0, 1, 0.85, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const curlRadius = interpolate(tapeGrowRaw, [0, 1], [19, 8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 吹口瞬时漫画气浪（0.18s 短促爆出即刻留白）
  const puffT = linearProg(sec, L011_TAPE_BURST_SEC, L011_TAPE_BURST_SEC + 0.19);
  const showPuff = puffT > 0 && puffT < 1;

  // 2. 展开的拱形谱线：从纸带末端 (834, 190) 顺着切线方向向左上拱过 Clawd 头顶，流畅连向左侧乐器
  const staffPoints: Point2D[] = [];
  const staffSteps = 44;
  const sP0: Point2D = { x: 856, y: 190 };
  const sP1: Point2D = { x: 766, y: 112 };
  const sP2: Point2D = { x: 510, y: 118 };
  const sP3: Point2D = { x: 356, y: 218 };
  for (let i = 0; i <= staffSteps; i++) {
    const t = i / staffSteps;
    const base = cubicBezier(sP0, sP1, sP2, sP3, t);
    // 轻微的波浪起伏，随时间缓慢流动
    const wave = Math.sin(t * Math.PI * 3 - (sec - L011_STAFF_START_SEC) * 5.2) * 5.5;
    staffPoints.push({ x: base.x, y: base.y + wave });
  }

  const staffGrowRaw = linearProg(sec, L011_STAFF_START_SEC, 51.72);
  const staffGrow = 1 - Math.pow(1 - staffGrowRaw, 1.8);
  const staffRetractRaw = linearProg(sec, 52.14, 52.48);
  const staffRetract = staffRetractRaw * staffRetractRaw;
  const staffVisibleFrac = Math.max(0, staffGrow - staffRetract);

  const staffLen = 580;
  const staffPathTop = buildOffsetCurvePath(staffPoints, -8);
  const staffPathMid = buildOffsetCurvePath(staffPoints, 0);
  const staffPathBot = buildOffsetCurvePath(staffPoints, 8);

  // 谱线上附着的 3 枚极简几何音符（随谱线展开依次显现）
  const staffNotes = [
    { frac: 0.22, appearSec: 50.92, color: POP_PALETTE.mint, double: false },
    { frac: 0.52, appearSec: 51.24, color: POP_PALETTE.yellow, double: true },
    { frac: 0.8, appearSec: 51.54, color: POP_PALETTE.pink, double: false },
  ];

  // 谱线分叉导引弧（连接主谱线与 4 枚乐器徽章）
  const branchConfigs: Array<{
    from: Point2D;
    ctrl: Point2D;
    to: Point2D;
    startSec: number;
    endSec: number;
    color: string;
  }> = [
    {
      from: { x: 856, y: 222 },
      ctrl: { x: 924, y: 248 },
      to: { x: 952, y: 284 },
      startSec: 50.74,
      endSec: 50.9,
      color: POP_PALETTE.mint,
    },
    {
      from: { x: 952, y: 368 },
      ctrl: { x: 996, y: 386 },
      to: { x: 1008, y: 412 },
      startSec: 51.02,
      endSec: 51.2,
      color: POP_PALETTE.yellow,
    },
    {
      from: { x: 356, y: 218 },
      ctrl: { x: 348, y: 236 },
      to: { x: 348, y: 246 },
      startSec: 51.34,
      endSec: 51.5,
      color: POP_PALETTE.pink,
    },
    {
      from: { x: 348, y: 326 },
      ctrl: { x: 300, y: 354 },
      to: { x: 284, y: 384 },
      startSec: 51.62,
      endSec: 51.8,
      color: POP_PALETTE.lime,
    },
  ];

  // L065 衔接清场系数（52.58s -> 52.86s 干脆弹缩消失）
  const clearT = linearProg(sec, L011_BADGES_CLEAR_START_SEC, L011_BADGES_CLEAR_END_SEC);

  return (
    <svg
      width={1280}
      height={720}
      viewBox="0 0 1280 720"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 7,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {/* 1. 喇叭口瞬时漫画气浪弧线（0.19s 短促爆出） */}
      {showPuff && (
        <g
          transform={`translate(${bell.x + 12}, ${bell.y - 4}) rotate(${
            (bell.angleRad * 180) / Math.PI - 12
          })`}
          opacity={interpolate(puffT, [0, 0.25, 1], [0, 1, 0])}
        >
          {[-26, 0, 26].map((deg, idx) => {
            const dist = 10 + puffT * 34;
            const len = 14 * (1 - puffT * 0.45);
            return (
              <line
                key={idx}
                x1={Math.cos((deg * Math.PI) / 180) * dist}
                y1={Math.sin((deg * Math.PI) / 180) * dist}
                x2={Math.cos((deg * Math.PI) / 180) * (dist + len)}
                y2={Math.sin((deg * Math.PI) / 180) * (dist + len)}
                stroke={idx === 1 ? POP_PALETTE.cream : POP_PALETTE.yellow}
                strokeWidth={4.2}
                strokeLinecap="round"
              />
            );
          })}
          <FourPointStar
            cx={18 + puffT * 24}
            cy={-26 - puffT * 14}
            r={11 * (1 - puffT * 0.35)}
            fill={POP_PALETTE.cream}
          />
        </g>
      )}

      {/* 2. 拱形漫画三线谱（纸带展开后的谱线） */}
      {staffVisibleFrac > 0.01 && (
        <g opacity={interpolate(staffRetractRaw, [0, 0.7, 1], [1, 0.85, 0])}>
          {/* 深墨底衬让三线谱在深靛黑舞台上通透立起 */}
          {[staffPathTop, staffPathMid, staffPathBot].map((d, idx) => (
            <path
              key={`ink-${idx}`}
              d={d}
              fill="none"
              stroke={POP_PALETTE.ink}
              strokeWidth={idx === 1 ? 6.2 : 4.8}
              strokeLinecap="round"
              strokeDasharray={`${staffLen * staffVisibleFrac} ${staffLen * 2}`}
              strokeDashoffset={-staffLen * staffRetract}
            />
          ))}
          {[staffPathTop, staffPathMid, staffPathBot].map((d, idx) => (
            <path
              key={`line-${idx}`}
              d={d}
              fill="none"
              stroke={idx === 1 ? POP_PALETTE.mintLight : POP_PALETTE.cream}
              strokeWidth={idx === 1 ? 2.8 : 2.1}
              strokeLinecap="round"
              strokeDasharray={`${staffLen * staffVisibleFrac} ${staffLen * 2}`}
              strokeDashoffset={-staffLen * staffRetract}
            />
          ))}

          {/* 谱线上的 3 枚极简漫画音符 */}
          {staffNotes.map((n, idx) => {
            const nt = linearProg(sec, n.appearSec, n.appearSec + 0.16);
            if (nt <= 0) return null;
            const spring = samplePopSpring(nt);
            const ptIndex = Math.round(n.frac * staffSteps);
            const pt = staffPoints[ptIndex];
            const bob = Math.sin((sec - n.appearSec) * 8 + idx * 1.4) * 2.5;
            return (
              <g
                key={idx}
                transform={`translate(${pt.x}, ${pt.y - 12 + bob}) scale(${spring.sx}, ${spring.sy})`}
                opacity={spring.opacity * (1 - staffRetractRaw)}
              >
                {n.double ? (
                  <g stroke={POP_PALETTE.ink} strokeWidth={2.4} strokeLinejoin="round">
                    <ellipse cx={-9} cy={7} rx={6.2} ry={4.6} fill={n.color} transform="rotate(-18 -9 7)" />
                    <ellipse cx={8} cy={4} rx={6.2} ry={4.6} fill={n.color} transform="rotate(-18 8 4)" />
                    <line x1={-4} y1={5} x2={-4} y2={-15} stroke={POP_PALETTE.ink} strokeWidth={3.2} strokeLinecap="round" />
                    <line x1={13} y1={2} x2={13} y2={-18} stroke={POP_PALETTE.ink} strokeWidth={3.2} strokeLinecap="round" />
                    <path d="M -4 -15 L 13 -18 L 13 -12 L -4 -9 Z" fill={n.color} />
                  </g>
                ) : (
                  <g stroke={POP_PALETTE.ink} strokeWidth={2.4} strokeLinejoin="round">
                    <ellipse cx={0} cy={6} rx={6.6} ry={4.8} fill={n.color} transform="rotate(-18 0 6)" />
                    <line x1={5} y1={4} x2={5} y2={-16} stroke={POP_PALETTE.ink} strokeWidth={3.2} strokeLinecap="round" />
                    <path
                      d="M 5 -16 C 14 -14 16 -6 11 -1"
                      fill="none"
                      stroke={POP_PALETTE.ink}
                      strokeWidth={5.2}
                      strokeLinecap="round"
                    />
                    <path
                      d="M 5 -16 C 14 -14 16 -6 11 -1"
                      fill="none"
                      stroke={n.color}
                      strokeWidth={2.6}
                      strokeLinecap="round"
                    />
                  </g>
                )}
              </g>
            );
          })}
        </g>
      )}

      {/* 3. 谱线分叉能量线（引向 4 枚乐器徽章） */}
      {branchConfigs.map((b, idx) => {
        const bt = linearProg(sec, b.startSec, b.endSec);
        if (bt <= 0) return null;
        const fadeOut = 1 - linearProg(sec, 52.12, 52.42);
        if (fadeOut <= 0.01) return null;
        const d = `M ${b.from.x} ${b.from.y} Q ${b.ctrl.x} ${b.ctrl.y} ${b.to.x} ${b.to.y}`;
        return (
          <g key={idx} opacity={fadeOut}>
            <path
              d={d}
              fill="none"
              stroke={POP_PALETTE.ink}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${120 * bt} 240`}
            />
            <path
              d={d}
              fill="none"
              stroke={b.color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${120 * bt} 240`}
            />
          </g>
        );
      })}

      {/* 4. 从喇叭口吹出的暖奶油打孔指令纸带 */}
      {tapeGeom && (
        <g>
          {/* 硬偏移阴影 */}
          <path
            d={tapeGeom.outline}
            transform="translate(5, 6)"
            fill={POP_PALETTE.ink}
            opacity={0.92}
          />
          {/* 暖奶油纸带本体 + 茄紫深墨粗描边 */}
          <path
            d={tapeGeom.outline}
            fill={POP_PALETTE.cream}
            stroke={POP_PALETTE.ink}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          {/* 纸带表面极简 tool_call 符号与打孔点（一眼看懂是工具调用指令纸带） */}
          {tapeGeom.marks.map((m) => {
            const tokens: Array<{ text: string; bg?: string }> = [
              { text: ">" },
              { text: "tool", bg: POP_PALETTE.mintLight },
              { text: "use", bg: POP_PALETTE.yellowLight },
              { text: "()", bg: POP_PALETTE.pinkLight },
              { text: "♪" },
              { text: "✓", bg: POP_PALETTE.lime },
            ];
            const tok = tokens[m.index % tokens.length];
            const textAngle =
              m.angleDeg < -90 || m.angleDeg > 90 ? m.angleDeg + 180 : m.angleDeg;
            return (
              <g
                key={m.index}
                transform={`translate(${m.x}, ${m.y}) rotate(${textAngle})`}
              >
                {/* 上下边缘打孔点 */}
                <circle cx={0} cy={-10.5} r={1.6} fill={POP_PALETTE.ink} opacity={0.5} />
                <circle cx={0} cy={10.5} r={1.6} fill={POP_PALETTE.ink} opacity={0.5} />
                {tok.bg && (
                  <rect
                    x={tok.text.length > 2 ? -15 : -9}
                    y={-6.5}
                    width={tok.text.length > 2 ? 30 : 18}
                    height={13}
                    rx={3.5}
                    fill={tok.bg}
                    stroke={POP_PALETTE.ink}
                    strokeWidth={1.4}
                  />
                )}
                <text
                  x={0}
                  y={3.8}
                  textAnchor="middle"
                  fontFamily={TOOL_MONO_FONT}
                  fontSize={10.5}
                  fontWeight={900}
                  fill={POP_PALETTE.ink}
                >
                  {tok.text}
                </text>
              </g>
            );
          })}

          {/* 展开前段的螺旋纸卷头 */}
          {curlFade > 0.01 && (
            <g
              transform={`translate(${tapeGeom.tipPt.x}, ${tapeGeom.tipPt.y}) rotate(${
                tapeGeom.tipAngleDeg - 35
              })`}
              opacity={curlFade}
            >
              <circle
                cx={4}
                cy={5}
                r={curlRadius}
                fill={POP_PALETTE.ink}
              />
              <circle
                cx={0}
                cy={0}
                r={curlRadius}
                fill={POP_PALETTE.cream}
                stroke={POP_PALETTE.ink}
                strokeWidth={3.2}
              />
              <path
                d={`M ${-curlRadius * 0.45} 0 A ${curlRadius * 0.45} ${
                  curlRadius * 0.45
                } 0 1 1 ${curlRadius * 0.55} ${curlRadius * 0.15} A ${
                  curlRadius * 0.25
                } ${curlRadius * 0.25} 0 1 1 0 0`}
                fill="none"
                stroke={POP_PALETTE.ink}
                strokeWidth={2.6}
                strokeLinecap="round"
              />
            </g>
          )}
        </g>
      )}

      {/* 5. 舞台两侧 4 枚被点亮的波普乐器贴纸徽章 */}
      {L011_MAGIC_INSTRUMENTS.map((inst) => {
        if (sec < inst.lightSec) return null;
        const popT = linearProg(sec, inst.lightSec, inst.lightSec + 0.2);
        const spring = samplePopSpring(popT);

        // 清场弹缩（52.58s -> 52.86s，先微扩再干脆收净）
        const clearScale =
          clearT > 0
            ? interpolate(clearT, [0, 0.24, 1], [1, 1.08, 0.15], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            : 1;
        const clearOpacity =
          clearT > 0
            ? interpolate(clearT, [0, 0.4, 1], [1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            : 1;
        if (clearOpacity <= 0.01) return null;

        // 点亮稳定后克制的节拍微弹（幅度 <= 3.5%）
        const idleBounce = popT >= 1 && clearT <= 0 ? 1 + beatPulse * 0.035 : 1;

        // 点亮瞬间 0.20s 短促外扩圆环 + 星芒
        const burstT = linearProg(sec, inst.lightSec, inst.lightSec + 0.21);
        const showBurst = burstT > 0 && burstT < 1;

        return (
          <g
            key={inst.id}
            transform={`translate(${inst.x}, ${inst.y})`}
            opacity={spring.opacity * clearOpacity}
          >
            {/* 点亮瞬间的短促漫画冲击环与星芒 */}
            {showBurst && (
              <g opacity={1 - burstT}>
                <circle
                  cx={0}
                  cy={0}
                  r={38 + burstT * 32}
                  fill="none"
                  stroke={inst.accent}
                  strokeWidth={4 * (1 - burstT * 0.6)}
                />
                <FourPointStar
                  cx={-48 - burstT * 14}
                  cy={-34 - burstT * 12}
                  r={11 * (1 - burstT * 0.3)}
                  fill={POP_PALETTE.yellow}
                />
                <FourPointStar
                  cx={48 + burstT * 14}
                  cy={32 + burstT * 10}
                  r={9 * (1 - burstT * 0.3)}
                  fill={POP_PALETTE.cream}
                />
              </g>
            )}

            {/* 贴纸徽章本体 */}
            <g
              transform={`rotate(${inst.rotDeg}) scale(${
                spring.sx * clearScale * idleBounce
              }, ${spring.sy * clearScale * idleBounce}) translate(-44, -37)`}
            >
              {/* 硬偏移投影 */}
              <rect
                x={5}
                y={6}
                width={88}
                height={74}
                rx={18}
                fill={POP_PALETTE.ink}
              />
              {/* 卡片深墨边框外缘的浅色贴纸描边，让贴纸从深靛黑舞台清晰跳出 */}
              <rect
                x={0}
                y={0}
                width={88}
                height={74}
                rx={18}
                fill="none"
                stroke={POP_PALETTE.creamLight}
                strokeWidth={7.4}
              />
              {/* 暖奶油圆角贴纸卡片 + 茄紫深墨粗边框 */}
              <rect
                x={0}
                y={0}
                width={88}
                height={74}
                rx={18}
                fill={POP_PALETTE.cream}
                stroke={POP_PALETTE.ink}
                strokeWidth={3.6}
              />
              {/* 顶部极客终端工具调用成功绿灯 + 极小对勾 */}
              <circle
                cx={74}
                cy={13}
                r={5.8}
                fill={POP_PALETTE.lime}
                stroke={POP_PALETTE.ink}
                strokeWidth={2}
              />
              <path
                d="M 71.4 13.1 L 73.2 15 L 76.8 11.2"
                fill="none"
                stroke={POP_PALETTE.ink}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* 乐器内部矢量图形 */}
              <InstrumentGlyph
                kind={inst.id}
                accent={inst.accent}
                accentSoft={inst.accentSoft}
              />
              {/* 底部极简终端 Tool Call 胶囊标签（外缘带细浅色描边，与深色舞台拉开边界） */}
              <g transform="translate(4, 67)">
                <rect
                  x={0}
                  y={0}
                  width={80}
                  height={20}
                  rx={6}
                  fill="none"
                  stroke={POP_PALETTE.creamLight}
                  strokeWidth={4.2}
                  opacity={0.72}
                />
                <rect
                  x={0}
                  y={0}
                  width={80}
                  height={20}
                  rx={6}
                  fill="#171622"
                  stroke={POP_PALETTE.ink}
                  strokeWidth={2}
                />
                <circle cx={11} cy={10} r={3} fill={inst.accent} />
                <text
                  x={20}
                  y={13.8}
                  fontFamily={TOOL_MONO_FONT}
                  fontSize={10.5}
                  fontWeight={700}
                  fill={POP_PALETTE.creamLight}
                >
                  {inst.toolLabel}
                </text>
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
};
