import React from "react";
import { interpolate } from "remotion";
import type { ClawdPose } from "../clawd/types";

export interface TrumpetPropProps {
  pose: ClawdPose;
  progress: number;
  bodyColor: string;
}

/**
 * L011 铜管部小号入场、前足接住、抬起吹奏与放低送出
 */
export const TrumpetProp: React.FC<TrumpetPropProps> = ({
  pose,
  progress: tp,
  bodyColor,
}) => {
  const enterOut = interpolate(tp, [0, 0.22, 0.76, 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (enterOut <= 0.01) return null;

  const { bodyOffsetX, bodyOffsetY } = pose;
  const isPlaying = tp >= 0.22 && tp <= 0.76;
  const playPhase = isPlaying ? (tp - 0.22) / 0.54 : 0;
  const bellSway = isPlaying
    ? Math.sin(playPhase * Math.PI * 2) * -6.5
    : interpolate(tp, [0.76, 1], [0, 14], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const tx = interpolate(enterOut, [0, 1], [7.2, 0]);
  const ty = interpolate(enterOut, [0, 1], [1.4, 0]);

  return (
    <g
      transform={`translate(${bodyOffsetX + tx}, ${
        bodyOffsetY + ty
      }) rotate(${bellSway}, 9.5, 4.2)`}
      opacity={interpolate(enterOut, [0, 0.2, 1], [0, 1, 1])}
    >
      {/* 吹嘴与主号管 */}
      <rect x={8.6} y={3.85} width={1.2} height={0.55} fill="#E2E8F0" />
      <rect
        x={9.6}
        y={3.75}
        width={5.6}
        height={0.75}
        fill="#F5C542"
        stroke="#11131F"
        strokeWidth={0.18}
      />
      {/* 活塞按键与下部回管 */}
      <rect x={11.1} y={3.15} width={0.42} height={0.65} fill="#FEF08A" />
      <rect x={11.8} y={3.15} width={0.42} height={0.65} fill="#FEF08A" />
      <rect x={12.5} y={3.15} width={0.42} height={0.65} fill="#FEF08A" />
      <rect
        x={10.6}
        y={4.5}
        width={3.6}
        height={0.85}
        rx={0.35}
        fill="none"
        stroke="#D97706"
        strokeWidth={0.28}
      />
      {/* 右侧喇叭口 (Bell) */}
      <polygon
        points="15.0,3.65 17.6,2.35 17.6,5.85 15.0,4.55"
        fill="#F5C542"
        stroke="#11131F"
        strokeWidth={0.22}
        strokeLinejoin="round"
      />
      <ellipse cx={17.55} cy={4.1} rx={0.35} ry={1.65} fill="#B45309" />
      {/* Clawd 前足握持小号 */}
      <rect
        x={11.2}
        y={4.35}
        width={1.5}
        height={1.25}
        fill={bodyColor}
        stroke="#11131F"
        strokeWidth={0.18}
      />
      {/* 吹奏期间飘出的两枚短暂几何音符 */}
      {isPlaying &&
        [
          { delay: 0.05, color: "#38BDF8", dy: -1.6 },
          { delay: 0.32, color: "#F472B6", dy: -2.8 },
        ].map((n, idx) => {
          const np = Math.max(0, Math.min(1, (playPhase - n.delay) / 0.55));
          if (np <= 0 || np >= 1) return null;
          return (
            <g
              key={idx}
              transform={`translate(${18.2 + np * 2.6}, ${3.6 + n.dy * np})`}
              opacity={Math.sin(np * Math.PI)}
              fill={n.color}
            >
              <rect x={0} y={0.75} width={0.75} height={0.65} />
              <rect x={0.5} y={-0.45} width={0.28} height={1.3} />
              <rect x={0.5} y={-0.45} width={0.7} height={0.32} />
            </g>
          );
        })}
    </g>
  );
};
