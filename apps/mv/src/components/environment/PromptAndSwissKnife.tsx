import React from "react";
import { Easing, interpolate } from "remotion";
import { clamp01 } from "../../animation/clawd/motion-style";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export interface PromptBubbleSpec {
  id: string;
  /** 气泡出现的秒数（对齐候选拍点） */
  spawnSec: number;
  /** 相对于画面水平中线 (640px) 的 X 坐标 (px) */
  x: number;
  /** 距离画面顶部的 Y 坐标 (px) */
  y: number;
  /** 气泡宽度 (px) */
  width: number;
  /** 提问文本 */
  prompt: string;
  /** 主题点缀色 */
  accent: string;
  /** 是否附带「鹈鹕骑自行车」经典评测 SVG 小图标 */
  hasPelicanBike?: boolean;
  /** Clawd 望向该气泡时的眼神与微侧倾目标 */
  lookX: number;
  lookY: number;
  tiltDeg: number;
}

/**
 * L002 ("What do you want to know?", 22.721s–27.161s) 逐拍浮现的 4 个 Prompt 气泡：
 * 分别落在候选拍点 F689 (22.97s)、F706 (23.53s)、F723 (24.10s)、F740 (24.67s)
 */
export const L002_PROMPT_BUBBLES: readonly PromptBubbleSpec[] = [
  {
    id: "bug",
    spawnSec: 22.97,
    x: -255,
    y: 262,
    width: 228,
    prompt: "Fix this bug?",
    accent: "#38BDF8",
    lookX: -0.52,
    lookY: -0.22,
    tiltDeg: -1.8,
  },
  {
    id: "pelican",
    spawnSec: 23.53,
    x: 268,
    y: 238,
    width: 288,
    prompt: "Draw a pelican on a bicycle",
    accent: "#F59E0B",
    hasPelicanBike: true,
    lookX: 0.56,
    lookY: -0.26,
    tiltDeg: 2.1,
  },
  {
    id: "quantum",
    spawnSec: 24.1,
    x: -280,
    y: 382,
    width: 256,
    prompt: "Explain quantum?",
    accent: "#A78BFA",
    lookX: -0.48,
    lookY: 0.08,
    tiltDeg: -1.4,
  },
  {
    id: "refactor",
    spawnSec: 24.67,
    x: 274,
    y: 386,
    width: 248,
    prompt: "Refactor the repo?",
    accent: "#4ADE80",
    lookX: 0.5,
    lookY: 0.08,
    tiltDeg: 1.5,
  },
] as const;

/**
 * L003 左上方沿拱形弧线逐拍贴出的卡通假名「と・く・い」
 */
export const L003_TOKUI_CHARS = [
  {
    char: "と",
    spawnSec: 27.43,
    offsetX: -62,
    offsetY: 14,
    rotDeg: -16,
    color: "#FDE047",
  },
  {
    char: "く",
    spawnSec: 28.0,
    offsetX: 0,
    offsetY: -8,
    rotDeg: -3,
    color: "#F8FAFC",
  },
  {
    char: "い",
    spawnSec: 28.6,
    offsetX: 62,
    offsetY: 10,
    rotDeg: 14,
    color: "#FDE047",
  },
] as const;

/** 合成为卡通艺术字「得意な」的时刻（F874 = 29.13s） */
export const L003_TOKUI_MERGE_SEC = 29.13;
/** 卡通弧线箭头从「得意な」射向 Clawd 自己的时刻（F891 = 29.70s） */
export const L003_ARROW_POINT_SEC = 29.7;
/** 箭头指中后瞬间展开全套不规则细金属折臂工具的时刻（F908 = 30.27s） */
export const L003_TOOLS_BURST_SEC = 30.27;
/** 工具与左上「得意な + 箭头」一同收起的时刻（33.62s） */
export const L004_TOOLS_FOLD_SEC = 33.62;

/**
 * 不规则多段细金属折臂工具规格：
 * 支持 2 段或 3 段不对称金属细杆（可带可选的第三段腕臂 len3 / deg3），
 * 让每支机械臂的高低、长短、折角方向和段数都呈现自然不规则的机械布局。
 */
export interface SwissKnifeToolSpec {
  id: string;
  label: string;
  mountX: number;
  mountY: number;
  len1: number;
  foldedDeg1: number;
  targetDeg1: number;
  len2: number;
  foldedDeg2: number;
  targetDeg2: number;
  /** 可选第三段小折臂（0 表示只有两段） */
  len3?: number;
  foldedDeg3?: number;
  targetDeg3?: number;
  foldedHeadDeg: number;
  targetHeadDeg: number;
  /** 瞬间展开的微小时差（0 ~ 0.04s） */
  staggerSec: number;
}

/**
 * 6 支非对称、不规则排布的纤细冷灰金属工具臂：
 * - 左上内侧 (code-clamp)：从左背高处直冲向左上再向右内钩（高挑两段长臂）
 * - 左中下外探 (search-lens)：避开左上方「得意な + 箭头」区域，从左腰向外平伸、再折向上方托起放大镜（三段 Z 字折臂）
 * - 左下低掠 (docs-saw)：从左底角向右下沉后再向左上斜挑出细齿钢尺刀
 * - 右上高挑 (bash-blade)：从右肩偏内侧高高斜刺向右上，肘部再折向垂直上方（最高点非对称主刀）
 * - 右中Z字曲折 (mcp-wrench)：从右背中部先向右下斜出、肘部急折向右上、腕部再折水平（三段多折机械扳手）
 * - 右下远伸 (canvas-stylus)：从右腰低处大跨度伸向右外侧、再向下微钩出针管绘图笔
 */
export const L003_SWISS_TOOLS: readonly SwissKnifeToolSpec[] = [
  {
    id: "code-clamp",
    label: "{ }",
    mountX: -32,
    mountY: -24,
    len1: 122,
    foldedDeg1: 10,
    targetDeg1: -24,
    len2: 96,
    foldedDeg2: -145,
    targetDeg2: 34,
    foldedHeadDeg: -35,
    targetHeadDeg: -8,
    staggerSec: 0,
  },
  {
    id: "bash-blade",
    label: ">_",
    mountX: 26,
    mountY: -26,
    len1: 92,
    foldedDeg1: -12,
    targetDeg1: 18,
    len2: 134,
    foldedDeg2: 145,
    targetDeg2: 16,
    foldedHeadDeg: 40,
    targetHeadDeg: -14,
    staggerSec: 0.01,
  },
  {
    id: "search-lens",
    label: "SEARCH",
    mountX: -68,
    mountY: 10,
    len1: 88,
    foldedDeg1: 6,
    targetDeg1: -98,
    len2: 76,
    foldedDeg2: -135,
    targetDeg2: 54,
    len3: 58,
    foldedDeg3: 120,
    targetDeg3: -32,
    foldedHeadDeg: -30,
    targetHeadDeg: 22,
    staggerSec: 0.018,
  },
  {
    id: "mcp-wrench",
    label: "TOOLS",
    mountX: 62,
    mountY: -4,
    len1: 118,
    foldedDeg1: -8,
    targetDeg1: 64,
    len2: 74,
    foldedDeg2: 140,
    targetDeg2: -52,
    len3: 64,
    foldedDeg3: -120,
    targetDeg3: 46,
    foldedHeadDeg: 35,
    targetHeadDeg: -18,
    staggerSec: 0.022,
  },
  {
    id: "docs-saw",
    label: "DOCS",
    mountX: -64,
    mountY: 32,
    len1: 102,
    foldedDeg1: 0,
    targetDeg1: -126,
    len2: 112,
    foldedDeg2: -140,
    targetDeg2: 44,
    foldedHeadDeg: -30,
    targetHeadDeg: -14,
    staggerSec: 0.032,
  },
  {
    id: "canvas-stylus",
    label: "SVG",
    mountX: 70,
    mountY: 28,
    len1: 128,
    foldedDeg1: 0,
    targetDeg1: 102,
    len2: 86,
    foldedDeg2: 140,
    targetDeg2: -22,
    foldedHeadDeg: 30,
    targetHeadDeg: 18,
    staggerSec: 0.036,
  },
] as const;

/**
 * 机械弹簧卡扣曲线（Snap-Lock）：
 * 0.095s（约 2.8 帧）极速冲过目标角度 12%，再用 0.045s“咔哒”硬回弹锁死在 1.0。
 */
export function sampleSnapOpen(sec: number, startSec: number): number {
  if (sec <= startSec) return 0;
  const dt = sec - startSec;
  const rushDur = 0.095;
  const lockDur = 0.045;
  if (dt < rushDur) {
    const t = dt / rushDur;
    const ease = 1 - (1 - t) ** 3;
    return ease * 1.12;
  }
  if (dt < rushDur + lockDur) {
    const t = (dt - rushDur) / lockDur;
    return 1.12 - 0.12 * t;
  }
  return 1;
}

/**
 * 干脆合刀曲线（Snap-Fold）：
 * 先微张 4% 解锁卡扣（0.04s），再 0.13s 极速折回 0。
 */
export function sampleSnapFold(sec: number, foldStartSec: number): number {
  if (sec <= foldStartSec) return 1;
  const dt = sec - foldStartSec;
  const unlockDur = 0.04;
  const foldDur = 0.13;
  if (dt < unlockDur) {
    return 1 + 0.04 * (dt / unlockDur);
  }
  if (dt < unlockDur + foldDur) {
    const t = (dt - unlockDur) / foldDur;
    const ease = t * t * (3 - 2 * t);
    return 1.04 * (1 - ease);
  }
  return 0;
}

/**
 * 计算 L002–L003 (22.721s–31.695s) Clawd 的眼神跟随与微倾角：
 * - L002 前半段 (22.721s–25.18s)：身体休息，眼神依次追随 4 个新冒出的 Prompt 气泡；
 * - L002 后半段 (25.18s–27.161s)：交给 A3 (tilt-invite) 本体动作 + 右上方纯问号 `?`；
 * - L003 前中段 (27.161s–30.25s)：眼神死死盯着左上方逐拍贴出的弧形「と → く → い → 得意な」，随后顺着卡通弯箭头移回自己身上。
 */
export function sampleL002PromptLook(sec: number): {
  lookX: number;
  lookY: number;
  tiltDeg: number;
} {
  if (sec >= 22.721 && sec < 25.45) {
    let lookX = 0;
    let lookY = 0;
    let tiltDeg = 0;

    for (const b of L002_PROMPT_BUBBLES) {
      const w = interpolate(
        sec,
        [b.spawnSec - 0.03, b.spawnSec + 0.14],
        [0, 1],
        {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        },
      );
      lookX = lookX * (1 - w) + b.lookX * w;
      lookY = lookY * (1 - w) + b.lookY * w;
      tiltDeg = tiltDeg * (1 - w) + b.tiltDeg * w;
    }

    const handoffToA3 = interpolate(sec, [25.05, 25.32], [1, 0], clamp);
    return {
      lookX: lookX * handoffToA3,
      lookY: lookY * handoffToA3,
      tiltDeg: tiltDeg * handoffToA3,
    };
  }

  if (sec >= 27.25 && sec < 31.2) {
    const enterStare = interpolate(sec, [27.32, 27.48], [0, 1], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    });
    const step2 = interpolate(sec, [27.96, 28.08], [0, 1], clamp);
    const step3 = interpolate(sec, [28.56, 28.68], [0, 1], clamp);
    const mergeStep = interpolate(
      sec,
      [L003_TOKUI_MERGE_SEC - 0.03, L003_TOKUI_MERGE_SEC + 0.1],
      [0, 1],
      clamp,
    );

    const rawLookX = -0.64 + 0.1 * step2 + 0.1 * step3 - 0.08 * mergeStep;
    const rawLookY = -0.36 - 0.04 * mergeStep;
    const rawTilt = -2.5 + 0.3 * step3;

    const followArrow = interpolate(
      sec,
      [L003_ARROW_POINT_SEC, L003_TOOLS_BURST_SEC - 0.04],
      [1, 0],
      {
        ...clamp,
        easing: Easing.inOut(Easing.cubic),
      },
    );

    const env = enterStare * followArrow;
    return {
      lookX: rawLookX * env,
      lookY: rawLookY * env,
      tiltDeg: rawTilt * env,
    };
  }

  return { lookX: 0, lookY: 0, tiltDeg: 0 };
}

/**
 * 计算 L003–L004 工具瞬间展开与亮招时的身体机械顿点反馈
 */
export function sampleL003SwissSnapKick(sec: number): {
  kickY: number;
  scaleKick: number;
  appealBoost: number;
} {
  const snapTimes = [
    { t: L003_TOKUI_MERGE_SEC, amp: 0.45 },
    { t: L003_TOOLS_BURST_SEC, amp: 1.45 },
    { t: 31.695, amp: 0.9 },
  ];
  let kickY = 0;
  let scaleKick = 0;
  for (const { t: t0, amp } of snapTimes) {
    if (sec >= t0 && sec <= t0 + 0.18) {
      const p = (sec - t0) / 0.18;
      const impulse = Math.sin(p * Math.PI) * (1 - p * 0.4);
      kickY -= 0.24 * impulse * amp;
      scaleKick += 0.032 * impulse * amp;
    }
  }
  const appealBoost =
    interpolate(sec, [31.695, 31.82], [0, 1], clamp) *
    interpolate(sec, [33.55, 33.72], [1, 0], clamp);

  return { kickY, scaleKick, appealBoost };
}

/**
 * 经典 LLM 评测梗：「画一个骑自行车的鹈鹕 (SVG of a pelican riding a bicycle)」极简几何涂鸦图标
 */
const PelicanBicycleMiniSvg: React.FC<{ accent: string }> = ({ accent }) => (
  <svg
    width={66}
    height={46}
    viewBox="0 0 66 46"
    style={{ flexShrink: 0, overflow: "visible" }}
  >
    <circle
      cx={14}
      cy={34}
      r={9}
      fill="none"
      stroke="#38BDF8"
      strokeWidth={2.2}
    />
    <circle
      cx={50}
      cy={34}
      r={9}
      fill="none"
      stroke="#38BDF8"
      strokeWidth={2.2}
    />
    <circle cx={14} cy={34} r={2} fill="#38BDF8" />
    <circle cx={50} cy={34} r={2} fill="#38BDF8" />
    <path
      d="M 14 34 L 28 34 L 42 22 L 23 22 Z M 28 34 L 22 19 M 42 22 L 50 34 M 42 22 L 45 16 L 50 16"
      fill="none"
      stroke="#94A3B8"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <ellipse
      cx={25}
      cy={15}
      rx={8}
      ry={5.5}
      transform="rotate(-12 25 15)"
      fill="#F8FAFC"
      stroke="#0F172A"
      strokeWidth={1.8}
    />
    <path
      d="M 30 13 Q 34 5 32 3"
      fill="none"
      stroke="#F8FAFC"
      strokeWidth={3.6}
      strokeLinecap="round"
    />
    <circle cx={33} cy={4} r={3.2} fill="#F8FAFC" />
    <path
      d="M 35 2.5 L 51 4.5 Q 46 13.5 35 7.5 Z"
      fill={accent}
      stroke="#0F172A"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
    <circle cx={33.5} cy={3.6} r={1.1} fill="#0F172A" />
    <path
      d="M 25 20 L 28 33 M 22 20 L 31 28"
      stroke={accent}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </svg>
);

/**
 * 6 款极简纤细冷灰金属末端工具头（统一采用拉丝钢/冷灰金属色，造型克制干净，突出细金属杆质感）
 */
const SlimMetalToolHeadSvg: React.FC<{
  id: string;
  openProgress: number;
  flash: number;
}> = ({ id, openProgress, flash }) => {
  const metalLight = flash > 0.35 ? "#FFFFFF" : "#E2E8F0";
  const metalMid = flash > 0.35 ? "#F1F5F9" : "#94A3B8";
  const metalDark = "#475569";
  const stroke = "#0F172A";
  const jawDeg = (1 - clamp01(openProgress)) * 16;

  switch (id) {
    case "code-clamp":
      return (
        <g>
          <rect
            x={-9}
            y={-7}
            width={18}
            height={9}
            rx={2}
            fill={metalDark}
            stroke={stroke}
            strokeWidth={2.2}
          />
          <g transform={`translate(-6, -7) rotate(${-jawDeg})`}>
            <path
              d="M 0 0 L -10 -9 L -10 -26 L -2 -35 M -10 -18 L -14 -18"
              fill="none"
              stroke={stroke}
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 0 0 L -10 -9 L -10 -26 L -2 -35 M -10 -18 L -14 -18"
              fill="none"
              stroke={metalLight}
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <g transform={`translate(6, -7) rotate(${jawDeg})`}>
            <path
              d="M 0 0 L 10 -9 L 10 -26 L 2 -35 M 10 -18 L 14 -18"
              fill="none"
              stroke={stroke}
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 0 0 L 10 -9 L 10 -26 L 2 -35 M 10 -18 L 14 -18"
              fill="none"
              stroke={metalLight}
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <circle cx={0} cy={-2.5} r={2} fill={metalLight} />
        </g>
      );

    case "bash-blade":
      return (
        <g>
          <path
            d="M -5.5 0 L -6.5 -44 L 3 -62 L 7.5 -48 L 5.5 0 Z"
            fill={metalLight}
            stroke={stroke}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <path d="M -3 -5 L -3.5 -42 L 2 -52 L 2 -5 Z" fill={metalMid} />
          <path
            d="M -2 -34 L 2.8 -29 L -2 -24 M -1 -17 L 3.8 -17"
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );

    case "search-lens":
      return (
        <g>
          <rect
            x={-4}
            y={-8}
            width={8}
            height={10}
            rx={1.5}
            fill={metalDark}
            stroke={stroke}
            strokeWidth={2}
          />
          <circle
            cx={0}
            cy={-25}
            r={17}
            fill="rgba(226, 232, 240, 0.14)"
            stroke={stroke}
            strokeWidth={6}
          />
          <circle
            cx={0}
            cy={-25}
            r={17}
            fill="none"
            stroke={metalLight}
            strokeWidth={3}
          />
          <path
            d="M -7 -32 L -2 -36 M -9 -25 L 3 -34"
            stroke="#F8FAFC"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.8}
          />
        </g>
      );

    case "mcp-wrench":
      return (
        <g>
          <path
            d="M -5.5 2 L -5.5 -12 L -14 -21 L -14 -36 L -6.5 -44 L -6.5 -27 L 0 -22 L 6.5 -27 L 6.5 -44 L 14 -36 L 14 -21 L 5.5 -12 L 5.5 2 Z"
            fill={metalLight}
            stroke={stroke}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <circle cx={0} cy={-8} r={2.3} fill={metalDark} />
        </g>
      );

    case "docs-saw":
      return (
        <g>
          <path
            d="M -5.5 2 L -5.5 -50 L 3.5 -50 L 8.5 -43 L 4.5 -38 L 8.5 -33 L 4.5 -28 L 8.5 -23 L 4.5 -18 L 8.5 -13 L 5.5 2 Z"
            fill={metalLight}
            stroke={stroke}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <path
            d="M -4.5 -40 L 0 -40 M -4.5 -32 L 2 -32 M -4.5 -24 L 0 -24 M -4.5 -16 L 2 -16"
            stroke={metalDark}
            strokeWidth={1.9}
            strokeLinecap="round"
          />
        </g>
      );

    case "canvas-stylus":
    default:
      return (
        <g>
          <path
            d="M -4.5 2 L -4.5 -32 L -2 -46 L 2 -46 L 4.5 -32 L 4.5 2 Z"
            fill={metalMid}
            stroke={stroke}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <rect
            x={-4.5}
            y={-23}
            width={9}
            height={7.5}
            fill={metalLight}
            stroke={stroke}
            strokeWidth={1.8}
          />
          <line
            x1={0}
            y1={-46}
            x2={0}
            y2={-58}
            stroke={metalLight}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </g>
      );
  }
};

/** 渲染单段纤细冷灰金属杆 + 顶部小铆钉 */
const SlimMetalRodSvg: React.FC<{
  len: number;
  width: number;
  rodMain: string;
  sideSign: number;
}> = ({ len, width, rodMain, sideSign }) => (
  <g>
    <line
      x1={0}
      y1={0}
      x2={0}
      y2={-len}
      stroke="#0F172A"
      strokeWidth={width + 4.2}
      strokeLinecap="round"
    />
    <line
      x1={0}
      y1={0}
      x2={0}
      y2={-len}
      stroke={rodMain}
      strokeWidth={width}
      strokeLinecap="round"
    />
    <line
      x1={-1.1 * sideSign}
      y1={-7}
      x2={-1.1 * sideSign}
      y2={-len + 7}
      stroke="#E2E8F0"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </g>
);

const CARTOON_FONT =
  '"Excalifont", "Hiragino Maru Gothic ProN", "Yu Gothic UI", "Segoe Print", "Comic Sans MS", cursive, sans-serif';

export interface PromptAndSwissKnifeProps {
  sec: number;
  /** Clawd 在舞台上的水平位置 (默认 0) */
  clawdX?: number;
  /** 渲染层级：behind 为 Clawd 背后的不规则细金属折臂工具，front 为气泡、无框问号与左上卡通「とくい → 得意な ↘」 */
  layer: "behind" | "front";
}

export const PromptAndSwissKnife: React.FC<PromptAndSwissKnifeProps> = ({
  sec,
  clawdX = 0,
  layer,
}) => {
  // =========================================================================
  // 1. FRONT 层：L002 气泡 + 无框问号 `?` + L003 左上弧形卡通字「とくい → 得意な ↘」
  // =========================================================================
  if (layer === "front") {
    const showL002 = sec >= 22.85 && sec <= 27.45;
    const showL003Text = sec >= 27.38 && sec <= 33.9;
    if (!showL002 && !showL003Text) return null;

    const l002Out = interpolate(sec, [27.12, 27.36], [0, 1], {
      ...clamp,
      easing: Easing.in(Easing.back(1.6)),
    });

    // L002 后半段配合 A3 (tilt-invite) 冒出的无框卡通问号「？」
    const qMarkIn = sampleSnapOpen(sec, 25.32);
    const qMarkTilt = Math.sin(Math.max(0, sec - 25.32) * 5.5) * 6;
    const qMarkOpacity = clamp01(qMarkIn * 2) * (1 - l002Out);

    // L003 左上方卡通「と・く・い → 得意な」锚点（放在左上方外侧，与左上机械臂错开不遮挡）
    const tokuiCenterX = -295;
    const tokuiCenterY = 205;
    const mergeProg = interpolate(
      sec,
      [L003_TOKUI_MERGE_SEC, L003_TOKUI_MERGE_SEC + 0.14],
      [0, 1],
      {
        ...clamp,
        easing: Easing.inOut(Easing.cubic),
      },
    );
    const kanjiSnap = sampleSnapOpen(sec, L003_TOKUI_MERGE_SEC + 0.05);
    const arrowProg = interpolate(
      sec,
      [L003_ARROW_POINT_SEC, L003_ARROW_POINT_SEC + 0.18],
      [0, 1],
      {
        ...clamp,
        easing: Easing.out(Easing.back(1.4)),
      },
    );
    // 卡通「得意な」和弯箭头一直保留到 L004 句尾收工具时 (33.62s) 才一起消失！
    const l003TextOut = interpolate(
      sec,
      [L004_TOOLS_FOLD_SEC, L004_TOOLS_FOLD_SEC + 0.16],
      [0, 1],
      clamp,
    );

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 6,
        }}
      >
        {/* 1A. L002 4 个卡拍 Prompt 气泡 */}
        {showL002 &&
          L002_PROMPT_BUBBLES.map((b, idx) => {
            if (sec < b.spawnSec - 0.02) return null;
            const popT = clamp01((sec - b.spawnSec) / 0.16);
            const popScale =
              popT < 0.72
                ? (popT / 0.72) * 1.08
                : 1.08 - 0.08 * ((popT - 0.72) / 0.28);

            const nextSpawn =
              idx < L002_PROMPT_BUBBLES.length - 1
                ? L002_PROMPT_BUBBLES[idx + 1].spawnSec
                : 25.32;
            const isFocused = sec >= b.spawnSec && sec < nextSpawn + 0.12;

            const floatY = Math.sin((sec - b.spawnSec) * 3.2 + idx) * 3.5;
            const scale = popScale * (1 - l002Out * 0.85);
            const opacity = clamp01(popT * 2.2) * (1 - l002Out);
            const isLeft = b.x < 0;

            return (
              <div
                key={b.id}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${clawdX + b.x}px)`,
                  top: b.y + floatY,
                  width: b.width,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                  opacity,
                  backgroundColor: "#141624",
                  border: `3px solid ${isFocused ? b.accent : "#334155"}`,
                  borderRadius: 14,
                  padding: b.hasPelicanBike ? "10px 14px" : "10px 16px",
                  boxShadow: isFocused
                    ? `0 10px 26px rgba(0,0,0,0.52), 0 0 16px ${b.accent}44`
                    : "0 8px 20px rgba(0,0,0,0.42)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily:
                    '"JetBrains Mono", "Fira Code", "Cascadia Mono", monospace',
                }}
              >
                <span
                  style={{
                    color: b.accent,
                    fontWeight: 900,
                    fontSize: 18,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  &gt;
                </span>
                <span
                  style={{
                    color: "#F8FAFC",
                    fontSize: b.hasPelicanBike ? 14.5 : 15.5,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    letterSpacing: "-0.01em",
                    flex: 1,
                  }}
                >
                  {b.prompt}
                </span>
                {b.hasPelicanBike && <PelicanBicycleMiniSvg accent={b.accent} />}
                <div
                  style={{
                    position: "absolute",
                    bottom: -9,
                    [isLeft ? "right" : "left"]: 22,
                    width: 12,
                    height: 12,
                    backgroundColor: "#141624",
                    borderRight: `3px solid ${isFocused ? b.accent : "#334155"}`,
                    borderBottom: `3px solid ${isFocused ? b.accent : "#334155"}`,
                    transform: "rotate(45deg)",
                  }}
                />
              </div>
            );
          })}

        {/* 1B. L002 后半段配合 A3 (tilt-invite) 冒出的无框卡通问号 `?` */}
        {showL002 && qMarkOpacity > 0.01 && (
          <div
            style={{
              position: "absolute",
              left: `calc(50% + ${clawdX + 106}px)`,
              top: 318,
              transform: `translate(-50%, -50%) scale(${qMarkIn * (1 - l002Out * 0.8)}) rotate(${14 + qMarkTilt}deg)`,
              opacity: qMarkOpacity,
              fontFamily: CARTOON_FONT,
              fontSize: 60,
              fontWeight: 900,
              color: "#FDE047",
              WebkitTextStroke: "9px #0F172A",
              paintOrder: "stroke fill",
              filter: "drop-shadow(0 6px 0 #0F172A)",
              lineHeight: 1,
            }}
          >
            ?
          </div>
        )}

        {/* 1C. L003 左上方沿拱形弧线贴出卡通字「と・く・い」→ 合成为卡通「得意な」→ 卡通弧线箭头一直指着 Clawd */}
        {showL003Text && (
          <>
            {/* 合并前的三个弧形排布卡通假名（无死板方框，带粗描边与各自俏皮倾角） */}
            {mergeProg < 0.98 &&
              L003_TOKUI_CHARS.map((item, idx) => {
                if (sec < item.spawnSec - 0.01) return null;
                const snap = sampleSnapOpen(sec, item.spawnSec);
                const curX = item.offsetX * (1 - mergeProg * 0.9);
                const curY = item.offsetY * (1 - mergeProg * 0.9);
                const wobble =
                  Math.sin((sec - item.spawnSec) * 6 + idx * 1.4) * 3;
                const scale = snap * (1 - mergeProg * 0.75) * (1 - l003TextOut);
                const opacity =
                  clamp01(snap * 2.5) * (1 - mergeProg) * (1 - l003TextOut);

                return (
                  <div
                    key={item.char}
                    style={{
                      position: "absolute",
                      left: `calc(50% + ${clawdX + tokuiCenterX + curX}px)`,
                      top: tokuiCenterY + curY,
                      transform: `translate(-50%, -50%) scale(${scale}) rotate(${item.rotDeg + wobble}deg)`,
                      opacity,
                      fontFamily: CARTOON_FONT,
                      fontSize: 54,
                      fontWeight: 900,
                      color: item.color,
                      WebkitTextStroke: "10px #0F172A",
                      paintOrder: "stroke fill",
                      filter: "drop-shadow(0 6px 0 #0F172A)",
                      lineHeight: 1,
                    }}
                  >
                    {item.char}
                  </div>
                );
              })}

            {/* 合成为卡通艺术字「得意な」（错落倾斜排布 + 漫画小星芒点缀） */}
            {sec >= L003_TOKUI_MERGE_SEC + 0.04 && (
              <div
                style={{
                  position: "absolute",
                  left: `calc(50% + ${clawdX + tokuiCenterX}px)`,
                  top: tokuiCenterY,
                  transform: `translate(-50%, -50%) scale(${kanjiSnap * (1 - l003TextOut * 0.85)}) rotate(-9deg)`,
                  opacity: clamp01(kanjiSnap * 2.2) * (1 - l003TextOut),
                  fontFamily: CARTOON_FONT,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 2,
                  filter: "drop-shadow(0 7px 0 #0F172A)",
                }}
              >
                {/* 漫画合成小爆发星点 */}
                <span
                  style={{
                    position: "absolute",
                    left: -26,
                    top: -18,
                    fontSize: 24,
                    color: "#FDE047",
                    WebkitTextStroke: "4px #0F172A",
                    paintOrder: "stroke fill",
                  }}
                >
                  ✦
                </span>
                <span
                  style={{
                    position: "absolute",
                    right: -24,
                    top: -14,
                    fontSize: 20,
                    color: "#FB923C",
                    WebkitTextStroke: "4px #0F172A",
                    paintOrder: "stroke fill",
                  }}
                >
                  ★
                </span>

                <span
                  style={{
                    fontSize: 56,
                    fontWeight: 900,
                    color: "#FDE047",
                    WebkitTextStroke: "11px #0F172A",
                    paintOrder: "stroke fill",
                    display: "inline-block",
                    transform: "rotate(-5deg) translateY(3px)",
                  }}
                >
                  得
                </span>
                <span
                  style={{
                    fontSize: 60,
                    fontWeight: 900,
                    color: "#F8FAFC",
                    WebkitTextStroke: "11px #0F172A",
                    paintOrder: "stroke fill",
                    display: "inline-block",
                    transform: "rotate(3deg) translateY(-4px)",
                  }}
                >
                  意
                </span>
                <span
                  style={{
                    fontSize: 48,
                    fontWeight: 900,
                    color: "#FB923C",
                    WebkitTextStroke: "10px #0F172A",
                    paintOrder: "stroke fill",
                    display: "inline-block",
                    transform: "rotate(11deg) translateY(2px)",
                  }}
                >
                  な
                </span>
              </div>
            )}

            {/* 卡通手绘风弧线箭头：从「得意な」弯向 Clawd，并在工具展开期间一直指着 Clawd 不消失 */}
            {arrowProg > 0.01 && (
              <svg
                width={1280}
                height={720}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  opacity: 1 - l003TextOut,
                  overflow: "visible",
                }}
              >
                {(() => {
                  // 箭头在指中后带一点活泼的周期轻戳动效
                  const poke =
                    sec > L003_ARROW_POINT_SEC + 0.2
                      ? Math.sin((sec - L003_ARROW_POINT_SEC) * 9) * 4
                      : 0;
                  const sx = 640 + clawdX + tokuiCenterX + 68;
                  const sy = tokuiCenterY + 34;
                  const ex = 640 + clawdX - 118 + poke * 0.75;
                  const ey = 374 + poke * 0.55;
                  // 向下微弯的卡通弧线控制点
                  const cx = (sx + ex) * 0.5 - 32;
                  const cy = (sy + ey) * 0.5 + 42;

                  // 按 arrowProg 插值当前箭头末端位置（沿二次贝塞尔曲线）
                  const t = clamp01(arrowProg);
                  const q0x = sx + (cx - sx) * t;
                  const q0y = sy + (cy - sy) * t;
                  const tipX =
                    (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
                  const tipY =
                    (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;

                  // 切线角度
                  const tanX = 2 * (1 - t) * (cx - sx) + 2 * t * (ex - cx);
                  const tanY = 2 * (1 - t) * (cy - sy) + 2 * t * (ey - cy);
                  const angleDeg = (Math.atan2(tanY, tanX) * 180) / Math.PI;

                  const curvePath = `M ${sx} ${sy} Q ${q0x} ${q0y} ${tipX} ${tipY}`;

                  return (
                    <g
                      style={{
                        filter: "drop-shadow(0 5px 0 #0F172A)",
                      }}
                    >
                      {/* 卡通粗黑外描边弧线 */}
                      <path
                        d={curvePath}
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth={14}
                        strokeLinecap="round"
                      />
                      {/* 内部明黄卡通填充弧线 */}
                      <path
                        d={curvePath}
                        fill="none"
                        stroke="#FDE047"
                        strokeWidth={7}
                        strokeLinecap="round"
                      />
                      {/* 饱满俏皮的卡通心形/燕尾大箭头尖 */}
                      {arrowProg > 0.35 && (
                        <g
                          transform={`translate(${tipX}, ${tipY}) rotate(${angleDeg}) scale(${clamp01((arrowProg - 0.35) * 1.8)})`}
                        >
                          <path
                            d="M 8 0 C -4 -9 -16 -17 -26 -19 C -21 -7 -21 7 -26 19 C -16 17 -4 9 8 0 Z"
                            fill="#FDE047"
                            stroke="#0F172A"
                            strokeWidth={4}
                            strokeLinejoin="round"
                          />
                        </g>
                      )}
                    </g>
                  );
                })()}
              </svg>
            )}
          </>
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. BEHIND 层：箭头指中 Clawd 后（30.27s），瞬间展开 6 支不规则排列的纤细灰色金属折臂工具
  // =========================================================================
  if (sec < L003_TOOLS_BURST_SEC - 0.02 || sec > 34.05) return null;

  const pivotX = 640 + clawdX;
  const pivotY = 432;

  const foldOut = sampleSnapFold(sec, L004_TOOLS_FOLD_SEC);
  const appealOpen = sampleSnapOpen(sec, 31.695) * clamp01(foldOut);

  return (
    <svg
      width={1280}
      height={720}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "none",
        zIndex: 4,
        overflow: "visible",
      }}
    >
      {L003_SWISS_TOOLS.map((tool) => {
        const triggerSec = L003_TOOLS_BURST_SEC + tool.staggerSec;
        if (sec < triggerSec - 0.01) return null;

        const shoulderOpen = sampleSnapOpen(sec, triggerSec);
        const elbowOpen = sampleSnapOpen(sec, triggerSec + 0.022);
        const wristOpen = sampleSnapOpen(sec, triggerSec + 0.042);

        const wristFold = sampleSnapFold(sec, L004_TOOLS_FOLD_SEC - 0.04);
        const elbowFold = sampleSnapFold(sec, L004_TOOLS_FOLD_SEC - 0.02);
        const shoulderFold = sampleSnapFold(sec, L004_TOOLS_FOLD_SEC);

        const r1 = shoulderOpen * shoulderFold;
        const r2 = elbowOpen * elbowFold;
        const r3 = wristOpen * wristFold;

        const armOpacity = clamp01(Math.min(shoulderOpen, shoulderFold) * 3.5);
        if (armOpacity <= 0.01) return null;

        const isRight = tool.targetDeg1 > 0;
        const sideSign = isRight ? 1 : -1;

        const deg1 =
          tool.foldedDeg1 +
          (tool.targetDeg1 - tool.foldedDeg1) * r1 +
          sideSign * 3 * appealOpen;

        const deg2 =
          tool.foldedDeg2 +
          (tool.targetDeg2 - tool.foldedDeg2) * r2 -
          sideSign * 5 * appealOpen;

        const hasSeg3 = (tool.len3 ?? 0) > 0;
        const deg3 = hasSeg3
          ? (tool.foldedDeg3 ?? 0) +
            ((tool.targetDeg3 ?? 0) - (tool.foldedDeg3 ?? 0)) * r3 +
            sideSign * 4 * appealOpen
          : 0;

        const headDeg =
          tool.foldedHeadDeg +
          (tool.targetHeadDeg - tool.foldedHeadDeg) * r3 +
          sideSign * 3 * appealOpen;

        const curLen1 = tool.len1 * clamp01(0.4 + 0.6 * r1);
        const curLen2 =
          (tool.len2 + (hasSeg3 ? 4 : 10) * appealOpen) *
          clamp01(0.35 + 0.65 * r2);
        const curLen3 = hasSeg3
          ? ((tool.len3 ?? 0) + 8 * appealOpen) * clamp01(0.35 + 0.65 * r3)
          : 0;

        const lockFlash =
          sec >= triggerSec + 0.08 && sec <= triggerSec + 0.2
            ? Math.sin(((sec - (triggerSec + 0.08)) / 0.12) * Math.PI)
            : 0;

        const rodMain = lockFlash > 0.35 ? "#F8FAFC" : "#94A3B8";
        const sx = pivotX + tool.mountX * clamp01(r1);
        const sy = pivotY + tool.mountY * clamp01(r1);

        return (
          <g
            key={tool.id}
            transform={`translate(${sx}, ${sy})`}
            opacity={armOpacity}
          >
            {/* 肩部小金属铰链座 */}
            <circle
              cx={0}
              cy={0}
              r={6}
              fill="#64748B"
              stroke="#0F172A"
              strokeWidth={2.2}
            />

            {/* 第 1 段细金属杆 */}
            <g transform={`rotate(${deg1})`}>
              <SlimMetalRodSvg
                len={curLen1}
                width={6.2}
                rodMain={rodMain}
                sideSign={sideSign}
              />

              {/* 第 1 偏折肘关节 */}
              <g transform={`translate(0, ${-curLen1})`}>
                <g transform={`rotate(${deg2})`}>
                  <SlimMetalRodSvg
                    len={curLen2}
                    width={5.0}
                    rodMain={rodMain}
                    sideSign={sideSign}
                  />

                  {/* 若有第 3 段腕臂则再经过一次偏折关节，否则直接挂载末端工具头 */}
                  {hasSeg3 ? (
                    <g transform={`translate(0, ${-curLen2})`}>
                      <g transform={`rotate(${deg3})`}>
                        <SlimMetalRodSvg
                          len={curLen3}
                          width={4.2}
                          rodMain={rodMain}
                          sideSign={sideSign}
                        />
                        <g
                          transform={`translate(0, ${-curLen3}) rotate(${headDeg})`}
                        >
                          <SlimMetalToolHeadSvg
                            id={tool.id}
                            openProgress={r3}
                            flash={lockFlash}
                          />
                        </g>
                      </g>
                      <circle
                        cx={0}
                        cy={0}
                        r={5.8}
                        fill="#64748B"
                        stroke="#0F172A"
                        strokeWidth={2.2}
                      />
                      <circle cx={0} cy={0} r={2.3} fill="#E2E8F0" />
                    </g>
                  ) : (
                    <g
                      transform={`translate(0, ${-curLen2}) rotate(${headDeg})`}
                    >
                      <SlimMetalToolHeadSvg
                        id={tool.id}
                        openProgress={r2}
                        flash={lockFlash}
                      />
                    </g>
                  )}
                </g>

                {/* 第一偏折肘部金属轴承 */}
                <circle
                  cx={0}
                  cy={0}
                  r={6.8}
                  fill="#64748B"
                  stroke="#0F172A"
                  strokeWidth={2.4}
                />
                <circle cx={0} cy={0} r={2.6} fill="#E2E8F0" />
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
};
