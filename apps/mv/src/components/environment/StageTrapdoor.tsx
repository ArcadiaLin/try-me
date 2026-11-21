import React from "react";
import { random } from "remotion";

export interface StageTrapdoorProps {
  /** 洞口中心相对画面中线的水平偏移（px） */
  x: number;
  /** 开合 (0 = 关闭, 1 = 全开) */
  open: number;
  /** 角色掉进去之后经过的秒数；<0 表示还没掉进去（用于像素溅起与入口闪光） */
  sinceEnter?: number;
  /** 洞口宽度（px） */
  width?: number;
  /** 舞台台面上沿（px，自画面顶部） */
  deckTop?: number;
}

const DECK_H = 12;
const DECK_COLOR = "#23263A";
const ACCENT = "#D87757";

/**
 * 舞台台面上的小洞（终端入口）：台面两块滑门向两侧拉开，露出深色入口与一条橙色光标线；
 * 角色掉进去的瞬间入口闪亮并溅起少量像素块。纯 props 驱动。
 */
export const StageTrapdoor: React.FC<StageTrapdoorProps> = ({
  x,
  open,
  sinceEnter = -1,
  width = 180,
  deckTop = 525,
}) => {
  const o = Math.max(0, Math.min(1, open));
  if (o <= 0.001 && (sinceEnter < 0 || sinceEnter > 0.5)) return null;
  const cx = 640 + x;
  const half = width / 2;
  const gapHalf = half * o;
  const flash = sinceEnter >= 0 && sinceEnter < 0.3 ? 1 - sinceEnter / 0.3 : 0;

  return (
    <svg
      width={1280}
      height={720}
      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
    >
      <defs>
        <linearGradient id="trapdoor-shaft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#030308" stopOpacity={1} />
          <stop offset="100%" stopColor="#030308" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* 入口：深色缝隙 + 向下渐隐的井道 */}
      {o > 0.001 && (
        <>
          <rect x={cx - gapHalf} y={deckTop} width={gapHalf * 2} height={DECK_H} fill="#030308" />
          <rect x={cx - gapHalf} y={deckTop + DECK_H} width={gapHalf * 2} height={28} fill="url(#trapdoor-shaft)" />
          {/* 井道两侧橙边，交代这是一个往下的入口 */}
          <rect x={cx - gapHalf} y={deckTop} width={2} height={DECK_H + 14} fill={ACCENT} opacity={0.7} />
          <rect x={cx + gapHalf - 2} y={deckTop} width={2} height={DECK_H + 14} fill={ACCENT} opacity={0.7} />
          {/* 终端光标线 */}
          <rect
            x={cx - gapHalf + 10}
            y={deckTop + DECK_H - 4}
            width={Math.max(0, gapHalf * 2 - 20)}
            height={3}
            fill={ACCENT}
            opacity={0.55 + 0.45 * flash}
          />
        </>
      )}
      {/* 两块滑门：从洞口中心向两侧拉开 */}
      {[-1, 1].map((side) => {
        const w = half;
        const left = side < 0 ? cx - half - gapHalf : cx + gapHalf;
        return (
          <g key={side}>
            <rect x={left} y={deckTop} width={w} height={DECK_H} fill={DECK_COLOR} />
            <rect x={left} y={deckTop} width={w} height={2} fill="rgba(203,213,225,0.42)" />
            <rect
              x={side < 0 ? left + w - 2 : left}
              y={deckTop}
              width={2}
              height={DECK_H}
              fill={o > 0.02 ? ACCENT : "rgba(148,163,184,0.3)"}
              opacity={0.8}
            />
          </g>
        );
      })}
      {/* 掉进去时入口闪光与像素溅起 */}
      {flash > 0 && (
        <rect
          x={cx - half - 10}
          y={deckTop - 3}
          width={width + 20}
          height={3}
          fill="#FFF3E0"
          opacity={flash}
        />
      )}
      {sinceEnter >= 0 &&
        sinceEnter < 0.45 &&
        Array.from({ length: 9 }, (_, k) => {
          const t = sinceEnter;
          const a = (-90 + (random(`td-a${k}`) - 0.5) * 110) * (Math.PI / 180);
          const v = 180 + random(`td-v${k}`) * 220;
          const px = cx + (random(`td-x${k}`) - 0.5) * width * 0.6 + Math.cos(a) * v * t;
          const py = deckTop + Math.sin(a) * v * t + 0.5 * 1000 * t * t;
          const s = 5 + Math.round(random(`td-s${k}`) * 4);
          return (
            <rect
              key={k}
              x={Math.round(px - s / 2)}
              y={Math.round(py - s / 2)}
              width={s}
              height={s}
              fill={k % 3 === 0 ? "#FFF3E0" : ACCENT}
              opacity={1 - t / 0.45}
            />
          );
        })}
    </svg>
  );
};
