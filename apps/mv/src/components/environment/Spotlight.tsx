import React, { useId } from "react";

/** Clawd 四足所在的舞台地面高度（720p 画面自顶部起，约等于台面上沿下 7px） */
export const STAGE_FLOOR_Y = 532;

export interface SpotlightState {
  /** 地面光圈中心相对画面中线的水平偏移（px） */
  x: number;
  /** 光圈开合 (0 = 收光熄灭, 1 = 全开) */
  iris: number;
  /** 场内其余区域压暗程度 (0 = 不压暗, 1 = 全黑) */
  ambient: number;
}

export interface SpotlightProps extends SpotlightState {
  /** floor：地面光圈（放在 Clawd 之下）；air：压暗遮罩与光束（放在 Clawd 之上） */
  layer: "floor" | "air";
  /** 灯具在画外上方的水平位置（相对中线，px）；灯具固定，光圈移动时光束会倾斜 */
  lampX?: number;
  floorY?: number;
  /** 光圈半径（px） */
  rx?: number;
  ry?: number;
  /** 灯口半宽（px）；加大后光束两侧向外张开，用于“聚光 → 全场亮”的过渡 */
  lampHalfWidth?: number;
  /** 光束与地面光圈的亮度 (0 ~ 1) */
  glow?: number;
  width?: number;
  height?: number;
  color?: string;
}

/**
 * 舞台聚光灯（追光，follow spot）：
 * 画外上方一盏固定灯具 → 一道锥形光束 → 地面上一个椭圆光圈；光圈以外的舞台按 ambient 压暗。
 * 分成 floor / air 两层，以便角色站在光圈上、同时被压暗遮罩正确遮挡。
 * 纯 props 驱动，不读取帧号；动画由调用方插值 x / iris / ambient。
 */
export const Spotlight: React.FC<SpotlightProps> = ({
  layer,
  x,
  iris,
  ambient,
  lampX = 0,
  floorY = STAGE_FLOOR_Y,
  rx = 150,
  ry = 30,
  lampHalfWidth = 14,
  glow = 1,
  width = 1280,
  height = 720,
  color = "#FFE7BA",
}) => {
  const id = useId().replace(/:/g, "");
  const cx = width / 2 + x;
  const lampPx = width / 2 + lampX;
  const lampY = -90;
  const open = Math.max(0, Math.min(1, iris));
  const prx = rx * open;
  const pry = ry * open;
  const lampHalf = lampHalfWidth * open;
  const cone = `${lampPx - lampHalf},${lampY} ${lampPx + lampHalf},${lampY} ${cx + prx},${floorY} ${cx - prx},${floorY}`;

  if (layer === "floor") {
    if (open <= 0.001 || glow <= 0.001) return null;
    return (
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", opacity: glow }}
      >
        <defs>
          <radialGradient id={`${id}-pool`}>
            <stop offset="0%" stopColor={color} stopOpacity={0.62} />
            <stop offset="78%" stopColor={color} stopOpacity={0.42} />
            <stop offset="94%" stopColor={color} stopOpacity={0.16} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </radialGradient>
        </defs>
        <ellipse cx={cx} cy={floorY} rx={prx} ry={pry} fill={`url(#${id}-pool)`} />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
    >
      <defs>
        <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={10} />
        </filter>
        <mask id={`${id}-hole`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <rect x={0} y={0} width={width} height={height} fill="white" />
          {open > 0.001 && (
            <g filter={`url(#${id}-soft)`} fill="black">
              <polygon points={cone} />
              <ellipse cx={cx} cy={floorY} rx={prx * 1.04} ry={pry * 1.6} />
            </g>
          )}
        </mask>
        <linearGradient
          id={`${id}-beam`}
          gradientUnits="userSpaceOnUse"
          x1={lampPx}
          y1={lampY}
          x2={cx}
          y2={floorY}
        >
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      {/* 光圈之外的舞台压暗 */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#04040A"
        opacity={ambient}
        mask={`url(#${id}-hole)`}
      />
      {/* 空气中的光束（很淡，只用来交代光从哪里来） */}
      {open > 0.001 && glow > 0.001 && (
        <polygon
          points={cone}
          fill={`url(#${id}-beam)`}
          opacity={glow}
          style={{ mixBlendMode: "screen" }}
        />
      )}
    </svg>
  );
};
