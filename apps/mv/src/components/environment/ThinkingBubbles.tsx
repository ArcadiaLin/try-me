import React from "react";
import { interpolate } from "remotion";
import { clamp01, smoothStep } from "../../animation/clawd/motion-style";
import { CLAWD_TERRACOTTA, POP_PALETTE } from "../../styles/palette";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const MONO_FONT =
  '"JetBrains Mono", "Cascadia Mono", "Fira Code", Consolas, monospace';

/** Claude Code 终端状态行风格的字符轮转序列 */
const SPINNER_FRAMES = ["✻", "✽", "✶", "✳", "✢", "·"] as const;

export interface ThinkingVerbSpec {
  id: string;
  label: string;
  spawnSec: number;
  /** 从背景外围浮现的起点 X（相对画面中线 640px） */
  startX: number;
  /** 从背景外围浮现的起点 Y（距离顶部 px） */
  startY: number;
  /** 缓慢向中央 Clawd 逼近的目标 X（相对画面中线 640px，保持不遮挡角色主体） */
  endX: number;
  /** 缓慢向中央 Clawd 逼近的目标 Y（距离顶部 px） */
  endY: number;
  /** 前景清晰可读 vs 外围稍暗稍小层次 */
  tier: "foreground" | "outer";
  /** 轻柔有机漂浮参数（与向心移动叠加） */
  floatAmpX: number;
  floatAmpY: number;
  floatFreq: number;
  floatPhase: number;
  /** L014 清场错峰顺序 (0..1) */
  clearOrder: number;
}

/**
 * L013–L014 Claude Code 终端风格陶土棕 Spinner Verbs（无气泡框、无图形、无边框）：
 * 从舞台外围背景渐变浮现，持续缓慢向中央 Clawd 聚拢逼近，制造“越想越乱”的包围感。
 */
export const THINKING_BUBBLES: readonly ThinkingVerbSpec[] = [
  {
    id: "thinking",
    label: "Thinking…",
    spawnSec: 55.2,
    startX: 350,
    startY: 195,
    endX: 215,
    endY: 268,
    tier: "foreground",
    floatAmpX: 5,
    floatAmpY: 6,
    floatFreq: 1.4,
    floatPhase: 0.2,
    clearOrder: 0.9,
  },
  {
    id: "cooking",
    label: "Cooking…",
    spawnSec: 55.68,
    startX: -370,
    startY: 210,
    endX: -225,
    endY: 282,
    tier: "foreground",
    floatAmpX: 6,
    floatAmpY: 5,
    floatFreq: 1.55,
    floatPhase: 1.4,
    clearOrder: 0.6,
  },
  {
    id: "brewing",
    label: "Brewing…",
    spawnSec: 56.14,
    startX: -485,
    startY: 365,
    endX: -315,
    endY: 382,
    tier: "outer",
    floatAmpX: 4,
    floatAmpY: 5,
    floatFreq: 1.3,
    floatPhase: 2.5,
    clearOrder: 0.2,
  },
  {
    id: "pondering",
    label: "Pondering…",
    spawnSec: 56.56,
    startX: 460,
    startY: 360,
    endX: 275,
    endY: 378,
    tier: "foreground",
    floatAmpX: 5,
    floatAmpY: 6,
    floatFreq: 1.45,
    floatPhase: 3.3,
    clearOrder: 0.72,
  },
  {
    id: "cogitating",
    label: "Cogitating…",
    spawnSec: 56.96,
    startX: -420,
    startY: 468,
    endX: -250,
    endY: 452,
    tier: "foreground",
    floatAmpX: 6,
    floatAmpY: 4,
    floatFreq: 1.6,
    floatPhase: 4.1,
    clearOrder: 0.35,
  },
  {
    id: "baking",
    label: "Baking…",
    spawnSec: 57.32,
    startX: 500,
    startY: 118,
    endX: 335,
    endY: 185,
    tier: "outer",
    floatAmpX: 5,
    floatAmpY: 5,
    floatFreq: 1.7,
    floatPhase: 0.9,
    clearOrder: 0.1,
  },
  {
    id: "ruminating",
    label: "Ruminating…",
    spawnSec: 57.68,
    startX: 495,
    startY: 476,
    endX: 305,
    endY: 458,
    tier: "outer",
    floatAmpX: 4,
    floatAmpY: 5,
    floatFreq: 1.25,
    floatPhase: 2.1,
    clearOrder: 0.45,
  },
  {
    id: "mulling",
    label: "Mulling…",
    spawnSec: 58.06,
    startX: -505,
    startY: 122,
    endX: -345,
    endY: 192,
    tier: "outer",
    floatAmpX: 5,
    floatAmpY: 4,
    floatFreq: 1.5,
    floatPhase: 5.0,
    clearOrder: 0.0,
  },
  {
    id: "synthesizing",
    label: "Synthesizing…",
    spawnSec: 58.44,
    startX: -285,
    startY: 78,
    endX: -215,
    endY: 148,
    tier: "outer",
    floatAmpX: 4,
    floatAmpY: 5,
    floatFreq: 1.35,
    floatPhase: 1.8,
    clearOrder: 0.52,
  },
  {
    id: "moonwalking",
    label: "Moonwalking…",
    spawnSec: 58.82,
    startX: 295,
    startY: 80,
    endX: 225,
    endY: 150,
    tier: "outer",
    floatAmpX: 5,
    floatAmpY: 5,
    floatFreq: 1.55,
    floatPhase: 3.9,
    clearOrder: 0.28,
  },
  {
    id: "discombobulating",
    label: "Discombobulating…",
    spawnSec: 59.18,
    startX: 0,
    startY: 175,
    endX: 0,
    endY: 235,
    tier: "foreground",
    floatAmpX: 5,
    floatAmpY: 5,
    floatFreq: 1.65,
    floatPhase: 0.6,
    clearOrder: 1.0,
  },
] as const;

export interface ThinkingBubblesProps {
  sec: number;
  freezeSec: number;
  deflateStartSec: number;
  deflateEndSec: number;
  dabHitSec: number;
}

/**
 * L013–L014 舞台背景浮现的 Claude Code 陶土棕 Spinner Verbs + L014 Superstar Dab 瞬时漫画爆点：
 * - 无气泡框、无图形、无边框：纯终端等宽字符 + 轮转符号，使用 Claude Code 陶土棕色；
 * - 以柔和渐变从背景外围浮现，持续缓慢向中央 Clawd 移动逼近；
 * - freezeSec 瞬间停转停移，随后错峰收缩淡出清场，让位于 Dab；
 * - dabHitSec 瞬时爆出约 0.24s 紧贴右爪尖的漫画放射线与四角星芒，随即留白。
 */
/**
 * 单朵卡通烟雾爆散（Poof）SVG：
 * 遵循 D031/D032 波普漫画风格——暖奶油云团 + 茄紫深墨粗圆角轮廓，
 * 在词汇消失的瞬间从中心快速膨胀、分裂出外围小烟球与极短爆裂线后干净消散。
 */
const ComicPoofCloud: React.FC<{
  cx: number;
  cy: number;
  progress: number;
  scale: number;
  seed: number;
  isFg: boolean;
}> = ({ cx, cy, progress, scale, seed, isFg }) => {
  const t = clamp01(progress);
  if (t <= 0 || t >= 1) return null;

  // 主云团迅速膨大后收缩消散
  const coreScale = interpolate(t, [0, 0.22, 0.65, 1], [0.25, 1.15, 0.92, 0.2], CLAMP) * scale;
  const puffSpread = interpolate(t, [0, 0.35, 1], [0.15, 1.0, 1.55], CLAMP) * scale;
  const opacity = interpolate(t, [0, 0.12, 0.62, 1], [0, 1, 0.92, 0], CLAMP);

  // 6 瓣云朵环绕中心向外扩散，配合 4 颗外围小烟球
  const lobes = [
    { angle: 0 + seed * 19, dist: 16, r: 15 },
    { angle: 62 + seed * 19, dist: 18, r: 13 },
    { angle: 124 + seed * 19, dist: 15, r: 14 },
    { angle: 185 + seed * 19, dist: 19, r: 15 },
    { angle: 245 + seed * 19, dist: 16, r: 12.5 },
    { angle: 304 + seed * 19, dist: 17, r: 13.5 },
  ];
  const outerPuffs = [
    { angle: 28 + seed * 31, dist: 38, r: 7.5 },
    { angle: 138 + seed * 31, dist: 42, r: 6.5 },
    { angle: 222 + seed * 31, dist: 36, r: 7 },
    { angle: 318 + seed * 31, dist: 40, r: 6 },
  ];
  const fillCol = isFg ? POP_PALETTE.cream : POP_PALETTE.creamLight;
  const inkStroke = isFg ? 5.2 : 4.2;

  return (
    <g transform={`translate(${cx}, ${cy})`} opacity={opacity}>
      {/* 第 1 层：深墨外轮廓（云瓣融合在一起形成完整漫画云团轮廓） */}
      <g fill={POP_PALETTE.ink} stroke={POP_PALETTE.ink} strokeWidth={inkStroke}>
        <circle cx={0} cy={0} r={14 * coreScale} />
        {lobes.map((l, i) => {
          const rad = (l.angle * Math.PI) / 180;
          return (
            <circle
              key={`o-${i}`}
              cx={Math.cos(rad) * l.dist * puffSpread}
              cy={Math.sin(rad) * l.dist * puffSpread * 0.72}
              r={l.r * coreScale}
            />
          );
        })}
      </g>

      {/* 第 2 层：暖奶油内部云团填充 */}
      <g fill={fillCol}>
        <circle cx={0} cy={0} r={14 * coreScale} />
        {lobes.map((l, i) => {
          const rad = (l.angle * Math.PI) / 180;
          return (
            <circle
              key={`f-${i}`}
              cx={Math.cos(rad) * l.dist * puffSpread}
              cy={Math.sin(rad) * l.dist * puffSpread * 0.72}
              r={l.r * coreScale}
            />
          );
        })}
      </g>

      {/* 外围飞散小烟球 */}
      {outerPuffs.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const r = p.r * interpolate(t, [0, 0.3, 1], [0.3, 1.0, 0.15], CLAMP) * scale;
        return (
          <circle
            key={`s-${i}`}
            cx={Math.cos(rad) * p.dist * puffSpread}
            cy={Math.sin(rad) * p.dist * puffSpread * 0.78}
            r={r}
            fill={fillCol}
            stroke={POP_PALETTE.ink}
            strokeWidth={2.6}
          />
        );
      })}
    </g>
  );
};

export const ThinkingBubbles: React.FC<ThinkingBubblesProps> = ({
  sec,
  dabHitSec,
}) => {
  const poofDur = 0.3;
  const dabBurstDur = 0.24;
  const showVerbs = sec >= 55.15 && sec < dabHitSec;
  const showPoofs = sec >= dabHitSec && sec <= dabHitSec + poofDur;
  const showDabBurst = sec >= dabHitSec && sec <= dabHitSec + dabBurstDur;

  if (!showVerbs && !showPoofs && !showDabBurst) return null;

  // 预计算每个词在当前时刻（或 dabHitSec 消失瞬间）的坐标，保证烟雾严格在词汇消失的原地爆开
  const sampleVerbPos = (b: ThinkingVerbSpec, tSec: number) => {
    const aliveDur = Math.max(0, tSec - b.spawnSec);
    const driftTotalSpan = Math.max(1.2, dabHitSec - b.spawnSec);
    const approachT = clamp01(aliveDur / driftTotalSpan);
    const approachEase = 1 - (1 - approachT) ** 1.35;
    const baseX = b.startX + (b.endX - b.startX) * approachEase;
    const baseY = b.startY + (b.endY - b.startY) * approachEase;
    const floatRamp = smoothStep(aliveDur, 0.15, 0.7);
    const dx =
      Math.sin(aliveDur * b.floatFreq + b.floatPhase) * b.floatAmpX * floatRamp;
    const dy =
      Math.cos(aliveDur * b.floatFreq * 1.15 + b.floatPhase * 1.3) *
      b.floatAmpY *
      floatRamp;
    return { x: 640 + baseX + dx, y: baseY + dy, aliveDur };
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 8,
        pointerEvents: "none",
      }}
    >
      {/* 1. L013–L014 无框陶土棕 Spinner Verbs（严格在 dabHitSec 瞬间一起消失） */}
      {showVerbs &&
        THINKING_BUBBLES.map((b, idx) => {
          if (sec < b.spawnSec) return null;

          const { x, y, aliveDur } = sampleVerbPos(b, sec);
          const fadeIn = smoothStep(aliveDur, 0, 0.55);

          const isFg = b.tier === "foreground";
          const spinnerIdx =
            Math.floor(sec / 0.11 + idx * 2) % SPINNER_FRAMES.length;
          const spinnerChar = SPINNER_FRAMES[spinnerIdx];

          const textColor = isFg ? CLAWD_TERRACOTTA : "#B9674B";
          const baseOpacity = isFg ? 0.94 : 0.68;

          return (
            <div
              key={b.id}
              style={{
                position: "absolute",
                left: x,
                top: y,
                transform: `translate(-50%, -50%) scale(${0.92 + 0.08 * fadeIn})`,
                opacity: fadeIn * baseOpacity,
                zIndex: isFg ? 3 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: isFg ? 8 : 6,
                fontFamily: MONO_FONT,
                fontSize: isFg ? 24 : 18,
                fontWeight: isFg ? 700 : 600,
                letterSpacing: 0.3,
                color: textColor,
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  minWidth: isFg ? 17 : 13,
                  textAlign: "center",
                  lineHeight: 1,
                }}
              >
                {spinnerChar}
              </span>
              <span>{b.label}</span>
            </div>
          );
        })}

      {/* 2. 1:01:01 卡点瞬间：每个词汇消失的原地同步爆出卡通烟雾爆散特效 */}
      {showPoofs && (
        <svg
          width={1280}
          height={720}
          viewBox="0 0 1280 720"
          style={{
            position: "absolute",
            inset: 0,
            overflow: "visible",
          }}
        >
          {THINKING_BUBBLES.map((b, idx) => {
            const { x, y } = sampleVerbPos(b, dabHitSec);
            const isFg = b.tier === "foreground";
            const poofT = clamp01((sec - dabHitSec) / poofDur);
            return (
              <ComicPoofCloud
                key={`poof-${b.id}`}
                cx={x}
                cy={y}
                progress={poofT}
                scale={isFg ? 1.05 : 0.78}
                seed={idx + 1}
                isFg={isFg}
              />
            );
          })}
        </svg>
      )}

      {/* 2. L014 Superstar Dab 命中瞬间的极短促漫画放射线与手绘四角星芒 (0.24s 后即刻留白) */}
      {showDabBurst && (() => {
        const bt = clamp01((sec - dabHitSec) / dabBurstDur);
        const burstOpacity = interpolate(bt, [0, 0.14, 0.65, 1], [0, 1, 1, 0], CLAMP);
        const rayExtend = interpolate(bt, [0, 0.38, 1], [0.2, 1.05, 1.25], CLAMP);
        const starScale = interpolate(bt, [0, 0.25, 0.72, 1], [0.2, 1.18, 1.0, 0.45], CLAMP);
        // 紧贴缩短后的 Dab 伸直右爪尖方向 (640 + 96, 392) 爆出短促放射线
        const cx = 640 + 96;
        const cy = 392;
        const rays = [-82, -62, -42, -22, -2];

        return (
          <svg
            width={1280}
            height={720}
            viewBox="0 0 1280 720"
            style={{
              position: "absolute",
              inset: 0,
              opacity: burstOpacity,
              overflow: "visible",
            }}
          >
            {rays.map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const r0 = 30 + rayExtend * 16;
              const r1 = r0 + (i % 2 === 0 ? 48 : 34) * rayExtend;
              const x1 = cx + Math.cos(rad) * r0;
              const y1 = cy + Math.sin(rad) * r0;
              const x2 = cx + Math.cos(rad) * r1;
              const y2 = cy + Math.sin(rad) * r1;
              return (
                <g key={deg}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={POP_PALETTE.ink}
                    strokeWidth={10}
                    strokeLinecap="round"
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={i % 2 === 0 ? POP_PALETTE.yellow : POP_PALETTE.cream}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {[
              { x: cx + 34, y: cy - 80, s: 22, fill: POP_PALETTE.yellow },
              { x: cx + 90, y: cy - 14, s: 16, fill: POP_PALETTE.cream },
              { x: 640 - 122, y: 356, s: 18, fill: POP_PALETTE.pink },
            ].map((st, idx) => (
              <g
                key={idx}
                transform={`translate(${st.x}, ${st.y}) scale(${starScale})`}
              >
                <path
                  d={`M 0 ${-st.s} Q ${st.s * 0.2} ${-st.s * 0.2} ${st.s} 0 Q ${
                    st.s * 0.2
                  } ${st.s * 0.2} 0 ${st.s} Q ${-st.s * 0.2} ${st.s * 0.2} ${
                    -st.s
                  } 0 Q ${-st.s * 0.2} ${-st.s * 0.2} 0 ${-st.s} Z`}
                  fill={st.fill}
                  stroke={POP_PALETTE.ink}
                  strokeWidth={3.5}
                  strokeLinejoin="round"
                />
              </g>
            ))}
          </svg>
        );
      })()}
    </div>
  );
};
