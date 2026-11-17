import React from "react";
import { interpolate } from "remotion";
import type { ClawdPose } from "../types";

export interface GlassesOutfitProps {
  pose: ClawdPose;
  /**
   * 眼镜进出场连续进度 (0 ~ 2)：
   * - 0 -> 1：从左侧快速旋入并卡拍戴到眼部
   * - 1：稳定佩戴在眼部
   * - 1 -> 2：从右侧快速旋出离开画面
   */
  glassesProgress: number;
}

/**
 * L009–L010 中学生白反光眼镜（左进右出，白色镜片遮住黑眼，深色外框清晰）
 */
export const GlassesOutfit: React.FC<GlassesOutfitProps> = ({
  pose,
  glassesProgress,
}) => {
  if (glassesProgress <= 0.01 || glassesProgress >= 1.99) return null;
  const { bodyOffsetX, bodyOffsetY, torsoTiltDeg } = pose;

  let dx = 0;
  let dy = 0;
  let rot = 0;
  let opacity = 1;

  if (glassesProgress < 1) {
    // 0 -> 1: 从左侧快速飞入并带轻微过冲落位
    const t = Math.max(0, Math.min(1, glassesProgress));
    dx = interpolate(t, [0, 0.78, 1], [-11.5, 0.35, 0]);
    dy = interpolate(t, [0, 0.78, 1], [-1.5, 0.08, 0]);
    rot = interpolate(t, [0, 0.78, 1], [-26, 2, 0]);
    opacity = interpolate(t, [0, 0.22, 1], [0, 1, 1]);
  } else if (glassesProgress > 1) {
    // 1 -> 2: 向另一侧（右侧）快速飞出离开
    const t = Math.max(0, Math.min(1, glassesProgress - 1));
    dx = interpolate(t, [0, 0.22, 1], [0, -0.3, 11.5]);
    dy = interpolate(t, [0, 1], [0, -1.4]);
    rot = interpolate(t, [0, 1], [0, 26]);
    opacity = interpolate(t, [0, 0.78, 1], [1, 1, 0]);
  }

  return (
    <g
      transform={`translate(${bodyOffsetX + dx}, ${
        bodyOffsetY + dy
      }) rotate(${torsoTiltDeg + rot}, 8, 2.8)`}
      opacity={opacity}
    >
      {/* 左右镜腿与中梁 */}
      <rect x={2.0} y={2.35} width={12.0} height={0.42} fill="#11131F" />
      {/* 左镜框与白色反光镜片 */}
      <rect
        x={2.55}
        y={1.45}
        width={3.6}
        height={2.65}
        rx={0.22}
        fill="#F8FAFC"
        stroke="#11131F"
        strokeWidth={0.34}
      />
      <polygon
        points="3.0,3.85 4.2,1.65 4.85,1.65 3.65,3.85"
        fill="#BAE6FD"
      />
      <polygon
        points="4.95,3.85 5.65,2.45 5.95,2.45 5.25,3.85"
        fill="#E0F2FE"
      />
      {/* 右镜框与白色反光镜片 */}
      <rect
        x={9.55}
        y={1.45}
        width={3.6}
        height={2.65}
        rx={0.22}
        fill="#F8FAFC"
        stroke="#11131F"
        strokeWidth={0.34}
      />
      <polygon
        points="10.0,3.85 11.2,1.65 11.85,1.65 10.65,3.85"
        fill="#BAE6FD"
      />
      <polygon
        points="11.95,3.85 12.65,2.45 12.95,2.45 12.25,3.85"
        fill="#E0F2FE"
      />
    </g>
  );
};
