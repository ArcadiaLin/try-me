import React from "react";
import { Easing, interpolate } from "remotion";
import { clamp01 } from "../../animation/clawd/motion-style";
import { POP_PALETTE } from "../../styles/palette";

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
    accent: POP_PALETTE.mint,
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
    accent: POP_PALETTE.amberMid,
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
    accent: POP_PALETTE.pink,
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
    accent: POP_PALETTE.lime,
    lookX: 0.5,
    lookY: 0.08,
    tiltDeg: 1.5,
  },
] as const;

/**
 * L003 左上方沿拱形弧线逐拍贴出的卡通假名「と・く・い」（波普贴纸配色，保留用户校准时序）
 */
export const L003_TOKUI_CHARS = [
  {
    char: "と",
    spawnSec: 27.43,
    offsetX: -84,
    offsetY: 18,
    rotDeg: -16,
    color: POP_PALETTE.yellow,
    accent: POP_PALETTE.amberMid,
  },
  {
    char: "く",
    spawnSec: 28.15,
    offsetX: -12,
    offsetY: -10,
    rotDeg: -4,
    color: POP_PALETTE.pink,
    accent: POP_PALETTE.shoutRed,
  },
  {
    char: "い",
    spawnSec: 28.82,
    offsetX: 60,
    offsetY: 12,
    rotDeg: 13,
    color: POP_PALETTE.mint,
    accent: POP_PALETTE.mintDeep,
  },
  {
    char: "な",
    spawnSec: 30.15,
    offsetX: 112,
    offsetY: 22,
    rotDeg: 16,
    color: POP_PALETTE.yellow,
    accent: POP_PALETTE.amberMid,
  },
] as const;

/** 用户逐字时序；「な」在 30.15s 出现时开始合字。 */
export const L003_TOKUI_MERGE_SEC = L003_TOKUI_CHARS[3].spawnSec;
/** 箭头拍（保持 30.92s）：卡通弧线箭头指向 Clawd，此时 Clawd 不展开工具。 */
export const L003_ARROW_POINT_SEC = 30.92;
/** 展开拍（32.05s，与箭头拍分开）：Clawd 淡定普通眼瞬间展开 6 支细金属折臂工具。 */
export const L003_TOOLS_BURST_SEC = 32.05;
/** 亮招高潮拍（32.61s）：Clawd 切 ^ ^ 得意笑眼 + 工具二次昂扬外扩亮相，持续展示至收刀。 */
export const L004_SHOWCASE_BEAT_SEC = 32.61;
/** 延长一拍（沿用展开拍到亮招拍的 0.56s 间隔），约 34.18s 收回。 */
export const L004_TOOLS_FOLD_SEC =
  33.62 + (L004_SHOWCASE_BEAT_SEC - L003_TOOLS_BURST_SEC);

/**
 * 不规则多段细金属折臂工具规格：
 * 支持 2 段或 3 段不对称金属细杆（可带可选的第三段腕臂 len3 / deg3），
 * 并区分前/中/后景深明度与机械结构样式（导轨槽 / 平行小拉杆），
 * 让每支机械臂的高低、长短、折角方向和质感层次都呈现动画电影级精密感。
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
  /** 景深金属明度分级：bright (亮冷银前景) | mid (拉丝钢灰) | deep (深钛灰后景) */
  tone: "bright" | "mid" | "deep";
  /** 主臂结构细节：slot (镂空导轨槽) | piston (平行微液压拉杆) */
  rodStyle: "slot" | "piston";
  /** 待命呼吸微动相位 */
  idlePhase: number;
}

/**
 * 6 支非对称、不规则排布的精密冷灰金属工具臂（优化剪影平衡，左下锯片抬离台面边缘）：
 * - 左上内侧 (code-clamp)：从左背高处直冲向左上再向右内钩（高挑两段亮银主臂，带平行微拉杆）
 * - 左中下外探 (search-lens)：避开左上方「得意な + 箭头」区域，从左腰向外平伸、再折向上方托起放大镜（三段 Z 字折臂）
 * - 左下抬掠 (docs-saw)：从左底角斜向外下方再果断上挑，抬离台面边缘不磨地
 * - 右上高挑 (bash-blade)：从右肩偏内侧高高斜刺向右上，肘部再折向右上主锋（最高点非对称主刀，亮银前景）
 * - 右中Z字曲折 (mcp-wrench)：从右背中部先向右下斜出、肘部急折向右上、腕部再折外侧（三段多折机械扳手）
 * - 右下远伸 (canvas-stylus)：从右腰低处大跨度伸向右外侧再轻扬，托出精密针管绘图笔
 */
export const L003_SWISS_TOOLS: readonly SwissKnifeToolSpec[] = [
  {
    id: "docs-saw",
    label: "DOCS",
    mountX: -62,
    mountY: 22,
    len1: 96,
    foldedDeg1: 0,
    targetDeg1: -112,
    len2: 108,
    foldedDeg2: -140,
    targetDeg2: 34,
    foldedHeadDeg: -30,
    targetHeadDeg: -10,
    staggerSec: 0.03,
    tone: "deep",
    rodStyle: "slot",
    idlePhase: 2.4,
  },
  {
    id: "canvas-stylus",
    label: "SVG",
    mountX: 68,
    mountY: 20,
    len1: 118,
    foldedDeg1: 0,
    targetDeg1: 98,
    len2: 90,
    foldedDeg2: 140,
    targetDeg2: -24,
    foldedHeadDeg: 30,
    targetHeadDeg: 14,
    staggerSec: 0.034,
    tone: "deep",
    rodStyle: "slot",
    idlePhase: 3.7,
  },
  {
    id: "search-lens",
    label: "SEARCH",
    mountX: -66,
    mountY: 2,
    len1: 86,
    foldedDeg1: 6,
    targetDeg1: -92,
    len2: 74,
    foldedDeg2: -135,
    targetDeg2: 52,
    len3: 56,
    foldedDeg3: 120,
    targetDeg3: -30,
    foldedHeadDeg: -30,
    targetHeadDeg: 18,
    staggerSec: 0.016,
    tone: "mid",
    rodStyle: "piston",
    idlePhase: 1.1,
  },
  {
    id: "mcp-wrench",
    label: "TOOLS",
    mountX: 60,
    mountY: -8,
    len1: 114,
    foldedDeg1: -8,
    targetDeg1: 62,
    len2: 74,
    foldedDeg2: 140,
    targetDeg2: -50,
    len3: 62,
    foldedDeg3: -120,
    targetDeg3: 44,
    foldedHeadDeg: 35,
    targetHeadDeg: -16,
    staggerSec: 0.02,
    tone: "mid",
    rodStyle: "piston",
    idlePhase: 4.5,
  },
  {
    id: "code-clamp",
    label: "{ }",
    mountX: -30,
    mountY: -26,
    len1: 122,
    foldedDeg1: 10,
    targetDeg1: -24,
    len2: 98,
    foldedDeg2: -145,
    targetDeg2: 34,
    foldedHeadDeg: -35,
    targetHeadDeg: -6,
    staggerSec: 0,
    tone: "bright",
    rodStyle: "piston",
    idlePhase: 0.2,
  },
  {
    id: "bash-blade",
    label: ">_",
    mountX: 26,
    mountY: -28,
    len1: 96,
    foldedDeg1: -12,
    targetDeg1: 18,
    len2: 132,
    foldedDeg2: 145,
    targetDeg2: 15,
    foldedHeadDeg: 40,
    targetHeadDeg: -12,
    staggerSec: 0.008,
    tone: "bright",
    rodStyle: "slot",
    idlePhase: 1.8,
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

  if (sec >= 27.25 && sec < L003_TOOLS_BURST_SEC + 0.15) {
    const enterStare = interpolate(sec, [27.32, 27.48], [0, 1], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    });
    const step2 = interpolate(
      sec,
      [L003_TOKUI_CHARS[1].spawnSec, L003_TOKUI_CHARS[1].spawnSec + 0.12],
      [0, 1],
      clamp,
    );
    const step3 = interpolate(
      sec,
      [L003_TOKUI_CHARS[2].spawnSec, L003_TOKUI_CHARS[2].spawnSec + 0.12],
      [0, 1],
      clamp,
    );
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
      [L003_ARROW_POINT_SEC, L003_ARROW_POINT_SEC + 0.42],
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
 * 计算 L003–L004 工具展开拍与亮招高潮拍的身体反馈：
 * - 32.05s (展开拍): 机械瞬间弹锁顿点
 * - 32.61s (亮招高潮拍): ^ ^ 得意笑眼切入 + 挺胸张臂昂扬展示
 */
export function sampleL003SwissSnapKick(sec: number): {
  kickY: number;
  scaleKick: number;
  appealBoost: number;
  tilt: number;
  arm: number;
} {
  const snapTimes = [
    { t: L003_TOOLS_BURST_SEC, amp: 0.28, tiltDir: 0 },
    { t: L004_SHOWCASE_BEAT_SEC, amp: 0.36, tiltDir: -1 },
  ];
  let kickY = 0;
  let scaleKick = 0;
  let tilt = 0;
  let arm = 0;
  for (const hit of snapTimes) {
    const dt = sec - hit.t;
    if (dt >= -0.1 && dt <= 0.44) {
      const squash =
        interpolate(
          dt,
          [-0.1, -0.034, 0, 0.067, 0.14, 0.26, 0.44],
          [0, 0.1, -0.17, -0.17, 0.12, -0.025, 0],
          clamp,
        ) * hit.amp;
      scaleKick += squash;
      kickY +=
        interpolate(
          dt,
          [-0.1, -0.034, 0, 0.067, 0.14, 0.44],
          [0, 0.26, -0.62, -0.62, 0.18, 0],
          clamp,
        ) * hit.amp;
      arm +=
        interpolate(dt, [-0.08, 0, 0.12, 0.44], [0, 0.72, 0.72, 0], clamp) *
        hit.amp;
      if (hit.tiltDir !== 0) {
        tilt +=
          interpolate(dt, [-0.06, 0.04, 0.18, 0.44], [0, 3.6, 2.2, 0], clamp) *
          hit.tiltDir *
          (hit.amp / 0.32);
      }
    }
  }
  const appealBoost =
    interpolate(
      sec,
      [L004_SHOWCASE_BEAT_SEC, L004_SHOWCASE_BEAT_SEC + 0.12],
      [0, 1],
      clamp,
    ) * interpolate(sec, [33.52, 33.7], [1, 0], clamp);

  return { kickY, scaleKick, appealBoost, tilt, arm };
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
      stroke={POP_PALETTE.mint}
      strokeWidth={2.2}
    />
    <circle
      cx={50}
      cy={34}
      r={9}
      fill="none"
      stroke={POP_PALETTE.mint}
      strokeWidth={2.2}
    />
    <circle cx={14} cy={34} r={2} fill={POP_PALETTE.mint} />
    <circle cx={50} cy={34} r={2} fill={POP_PALETTE.mint} />
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
      stroke={POP_PALETTE.ink}
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
      stroke={POP_PALETTE.ink}
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
    <circle cx={33.5} cy={3.6} r={1.1} fill={POP_PALETTE.ink} />
    <path
      d="M 25 20 L 28 33 M 22 20 L 31 28"
      stroke={accent}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </svg>
);

/** 手绘四芒星闪光（用于「得意な」合成爆发与金属工具寒光点缀） */
const ComicSparkleSvg: React.FC<{
  x: number;
  y: number;
  size: number;
  fill: string;
  stroke?: string;
  rotation?: number;
  opacity?: number;
}> = ({ x, y, size, fill, stroke = POP_PALETTE.ink, rotation = 0, opacity = 1 }) => {
  if (opacity <= 0.01 || size <= 0.5) return null;
  const r = size;
  const ir = size * 0.28;
  const d = `M 0 ${-r} Q ${ir * 0.5} ${-ir * 0.5} ${r} 0 Q ${ir * 0.5} ${ir * 0.5} 0 ${r} Q ${-ir * 0.5} ${ir * 0.5} ${-r} 0 Q ${-ir * 0.5} ${-ir * 0.5} 0 ${-r} Z`;
  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      opacity={opacity}
    >
      <path
        d={d}
        fill={fill}
        stroke={stroke}
        strokeWidth={Math.max(1.6, size * 0.14)}
        strokeLinejoin="round"
      />
    </g>
  );
};

interface MetalPalette {
  light: string;
  mid: string;
  dark: string;
  edge: string;
}

function getMetalPalette(
  tone: SwissKnifeToolSpec["tone"],
  flash: number,
): MetalPalette {
  if (flash > 0.35) {
    return {
      light: "#FFFFFF",
      mid: "#F1F5F9",
      dark: "#94A3B8",
      edge: "#FFFFFF",
    };
  }
  switch (tone) {
    case "bright":
      return {
        light: "#F1F5F9",
        mid: "#CBD5E1",
        dark: "#64748B",
        edge: "#FFFFFF",
      };
    case "mid":
      return {
        light: "#E2E8F0",
        mid: "#94A3B8",
        dark: "#475569",
        edge: "#F8FAFC",
      };
    case "deep":
    default:
      return {
        light: "#CBD5E1",
        mid: "#64748B",
        dark: "#334155",
        edge: "#E2E8F0",
      };
  }
}

/**
 * 6 款精密冷灰金属末端工具头（带拉丝明暗分层与展开后的鲜活待命微动：
 * 代码钳轻咬合、战术刃金属寒光扫过、放大镜反光晃动、扳手微扭、针管笔尖微闪）
 */
const SlimMetalToolHeadSvg: React.FC<{
  id: string;
  tone: SwissKnifeToolSpec["tone"];
  openProgress: number;
  flash: number;
  sec: number;
  triggerSec: number;
}> = ({ id, tone, openProgress, flash, sec, triggerSec }) => {
  const pal = getMetalPalette(tone, flash);
  const stroke = POP_PALETTE.ink;
  const settledAge = Math.max(0, sec - (triggerSec + 0.16));

  // 代码钳在亮招高潮拍后清脆轻咬合两次（咔嚓、咔嚓）
  const snipCycle1 =
    sec >= L004_SHOWCASE_BEAT_SEC + 0.08 && sec <= L004_SHOWCASE_BEAT_SEC + 0.36
      ? Math.sin(((sec - (L004_SHOWCASE_BEAT_SEC + 0.08)) / 0.28) * Math.PI)
      : 0;
  const snipCycle2 =
    sec >= L004_SHOWCASE_BEAT_SEC + 0.44 && sec <= L004_SHOWCASE_BEAT_SEC + 0.72
      ? Math.sin(((sec - (L004_SHOWCASE_BEAT_SEC + 0.44)) / 0.28) * Math.PI)
      : 0;
  const snipDeg = (snipCycle1 + snipCycle2) * 8.5;
  const jawDeg = (1 - clamp01(openProgress)) * 18 - snipDeg;

  // 金属寒光扫过（展开锁定后第一次 + 32.61s 亮招高潮拍第二次）
  const glint1 = clamp01((sec - (triggerSec + 0.12)) / 0.32);
  const glint2 = clamp01((sec - (L004_SHOWCASE_BEAT_SEC + 0.04)) / 0.36);
  const activeGlint =
    glint2 > 0 && glint2 < 1
      ? glint2
      : glint1 > 0 && glint1 < 1
        ? glint1
        : -1;

  switch (id) {
    case "code-clamp":
      return (
        <g>
          {/* 腕部双螺栓卡盘 */}
          <rect
            x={-11}
            y={-8}
            width={22}
            height={10}
            rx={2.5}
            fill={pal.dark}
            stroke={stroke}
            strokeWidth={2.2}
          />
          <rect
            x={-8}
            y={-6}
            width={16}
            height={3}
            rx={1}
            fill={pal.mid}
          />
          <g transform={`translate(-6.5, -8) rotate(${-jawDeg})`}>
            <path
              d="M 0 0 L -12 -10 L -12 -28 L -2 -39 M -12 -19 L -17 -19"
              fill="none"
              stroke={stroke}
              strokeWidth={7.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 0 0 L -12 -10 L -12 -28 L -2 -39 M -12 -19 L -17 -19"
              fill="none"
              stroke={pal.light}
              strokeWidth={3.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M -11 -11 L -11 -27"
              fill="none"
              stroke={pal.edge}
              strokeWidth={1.3}
              strokeLinecap="round"
            />
          </g>
          <g transform={`translate(6.5, -8) rotate(${jawDeg})`}>
            <path
              d="M 0 0 L 12 -10 L 12 -28 L 2 -39 M 12 -19 L 17 -19"
              fill="none"
              stroke={stroke}
              strokeWidth={7.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 0 0 L 12 -10 L 12 -28 L 2 -39 M 12 -19 L 17 -19"
              fill="none"
              stroke={pal.light}
              strokeWidth={3.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 11 -11 L 11 -27"
              fill="none"
              stroke={pal.edge}
              strokeWidth={1.3}
              strokeLinecap="round"
            />
          </g>
          <circle cx={-4.5} cy={-3} r={1.6} fill={pal.edge} />
          <circle cx={4.5} cy={-3} r={1.6} fill={pal.edge} />
          {/* 咬合瞬间的微闪星点 */}
          {(snipCycle1 > 0.65 || snipCycle2 > 0.65) && (
            <ComicSparkleSvg
              x={0}
              y={-34}
              size={9}
              fill="#FFFFFF"
              stroke={POP_PALETTE.ink}
              rotation={18}
              opacity={Math.max(snipCycle1, snipCycle2)}
            />
          )}
        </g>
      );

    case "bash-blade":
      return (
        <g>
          {/* 刀柄护手 */}
          <rect
            x={-8.5}
            y={-5}
            width={17}
            height={7}
            rx={2}
            fill={pal.dark}
            stroke={stroke}
            strokeWidth={2.2}
          />
          {/* 双面斜切精钢刃身 */}
          <path
            d="M -6 -4 L -7.5 -48 L 3 -68 L 8.5 -52 L 6 -4 Z"
            fill={pal.light}
            stroke={stroke}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          {/* 刀背暗面折棱 */}
          <path d="M -5.5 -6 L -6.2 -46 L 2.2 -61 L 1.2 -6 Z" fill={pal.mid} />
          {/* 刀刃亮边 */}
          <path
            d="M 2.5 -63 L 7 -51 L 4.8 -8"
            fill="none"
            stroke={pal.edge}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {/* 刻蚀 >_ 标记 */}
          <path
            d="M -2.2 -36 L 2.8 -31 L -2.2 -26 M -1.2 -19 L 4 -19"
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 刀刃掠过的白色金属寒光 */}
          {activeGlint > 0 && (
            <line
              x1={-6}
              y1={-10 - activeGlint * 48}
              x2={7}
              y2={-18 - activeGlint * 48}
              stroke="#FFFFFF"
              strokeWidth={4.5}
              strokeLinecap="round"
              opacity={Math.sin(activeGlint * Math.PI) * 0.95}
            />
          )}
          {activeGlint > 0.55 && (
            <ComicSparkleSvg
              x={3}
              y={-67}
              size={11 * Math.sin(((activeGlint - 0.55) / 0.45) * Math.PI)}
              fill="#FFFFFF"
              stroke={POP_PALETTE.ink}
              rotation={12}
            />
          )}
        </g>
      );

    case "search-lens": {
      const shimmerShift = Math.sin(settledAge * 4.2) * 3.5;
      return (
        <g>
          {/* 精密镜柄套环 */}
          <rect
            x={-5}
            y={-9}
            width={10}
            height={11}
            rx={2}
            fill={pal.dark}
            stroke={stroke}
            strokeWidth={2}
          />
          <circle cx={0} cy={-3.5} r={1.5} fill={pal.edge} />
          {/* 镜片玻璃底色 + 金属外圈 */}
          <circle
            cx={0}
            cy={-27}
            r={18.5}
            fill="rgba(186, 230, 253, 0.22)"
            stroke={stroke}
            strokeWidth={6.8}
          />
          <circle
            cx={0}
            cy={-27}
            r={18.5}
            fill="none"
            stroke={pal.light}
            strokeWidth={3.4}
          />
          <circle
            cx={0}
            cy={-27}
            r={15.2}
            fill="none"
            stroke={pal.dark}
            strokeWidth={1.1}
            opacity={0.7}
          />
          {/* 镜片动态反光条 */}
          <path
            d={`M ${-8 + shimmerShift * 0.5} -34 L ${-1 + shimmerShift * 0.5} -39 M ${-10 + shimmerShift} -26 L ${4 + shimmerShift} -37`}
            stroke="#FFFFFF"
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={0.85}
          />
          {/* 顶部小测距刻度点 */}
          <circle cx={0} cy={-45.5} r={2.2} fill={pal.edge} stroke={stroke} strokeWidth={1.4} />
        </g>
      );
    }

    case "mcp-wrench": {
      const twist = Math.sin(settledAge * 5.2) * 6 * clamp01(settledAge * 2);
      return (
        <g transform={`rotate(${twist})`}>
          <path
            d="M -6 2 L -6 -13 L -16 -23 L -16 -39 L -7.5 -48 L -7.5 -29 L 0 -23.5 L 7.5 -29 L 7.5 -48 L 16 -39 L 16 -23 L 6 -13 L 6 2 Z"
            fill={pal.light}
            stroke={stroke}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          {/* 减重凹槽与高光边 */}
          <path
            d="M -2.2 -3 L -2.2 -16 L 2.2 -16 L 2.2 -3 Z"
            fill={pal.dark}
          />
          <path
            d="M -12.5 -24 L -12.5 -37 M 12.5 -24 L 12.5 -37"
            stroke={pal.edge}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
      );
    }

    case "docs-saw":
      return (
        <g>
          <rect
            x={-7}
            y={-4}
            width={14}
            height={6}
            rx={1.5}
            fill={pal.dark}
            stroke={stroke}
            strokeWidth={2}
          />
          <path
            d="M -6 -2 L -6 -52 L 3 -52 L 9.5 -45 L 4.5 -40 L 9.5 -35 L 4.5 -30 L 9.5 -25 L 4.5 -20 L 9.5 -15 L 5.5 -2 Z"
            fill={pal.light}
            stroke={stroke}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <path d="M -4.5 -4 L -4.5 -50 L 0 -50 L 0 -4 Z" fill={pal.mid} />
          <path
            d="M -5.2 -44 L -0.5 -44 M -5.2 -36 L 1.8 -36 M -5.2 -28 L -0.5 -28 M -5.2 -20 L 1.8 -20 M -5.2 -12 L -0.5 -12"
            stroke={stroke}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
      );

    case "canvas-stylus":
    default: {
      const tipGlow =
        sec >= L004_SHOWCASE_BEAT_SEC + 0.15 &&
        sec <= L004_SHOWCASE_BEAT_SEC + 0.7
          ? Math.sin(((sec - (L004_SHOWCASE_BEAT_SEC + 0.15)) / 0.55) * Math.PI)
          : 0;
      return (
        <g>
          {/* 笔身与金属笔夹 */}
          <path
            d="M -5 2 L -5 -33 L -2.2 -48 L 2.2 -48 L 5 -33 L 5 2 Z"
            fill={pal.mid}
            stroke={stroke}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          {/* 滚花金属握环 */}
          <rect
            x={-5.2}
            y={-25}
            width={10.4}
            height={9}
            fill={pal.light}
            stroke={stroke}
            strokeWidth={1.8}
          />
          <line x1={-4.5} y1={-22} x2={4.5} y2={-22} stroke={pal.dark} strokeWidth={1.2} />
          <line x1={-4.5} y1={-19} x2={4.5} y2={-19} stroke={pal.dark} strokeWidth={1.2} />
          {/* 侧边细金属笔夹 */}
          <path
            d="M 5 -12 L 8.5 -12 L 8.5 -30 L 5 -32"
            fill="none"
            stroke={stroke}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <path
            d="M 5 -12 L 8.5 -12 L 8.5 -30 L 5 -32"
            fill="none"
            stroke={pal.light}
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
          {/* 精密针管笔尖 */}
          <line
            x1={0}
            y1={-48}
            x2={0}
            y2={-61}
            stroke={stroke}
            strokeWidth={4.6}
            strokeLinecap="round"
          />
          <line
            x1={0}
            y1={-48}
            x2={0}
            y2={-61}
            stroke={pal.edge}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          {tipGlow > 0.1 && (
            <ComicSparkleSvg
              x={0}
              y={-63}
              size={10 * tipGlow}
              fill={POP_PALETTE.yellow}
              stroke={POP_PALETTE.ink}
              rotation={20}
            />
          )}
        </g>
      );
    }
  }
};

/**
 * 精密冷灰金属连杆（带微锥度、双面拉丝金属高光 + 可选镂空导轨槽或平行小液压拉杆，
 * 彻底告别“火柴棍”单调直线感，同时保持纤细利落）
 */
const ArticulatedMetalRodSvg: React.FC<{
  len: number;
  baseWidth: number;
  tipWidth: number;
  pal: MetalPalette;
  sideSign: number;
  styleType?: "slot" | "piston" | "plain";
}> = ({ len, baseWidth, tipWidth, pal, sideSign, styleType = "plain" }) => {
  if (len <= 2) return null;
  const bw = baseWidth * 0.5;
  const tw = tipWidth * 0.5;
  const poly = `M ${-bw} 0 L ${-tw} ${-len} L ${tw} ${-len} L ${bw} 0 Z`;

  return (
    <g>
      {/* 平行辅助微液压细拉杆（仅主臂 piston 样式） */}
      {styleType === "piston" && len > 46 && (
        <g>
          <line
            x1={sideSign * (bw + 3.2)}
            y1={-12}
            x2={sideSign * (tw + 2.8)}
            y2={-len * 0.68}
            stroke={POP_PALETTE.ink}
            strokeWidth={4.2}
            strokeLinecap="round"
          />
          <line
            x1={sideSign * (bw + 3.2)}
            y1={-12}
            x2={sideSign * (tw + 2.8)}
            y2={-len * 0.68}
            stroke={pal.dark}
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* 银色活塞内芯 */}
          <line
            x1={sideSign * (tw + 2.8)}
            y1={-len * 0.62}
            x2={sideSign * (tw + 2.2)}
            y2={-len + 10}
            stroke={POP_PALETTE.ink}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <line
            x1={sideSign * (tw + 2.8)}
            y1={-len * 0.62}
            x2={sideSign * (tw + 2.2)}
            y2={-len + 10}
            stroke={pal.edge}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        </g>
      )}

      {/* 外轮廓黑边 */}
      <path
        d={poly}
        fill={pal.mid}
        stroke={POP_PALETTE.ink}
        strokeWidth={4.4}
        strokeLinejoin="round"
      />
      {/* 暗面斜切半边（制造冷灰拉丝圆柱立体感） */}
      <path
        d={`M 0 0 L 0 ${-len} L ${sideSign * tw} ${-len} L ${sideSign * bw} 0 Z`}
        fill={pal.dark}
        opacity={0.55}
      />
      {/* 亮面拉丝细高光 */}
      <line
        x1={-sideSign * (bw * 0.42)}
        y1={-6}
        x2={-sideSign * (tw * 0.42)}
        y2={-len + 6}
        stroke={pal.edge}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* 主臂减重镂空导轨槽（仅 slot 样式） */}
      {styleType === "slot" && len > 52 && (
        <line
          x1={0}
          y1={-len * 0.24}
          x2={0}
          y2={-len * 0.76}
          stroke={POP_PALETTE.ink}
          strokeWidth={1.7}
          strokeLinecap="round"
          opacity={0.75}
        />
      )}
    </g>
  );
};

/** 精密机械关节轴承（双层金属环 + 内螺栓十字高光） */
const MechanicalJointSvg: React.FC<{
  radius: number;
  pal: MetalPalette;
}> = ({ radius, pal }) => (
  <g>
    <circle
      cx={0}
      cy={0}
      r={radius}
      fill={pal.dark}
      stroke={POP_PALETTE.ink}
      strokeWidth={2.4}
    />
    <circle
      cx={0}
      cy={0}
      r={radius * 0.64}
      fill={pal.mid}
      stroke={POP_PALETTE.ink}
      strokeWidth={1.2}
    />
    <circle cx={0} cy={0} r={radius * 0.3} fill={pal.edge} />
    <line
      x1={-radius * 0.42}
      y1={-radius * 0.42}
      x2={-radius * 0.16}
      y2={-radius * 0.16}
      stroke={pal.edge}
      strokeWidth={1.1}
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
    const showL003Text = sec >= 27.38 && sec <= L004_TOOLS_FOLD_SEC + 0.28;
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
    const kanjiSnap = sampleSnapOpen(sec, L003_TOKUI_MERGE_SEC);
    const arrowProg = interpolate(
      sec,
      [L003_ARROW_POINT_SEC, L003_ARROW_POINT_SEC + 0.18 / 0.75],
      [0, 1],
      {
        ...clamp,
        easing: Easing.out(Easing.back(1.4)),
      },
    );
    // 卡通字与弯箭头随工具一起延长展示，再同时收回。
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
          zIndex: 7,
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

            const floatY = interpolate(
              sec - b.spawnSec,
              [0, 0.067, 0.14, 0.25],
              [24, -9, 3, 0],
              clamp,
            );
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
                  transform: `translate(-50%, -50%) rotate(${(isLeft ? -1 : 1) * (isFocused ? 5 : 2)}deg) scale(${scale * (isFocused ? 1.04 : 0.94)}, ${scale})`,
                  opacity,
                  backgroundColor: POP_PALETTE.cream,
                  border: `4px solid ${POP_PALETTE.ink}`,
                  borderRadius: "22px 30px 20px 28px",
                  padding: b.hasPelicanBike ? "10px 14px" : "10px 16px",
                  boxShadow: `6px 7px 0 ${isFocused ? b.accent : POP_PALETTE.ink}`,
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
                    color: POP_PALETTE.ink,
                    fontSize: b.hasPelicanBike ? 14.5 : 15.5,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    letterSpacing: "-0.01em",
                    flex: 1,
                  }}
                >
                  {b.prompt}
                </span>
                {b.hasPelicanBike && (
                  <PelicanBicycleMiniSvg accent={b.accent} />
                )}
                <div
                  style={{
                    position: "absolute",
                    bottom: -9,
                    [isLeft ? "right" : "left"]: 22,
                    width: 12,
                    height: 12,
                    backgroundColor: POP_PALETTE.cream,
                    borderRight: `4px solid ${POP_PALETTE.ink}`,
                    borderBottom: `4px solid ${POP_PALETTE.ink}`,
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
              color: POP_PALETTE.yellow,
              WebkitTextStroke: `9px ${POP_PALETTE.ink}`,
              paintOrder: "stroke fill",
              filter: `drop-shadow(0 6px 0 ${POP_PALETTE.ink})`,
              lineHeight: 1,
            }}
          >
            ?
          </div>
        )}

        {/* 1C. L003 左上方沿拱形弧线贴出波普贴纸卡通字「と・く・い」→ 合成爆发「得意な」→ 变宽漫画笔触弧线箭头一直指着 Clawd */}
        {showL003Text && (
          <svg
            width={1280}
            height={720}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              overflow: "visible",
              opacity: 1 - l003TextOut,
            }}
          >
            <defs>
              <linearGradient
                id="tokui-kanji-fill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={POP_PALETTE.yellowLight} />
                <stop offset="52%" stopColor={POP_PALETTE.amber} />
                <stop offset="100%" stopColor={POP_PALETTE.orange} />
              </linearGradient>
              <linearGradient
                id="tokui-arrow-fill"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop offset="0%" stopColor={POP_PALETTE.yellowLight} />
                <stop offset="100%" stopColor={POP_PALETTE.yellowDeep} />
              </linearGradient>
            </defs>

            {(() => {
              const cxBase = 640 + clawdX + tokuiCenterX;
              const cyBase = tokuiCenterY;
              const mergeBurstAge = sec - L003_TOKUI_MERGE_SEC;
              const mergeBurstEnv =
                mergeBurstAge >= 0 && mergeBurstAge <= 0.34
                  ? Math.sin((mergeBurstAge / 0.34) * Math.PI)
                  : 0;
              const kanjiFloat =
                sec > L003_TOKUI_MERGE_SEC + 0.16
                  ? Math.sin((sec - L003_TOKUI_MERGE_SEC) * 3.8) * 2.5
                  : 0;

              return (
                <>
                  {/* 合并前的逐拍拱形卡通贴纸假名「と・く・い」（双层描边 + 弹出漫画放射小短线 + 弹性压扁） */}
                  {mergeProg < 0.98 &&
                    L003_TOKUI_CHARS.map((item, idx) => {
                      if (sec < item.spawnSec - 0.01) return null;
                      const dt = Math.max(0, sec - item.spawnSec);
                      const snap =
                        item.char === "な"
                          ? 1
                          : sampleSnapOpen(sec, item.spawnSec);
                      const squashX =
                        item.char === "な"
                          ? 1
                          : interpolate(
                              dt,
                              [0, 0.05, 0.11, 0.2],
                              [0.65, 1.18, 0.94, 1],
                              clamp,
                            );
                      const squashY =
                        item.char === "な"
                          ? 1
                          : interpolate(
                              dt,
                              [0, 0.05, 0.11, 0.2],
                              [1.28, 0.86, 1.05, 1],
                              clamp,
                            );
                      const curX = cxBase + item.offsetX * (1 - mergeProg * 0.92);
                      const curY = cyBase + item.offsetY * (1 - mergeProg * 0.92);
                      const wobble =
                        Math.sin(dt * 5.2 + idx * 1.4) * 2.2 * (1 - mergeProg);
                      const s = snap * (1 - mergeProg * 0.78);
                      const opacity = clamp01(snap * 2.5) * (1 - mergeProg);

                      // 弹出瞬间 4 根漫画“啪！”小放射线
                      const popTicksEnv =
                        item.char !== "な" && dt >= 0 && dt <= 0.19
                          ? Math.sin((dt / 0.19) * Math.PI)
                          : 0;

                      return (
                        <g
                          key={item.char}
                          transform={`translate(${curX}, ${curY}) rotate(${item.rotDeg + wobble}) scale(${s * squashX}, ${s * squashY})`}
                          opacity={opacity}
                        >
                          {popTicksEnv > 0.05 &&
                            [-135, -45, 45, 135].map((ang) => {
                              const rad = (ang * Math.PI) / 180;
                              const r0 = 32 + dt * 55;
                              const r1 = r0 + 13;
                              return (
                                <line
                                  key={ang}
                                  x1={Math.cos(rad) * r0}
                                  y1={Math.sin(rad) * r0}
                                  x2={Math.cos(rad) * r1}
                                  y2={Math.sin(rad) * r1}
                                  stroke={POP_PALETTE.cream}
                                  strokeWidth={3.6}
                                  strokeLinecap="round"
                                  opacity={popTicksEnv}
                                />
                              );
                            })}
                          {/* 硬偏移卡通阴影 */}
                          <text
                            x={4}
                            y={7}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontFamily={CARTOON_FONT}
                            fontSize={58}
                            fontWeight={900}
                            fill={POP_PALETTE.ink}
                            stroke={POP_PALETTE.ink}
                            strokeWidth={16}
                            strokeLinejoin="round"
                            paintOrder="stroke fill"
                          >
                            {item.char}
                          </text>
                          {/* 外深墨黑轮廓 */}
                          <text
                            x={0}
                            y={0}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontFamily={CARTOON_FONT}
                            fontSize={58}
                            fontWeight={900}
                            fill="none"
                            stroke={POP_PALETTE.ink}
                            strokeWidth={16}
                            strokeLinejoin="round"
                          >
                            {item.char}
                          </text>
                          {/* 内暖奶油贴纸描边 + 亮波普字面 */}
                          <text
                            x={0}
                            y={0}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontFamily={CARTOON_FONT}
                            fontSize={58}
                            fontWeight={900}
                            fill={item.color}
                            stroke={POP_PALETTE.cream}
                            strokeWidth={8.5}
                            strokeLinejoin="round"
                            paintOrder="stroke fill"
                          >
                            {item.char}
                          </text>
                        </g>
                      );
                    })}

                  {/* 合字瞬间的漫画冲击环 + 放射线 */}
                  {mergeBurstEnv > 0.02 && (
                    <g
                      transform={`translate(${cxBase}, ${cyBase})`}
                      opacity={mergeBurstEnv}
                    >
                      <circle
                        cx={0}
                        cy={0}
                        r={32 + mergeBurstAge * 210}
                        fill="none"
                        stroke={POP_PALETTE.cream}
                        strokeWidth={5 * (1 - mergeBurstAge / 0.34)}
                        strokeDasharray="16 12"
                      />
                      {Array.from({ length: 8 }, (_, i) => {
                        const rad = ((i * 45 + 15) * Math.PI) / 180;
                        const r0 = 46 + mergeBurstAge * 140;
                        const r1 = r0 + (i % 2 === 0 ? 24 : 15);
                        return (
                          <line
                            key={i}
                            x1={Math.cos(rad) * r0}
                            y1={Math.sin(rad) * r0}
                            x2={Math.cos(rad) * r1}
                            y2={Math.sin(rad) * r1}
                            stroke={i % 2 === 0 ? POP_PALETTE.yellow : POP_PALETTE.cream}
                            strokeWidth={4}
                            strokeLinecap="round"
                          />
                        );
                      })}
                    </g>
                  )}

                  {/* 合成为日系波普贴纸艺术字「得意な」（奶油白贴纸边 + 暖金橙渐变 + 错落排版 + 手绘星芒与下划线） */}
                  {sec >= L003_TOKUI_MERGE_SEC && (
                    <g
                      transform={`translate(${cxBase}, ${cyBase + kanjiFloat}) rotate(-8) scale(${kanjiSnap * (1 - l003TextOut * 0.85)})`}
                      opacity={clamp01(kanjiSnap * 2.2)}
                    >
                      {/* 手绘活力双底线强调 */}
                      <path
                        d="M -72 45 Q -4 38 64 46"
                        fill="none"
                        stroke={POP_PALETTE.ink}
                        strokeWidth={9}
                        strokeLinecap="round"
                      />
                      <path
                        d="M -72 45 Q -4 38 64 46"
                        fill="none"
                        stroke={POP_PALETTE.cream}
                        strokeWidth={4.2}
                        strokeLinecap="round"
                      />
                      <path
                        d="M -40 55 Q 2 51 44 55"
                        fill="none"
                        stroke={POP_PALETTE.pink}
                        strokeWidth={3.2}
                        strokeLinecap="round"
                      />

                      {/* 错落三字：得 / 意 / な */}
                      {[
                        { ch: "得", x: -58, y: 4, size: 62, rot: -6 },
                        { ch: "意", x: 3, y: -4, size: 68, rot: 3 },
                        { ch: "な", x: 60, y: 4, size: 52, rot: 12 },
                      ].map((g) => (
                        <g
                          key={g.ch}
                          transform={`translate(${g.x}, ${g.y}) rotate(${g.rot})`}
                        >
                          <text
                            x={4}
                            y={7}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontFamily={CARTOON_FONT}
                            fontSize={g.size}
                            fontWeight={900}
                            fill={POP_PALETTE.ink}
                            stroke={POP_PALETTE.ink}
                            strokeWidth={17}
                            strokeLinejoin="round"
                            paintOrder="stroke fill"
                          >
                            {g.ch}
                          </text>
                          <text
                            x={0}
                            y={0}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontFamily={CARTOON_FONT}
                            fontSize={g.size}
                            fontWeight={900}
                            fill="none"
                            stroke={POP_PALETTE.ink}
                            strokeWidth={17}
                            strokeLinejoin="round"
                          >
                            {g.ch}
                          </text>
                          <text
                            x={0}
                            y={0}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontFamily={CARTOON_FONT}
                            fontSize={g.size}
                            fontWeight={900}
                            fill="url(#tokui-kanji-fill)"
                            stroke={POP_PALETTE.cream}
                            strokeWidth={9}
                            strokeLinejoin="round"
                            paintOrder="stroke fill"
                          >
                            {g.ch}
                          </text>
                        </g>
                      ))}

                      {/* 呼吸闪烁的手绘四角星芒 */}
                      <ComicSparkleSvg
                        x={-98}
                        y={-28}
                        size={
                          14 + Math.sin(sec * 7.5) * 2.5
                        }
                        fill={POP_PALETTE.yellow}
                        rotation={-12}
                      />
                      <ComicSparkleSvg
                        x={96}
                        y={-24}
                        size={
                          11 + Math.cos(sec * 6.8) * 2.2
                        }
                        fill={POP_PALETTE.pink}
                        rotation={16}
                      />
                      <ComicSparkleSvg
                        x={-84}
                        y={28}
                        size={7.5}
                        fill={POP_PALETTE.mint}
                        rotation={8}
                      />
                    </g>
                  )}

                  {/* 变宽漫画笔触弧线箭头：起点纤细、中段饱满、箭头俏皮微弯，指中瞬间弹出“叮！”小冲击线 */}
                  {arrowProg > 0.01 &&
                    (() => {
                      const poke =
                        sec > L003_ARROW_POINT_SEC + 0.22
                          ? Math.sin((sec - L003_ARROW_POINT_SEC) * 8.5) * 4.5
                          : 0;
                      const sx = cxBase + 56;
                      const sy = cyBase + 44;
                      const ex = 640 + clawdX - 116 + poke * 0.72;
                      const ey = 372 + poke * 0.52;
                      const ctrlX = (sx + ex) * 0.5 - 38;
                      const ctrlY = (sy + ey) * 0.5 + 48;

                      const tMax = clamp01(arrowProg);
                      const steps = 16;
                      const leftPts: string[] = [];
                      const rightPts: string[] = [];
                      const centerPts: Array<{ x: number; y: number }> = [];

                      for (let i = 0; i <= steps; i++) {
                        const t = (i / steps) * tMax;
                        const x =
                          (1 - t) * (1 - t) * sx +
                          2 * (1 - t) * t * ctrlX +
                          t * t * ex;
                        const y =
                          (1 - t) * (1 - t) * sy +
                          2 * (1 - t) * t * ctrlY +
                          t * t * ey;
                        const tx =
                          2 * (1 - t) * (ctrlX - sx) + 2 * t * (ex - ctrlX);
                        const ty =
                          2 * (1 - t) * (ctrlY - sy) + 2 * t * (ey - ctrlY);
                        const len = Math.hypot(tx, ty) || 1;
                        const nx = -ty / len;
                        const ny = tx / len;
                        // 尾细头粗的漫画笔触宽度分布
                        const halfW = 2.6 + (i / steps) * 4.4;
                        leftPts.push(
                          `${(x + nx * halfW).toFixed(1)} ${(y + ny * halfW).toFixed(1)}`,
                        );
                        rightPts.unshift(
                          `${(x - nx * halfW).toFixed(1)} ${(y - ny * halfW).toFixed(1)}`,
                        );
                        centerPts.push({ x, y });
                      }

                      const ribbonPath = `M ${leftPts[0]} L ${leftPts.slice(1).join(" L ")} L ${rightPts.join(" L ")} Z`;
                      const tipPt = centerPts[centerPts.length - 1];
                      const tanX =
                        2 * (1 - tMax) * (ctrlX - sx) +
                        2 * tMax * (ex - ctrlX);
                      const tanY =
                        2 * (1 - tMax) * (ctrlY - sy) +
                        2 * tMax * (ey - ctrlY);
                      const angleDeg = (Math.atan2(tanY, tanX) * 180) / Math.PI;

                      // 指中瞬间的漫画“叮！”小冲击线
                      const hitAge = sec - (L003_ARROW_POINT_SEC + 0.16);
                      const hitEnv =
                        hitAge >= 0 && hitAge <= 0.24
                          ? Math.sin((hitAge / 0.24) * Math.PI)
                          : 0;

                      return (
                        <g
                          style={{
                            filter: `drop-shadow(0 5px 0 ${POP_PALETTE.ink})`,
                          }}
                        >
                          {/* 变宽弧线箭身（深墨黑粗轮廓 + 奶油/明黄饱满笔触） */}
                          <path
                            d={ribbonPath}
                            fill="url(#tokui-arrow-fill)"
                            stroke={POP_PALETTE.ink}
                            strokeWidth={4.5}
                            strokeLinejoin="round"
                          />
                          {/* 箭身内侧高光细线 */}
                          <path
                            d={`M ${centerPts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")}`}
                            fill="none"
                            stroke={POP_PALETTE.creamLight}
                            strokeWidth={2}
                            strokeLinecap="round"
                            opacity={0.75}
                          />
                          {/* 饱满俏皮的漫画大箭头 */}
                          {arrowProg > 0.32 && (
                            <g
                              transform={`translate(${tipPt.x}, ${tipPt.y}) rotate(${angleDeg}) scale(${clamp01((arrowProg - 0.32) * 1.7)})`}
                            >
                              <path
                                d="M 12 0 C -2 -10 -16 -20 -28 -22 C -22 -8 -22 8 -28 22 C -16 20 -2 10 12 0 Z"
                                fill="url(#tokui-arrow-fill)"
                                stroke={POP_PALETTE.ink}
                                strokeWidth={4.5}
                                strokeLinejoin="round"
                              />
                              <path
                                d="M 4 0 C -5 -6 -13 -11 -20 -13"
                                fill="none"
                                stroke={POP_PALETTE.creamLight}
                                strokeWidth={2.4}
                                strokeLinecap="round"
                                opacity={0.85}
                              />
                            </g>
                          )}
                          {/* 指中瞬间的 3 根干脆漫画小短线 */}
                          {hitEnv > 0.04 && (
                            <g
                              transform={`translate(${tipPt.x + 12}, ${tipPt.y + 4})`}
                              opacity={hitEnv}
                            >
                              {[-36, 4, 42].map((a) => {
                                const rad = (a * Math.PI) / 180;
                                const r0 = 10 + hitAge * 45;
                                const r1 = r0 + 16;
                                return (
                                  <line
                                    key={a}
                                    x1={Math.cos(rad) * r0}
                                    y1={Math.sin(rad) * r0}
                                    x2={Math.cos(rad) * r1}
                                    y2={Math.sin(rad) * r1}
                                    stroke={POP_PALETTE.cream}
                                    strokeWidth={4}
                                    strokeLinecap="round"
                                  />
                                );
                              })}
                            </g>
                          )}
                        </g>
                      );
                    })()}
                </>
              );
            })()}
          </svg>
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. BEHIND 层：箭头指中 Clawd 后（30.93s），瞬间展开 6 支带工业机械质感与景深分层的精密冷灰工具臂
  // =========================================================================
  if (sec < L003_TOOLS_BURST_SEC - 0.02 || sec > L004_TOOLS_FOLD_SEC + 0.43) return null;

  const pivotX = 640 + clawdX;
  const pivotY = 432;

  const foldOut = sampleSnapFold(sec, L004_TOOLS_FOLD_SEC);
  // 32.61s 亮招高潮拍：机械臂随 Clawd ^ ^ 笑眼同步二次昂扬外扩亮相
  const appealOpen = sampleSnapOpen(sec, L004_SHOWCASE_BEAT_SEC) * clamp01(foldOut);
  // 32.61s 亮招高潮瞬间的得意星芒爆发
  const showcaseSparkAge = sec - L004_SHOWCASE_BEAT_SEC;
  const showcaseSparkEnv =
    showcaseSparkAge >= 0 && showcaseSparkAge <= 0.42
      ? Math.sin((showcaseSparkAge / 0.42) * Math.PI)
      : 0;
  const burstAge = sec - L003_TOOLS_BURST_SEC;
  const burst = interpolate(
    burstAge,
    [0, 0.034, 0.11, 0.28],
    [0, 1, 0.85, 0],
    clamp,
  );
  const ringAge = clamp01(burstAge / 0.24);
  const ringOpacity =
    burstAge >= 0 && burstAge <= 0.24 ? Math.sin(ringAge * Math.PI) * 0.72 : 0;

  // 非均匀角度与长短的漫画冲击爆发线
  const impactRays = [
    { deg: -158, len: 46, w: 6, color: POP_PALETTE.cream },
    { deg: -130, len: 28, w: 3.8, color: "#CBD5E1" },
    { deg: -102, len: 54, w: 7, color: POP_PALETTE.yellow },
    { deg: -72, len: 34, w: 4.5, color: POP_PALETTE.cream },
    { deg: -44, len: 58, w: 7.5, color: POP_PALETTE.yellow },
    { deg: -16, len: 36, w: 4, color: "#E2E8F0" },
    { deg: 12, len: 50, w: 6.5, color: POP_PALETTE.cream },
    { deg: 36, len: 30, w: 4, color: "#CBD5E1" },
    { deg: -182, len: 32, w: 4.5, color: "#E2E8F0" },
  ];

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
      {/* 背后机械展开瞬间的短促冷白上半弧冲击波（不越过台面底边） */}
      {ringOpacity > 0.02 &&
        (() => {
          const rx = 96 + ringAge * 175;
          const ry = 76 + ringAge * 128;
          const cy = pivotY + 18;
          return (
            <path
              d={`M ${pivotX - rx} ${cy} A ${rx} ${ry} 0 0 1 ${pivotX + rx} ${cy}`}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth={5.5 * (1 - ringAge)}
              strokeDasharray="28 18"
              strokeLinecap="round"
              opacity={ringOpacity}
            />
          );
        })()}

      {/* 错落长短的漫画爆发线（短促干脆，随后留白） */}
      {burst > 0.01 &&
        impactRays.map((ray, i) => {
          const rad = (ray.deg * Math.PI) / 180;
          const radius = 114 + Math.max(0, burstAge) * 210;
          const x = pivotX + Math.cos(rad) * radius;
          const y = pivotY + Math.sin(rad) * radius * 0.78;
          return (
            <path
              key={`impact-${i}`}
              d={`M ${x} ${y} l ${Math.cos(rad) * ray.len} ${Math.sin(rad) * ray.len * 0.8}`}
              stroke={ray.color}
              strokeWidth={ray.w}
              strokeLinecap="round"
              opacity={burst}
            />
          );
        })}

      {/* 6 支精密冷灰机械折臂（按 deep → mid → bright 景深顺序绘制） */}
      {L003_SWISS_TOOLS.map((tool) => {
        const triggerSec = L003_TOOLS_BURST_SEC + tool.staggerSec;
        if (sec < triggerSec - 0.01) return null;

        const shoulderOpen = sampleSnapOpen(sec, triggerSec);
        const elbowOpen = sampleSnapOpen(sec, triggerSec + 0.024);
        const wristOpen = sampleSnapOpen(sec, triggerSec + 0.046);

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

        // 展开锁死后极克制的机械待命呼吸微动（活而不乱）
        const settled =
          clamp01((sec - (triggerSec + 0.16)) / 0.2) * clamp01(foldOut);
        const idleBreath =
          Math.sin(sec * 3.4 + tool.idlePhase) * 1.45 * settled;
        const idleWrist =
          Math.cos(sec * 4.1 + tool.idlePhase) * 2.2 * settled;

        const deg1 =
          tool.foldedDeg1 +
          (tool.targetDeg1 - tool.foldedDeg1) * r1 +
          sideSign * 5.2 * appealOpen +
          idleBreath;

        const deg2 =
          tool.foldedDeg2 +
          (tool.targetDeg2 - tool.foldedDeg2) * r2 -
          sideSign * 7.2 * appealOpen -
          idleBreath * 1.25;

        const hasSeg3 = (tool.len3 ?? 0) > 0;
        const deg3 = hasSeg3
          ? (tool.foldedDeg3 ?? 0) +
            ((tool.targetDeg3 ?? 0) - (tool.foldedDeg3 ?? 0)) * r3 +
            sideSign * 5.2 * appealOpen +
            idleWrist * 0.8
          : 0;

        const headDeg =
          tool.foldedHeadDeg +
          (tool.targetHeadDeg - tool.foldedHeadDeg) * r3 +
          sideSign * 4.0 * appealOpen +
          idleWrist;

        const curLen1 = tool.len1 * clamp01(0.42 + 0.58 * r1);
        const curLen2 =
          (tool.len2 + (hasSeg3 ? 6 : 13) * appealOpen) *
          clamp01(0.36 + 0.64 * r2);
        const curLen3 = hasSeg3
          ? ((tool.len3 ?? 0) + 9 * appealOpen) * clamp01(0.36 + 0.64 * r3)
          : 0;

        const lockFlash =
          sec >= triggerSec + 0.08 && sec <= triggerSec + 0.2
            ? Math.sin(((sec - (triggerSec + 0.08)) / 0.12) * Math.PI)
            : 0;
        const jointSpark =
          sec >= triggerSec + 0.09 && sec <= triggerSec + 0.24
            ? Math.sin(((sec - (triggerSec + 0.09)) / 0.15) * Math.PI)
            : 0;

        const pal = getMetalPalette(tool.tone, lockFlash);
        const sx = pivotX + tool.mountX * clamp01(r1);
        const sy = pivotY + tool.mountY * clamp01(r1);

        return (
          <g
            key={tool.id}
            transform={`translate(${sx}, ${sy})`}
            opacity={armOpacity}
          >
            {/* 肩部金属基座 */}
            <MechanicalJointSvg radius={6.5} pal={pal} />

            {/* 第 1 段精密微锥度金属主臂（带导轨槽或平行小拉杆） */}
            <g transform={`rotate(${deg1})`}>
              <ArticulatedMetalRodSvg
                len={curLen1}
                baseWidth={9.2}
                tipWidth={6.6}
                pal={pal}
                sideSign={sideSign}
                styleType={tool.rodStyle}
              />

              {/* 第 1 偏折肘关节 */}
              <g transform={`translate(0, ${-curLen1})`}>
                <g transform={`rotate(${deg2})`}>
                  <ArticulatedMetalRodSvg
                    len={curLen2}
                    baseWidth={6.8}
                    tipWidth={4.8}
                    pal={pal}
                    sideSign={sideSign}
                    styleType="plain"
                  />

                  {/* 若有第 3 段腕臂则再经过一次偏折关节，否则直接挂载末端工具头 */}
                  {hasSeg3 ? (
                    <g transform={`translate(0, ${-curLen2})`}>
                      <g transform={`rotate(${deg3})`}>
                        <ArticulatedMetalRodSvg
                          len={curLen3}
                          baseWidth={5.2}
                          tipWidth={4.0}
                          pal={pal}
                          sideSign={sideSign}
                          styleType="plain"
                        />
                        <g
                          transform={`translate(0, ${-curLen3}) rotate(${headDeg})`}
                        >
                          <SlimMetalToolHeadSvg
                            id={tool.id}
                            tone={tool.tone}
                            openProgress={r3}
                            flash={lockFlash}
                            sec={sec}
                            triggerSec={triggerSec}
                          />
                        </g>
                      </g>
                      <MechanicalJointSvg radius={6} pal={pal} />
                    </g>
                  ) : (
                    <g
                      transform={`translate(0, ${-curLen2}) rotate(${headDeg})`}
                    >
                      <SlimMetalToolHeadSvg
                        id={tool.id}
                        tone={tool.tone}
                        openProgress={r2}
                        flash={lockFlash}
                        sec={sec}
                        triggerSec={triggerSec}
                      />
                    </g>
                  )}
                </g>

                {/* 第一偏折肘部双层金属轴承 + 锁死瞬间小火花 */}
                <MechanicalJointSvg radius={7.4} pal={pal} />
                {jointSpark > 0.15 && (
                  <ComicSparkleSvg
                    x={sideSign * 7}
                    y={-7}
                    size={9 * jointSpark}
                    fill="#FFFFFF"
                    stroke={POP_PALETTE.ink}
                    rotation={24}
                    opacity={jointSpark}
                  />
                )}
              </g>
            </g>
          </g>
        );
      })}
      {/* 32.05s 亮招拍：Clawd 切 ^ ^ 笑眼瞬间在肩侧弹出的得意金白星芒 */}
      {showcaseSparkEnv > 0.04 && (
        <g opacity={showcaseSparkEnv}>
          <ComicSparkleSvg
            x={pivotX - 148 - showcaseSparkAge * 26}
            y={pivotY - 122 - showcaseSparkAge * 22}
            size={15 * showcaseSparkEnv}
            fill={POP_PALETTE.yellow}
            rotation={-15}
          />
          <ComicSparkleSvg
            x={pivotX + 166 + showcaseSparkAge * 28}
            y={pivotY - 134 - showcaseSparkAge * 20}
            size={17 * showcaseSparkEnv}
            fill={POP_PALETTE.cream}
            rotation={18}
          />
          <ComicSparkleSvg
            x={pivotX + 194 + showcaseSparkAge * 22}
            y={pivotY - 24}
            size={11 * showcaseSparkEnv}
            fill={POP_PALETTE.yellow}
            rotation={-8}
          />
        </g>
      )}
    </svg>
  );
};
