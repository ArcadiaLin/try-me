import React from "react";
import type { ClawdMouth, ClawdOutfit, ClawdPose } from "../types";

export interface ClawdOutfitLayerProps {
  outfit: ClawdOutfit;
  mouth: ClawdMouth;
  pose: ClawdPose;
  timeSec: number;
}

export const ClawdOutfitLayer: React.FC<ClawdOutfitLayerProps> = ({
  outfit,
  mouth,
  pose,
  timeSec,
}) => {
  const { bodyOffsetX, bodyOffsetY } = pose;

  return (
    <>
      {/* 绅士单片眼镜与八字胡 */}
      {outfit === "gentleman" && (
        <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
          <rect
            x={9.7}
            y={1.35}
            width={2.8}
            height={2.6}
            fill="none"
            stroke="#F5C542"
            strokeWidth={0.28}
          />
          <line
            x1={12.5}
            y1={3.95}
            x2={12.5}
            y2={7.1}
            stroke="#F5C542"
            strokeWidth={0.22}
            strokeDasharray="0.35 0.35"
          />
          <g
            transform={`translate(0, ${mouth === "talk" ? Math.sin(timeSec * Math.PI * 10) * 0.18 : 0})`}
            fill="#11131F"
          >
            <rect x={5.8} y={4.2} width={4.4} height={0.65} />
            <rect x={5.1} y={3.85} width={0.8} height={0.55} />
            <rect x={10.1} y={3.85} width={0.8} height={0.55} />
          </g>
        </g>
      )}

      {/* Superstar 潮人反戴棒球帽与金链子 */}
      {outfit === "swag" && (
        <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
          <rect x={0.2} y={-0.35} width={2.8} height={0.55} fill="#1F222E" />
          <path
            d="M 2.3 0.2 L 2.8 -1.4 Q 8 -2.3 13.2 -1.4 L 13.7 0.2 Z"
            fill="#1F222E"
          />
          <path
            d="M 9.1 -1.35 H 8.1 V -0.35 H 9.1"
            fill="none"
            stroke="#F5C542"
            strokeWidth={0.32}
          />
          <line
            x1={3.4}
            y1={4.2}
            x2={7.5}
            y2={5.8}
            stroke="#F5C542"
            strokeWidth={0.24}
          />
          <line
            x1={12.6}
            y1={4.2}
            x2={8.5}
            y2={5.8}
            stroke="#F5C542"
            strokeWidth={0.24}
          />
          <path
            d="M 8.6 5.95 H 7.45 V 7.25 H 8.6"
            fill="none"
            stroke="#F5C542"
            strokeWidth={0.38}
          />
        </g>
      )}

      {/* 绅士高礼帽 */}
      {outfit === "gentleman" && (
        <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
          <rect x={1.1} y={-0.35} width={13.8} height={0.6} fill="#1E202B" />
          <rect x={3.2} y={-3.3} width={9.6} height={2.95} fill="#1E202B" />
          <rect x={3.2} y={-1.15} width={9.6} height={0.8} fill="#C93B3B" />
          <rect x={3.6} y={-3.0} width={1.8} height={0.25} fill="#94A3B8" />
        </g>
      )}

      {/* 派对尖顶帽 */}
      {outfit === "party" && (
        <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
          <polygon points="8,-2.7 5.1,0.15 10.9,0.15" fill="#F5C542" />
          <polygon
            points="6.2,-0.9 9.8,-0.9 10.2,-0.45 5.8,-0.45"
            fill="#FFFFFF"
          />
          <rect x={7.5} y={-3.35} width={1.0} height={0.85} fill="#E04F4F" />
        </g>
      )}
    </>
  );
};
