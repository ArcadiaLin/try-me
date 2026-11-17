import React from "react";
import { interpolate } from "remotion";
import type { ClawdPose } from "../clawd/types";

export interface BookPropProps {
  pose: ClawdPose;
  /**
   * 书本进出场连续进度 (0 ~ 2)：
   * - 0 -> 1：从一侧（右下）入场至胸前
   * - 1：稳定捧在胸前阅读
   * - 1 -> 2：从另一侧（左下）退场离开
   */
  bookProgress?: number;
  outlineColor: string;
}

/**
 * L009–L010 二维视角下的 3D 捧书造型：
 * 1. 朝向观众的是棕色书封面，书封上沿与下沿均向中央书脊 (x=8) 向下凹陷，展现双手捧书的 3D 透视折角；
 * 2. 书封上沿上方露出一层具有一定厚度的白色书页块（同样向中心书脊凹陷），并在白块内部绘制跟随凹陷走势的浅灰书页层线；
 * 3. 入场从右下侧切入 (0 -> 1)，退场从另一侧（左下侧，1 -> 2）离开。
 */
export const BookProp: React.FC<BookPropProps> = ({
  pose,
  bookProgress,
  outlineColor,
}) => {
  const bp = bookProgress !== undefined ? bookProgress : 1;
  if (bp <= 0.01 || bp >= 1.99) return null;

  const { bodyOffsetX, bodyOffsetY, torsoTiltDeg, rotPivotX } = pose;

  let bx = 0;
  let by = 0;
  let bRot = 0;
  let bOp = 1;

  if (bp < 1) {
    // 0 -> 1: 从右侧偏下平稳切入至胸前
    const t = Math.max(0, Math.min(1, bp));
    bx = interpolate(t, [0, 0.82, 1], [8.2, -0.18, 0]);
    by = interpolate(t, [0, 0.82, 1], [3.6, -0.12, 0]);
    bRot = interpolate(t, [0, 0.82, 1], [15, -0.8, 0]);
    bOp = interpolate(t, [0, 0.2, 1], [0, 1, 1]);
  } else if (bp > 1) {
    // 1 -> 2: 向另一侧（左侧偏下）退场离开
    const t = Math.max(0, Math.min(1, bp - 1));
    bx = interpolate(t, [0, 0.18, 1], [0, 0.18, -8.2]);
    by = interpolate(t, [0, 1], [0, 3.6]);
    bRot = interpolate(t, [0, 1], [0, -15]);
    bOp = interpolate(t, [0, 0.8, 1], [1, 1, 0]);
  }

  return (
    <g
      transform={`translate(${bodyOffsetX + bx}, ${
        bodyOffsetY + by
      }) rotate(${torsoTiltDeg + bRot}, ${rotPivotX}, 6.0)`}
      opacity={bOp}
    >
      {/* 1. 书封上沿露出的一定厚度白色书页层（上沿向中央 x=8 向下凹陷，展现 3D 翻开书页厚度） */}
      <path
        d="M 2.85 3.92 Q 5.4 3.82 8.0 4.46 Q 10.6 3.82 13.15 3.92 L 13.15 5.45 L 8.0 6.05 L 2.85 5.45 Z"
        fill="#F8FAFC"
        stroke={outlineColor}
        strokeWidth={0.26}
        strokeLinejoin="round"
      />

      {/* 2. 白色书页块上的灰色书页纹理线（表现一叠书页的厚度层次）与中央书脊分界线 */}
      <path
        d="M 3.15 4.20 Q 5.5 4.10 8.0 4.72 Q 10.5 4.10 12.85 4.20"
        fill="none"
        stroke="#94A3B8"
        strokeWidth={0.16}
        strokeLinecap="round"
      />
      <path
        d="M 3.15 4.48 Q 5.5 4.38 8.0 5.00 Q 10.5 4.38 12.85 4.48"
        fill="none"
        stroke="#64748B"
        strokeWidth={0.16}
        strokeLinecap="round"
      />
      <line
        x1={8.0}
        y1={4.46}
        x2={8.0}
        y2={5.32}
        stroke="#64748B"
        strokeWidth={0.2}
      />

      {/* 3. 朝向观众的棕色立体书封面（上沿呈现向中央向下凹陷的 3D 折角，露出上方白书页层） */}
      <path
        d="M 2.65 4.72 Q 5.35 4.62 8.0 5.26 Q 10.65 4.62 13.35 4.72 L 13.15 7.12 Q 10.6 7.06 8.0 7.68 Q 5.4 7.06 2.85 7.12 Z"
        fill="#8B5A2B"
        stroke={outlineColor}
        strokeWidth={0.28}
        strokeLinejoin="round"
      />

      {/* 书封中央立体书脊暗面 (x = 7.62..8.38) */}
      <path
        d="M 7.62 5.18 L 8.0 5.26 L 8.38 5.18 L 8.34 7.60 L 8.0 7.68 L 7.66 7.60 Z"
        fill="#6B4220"
        stroke={outlineColor}
        strokeWidth={0.18}
        strokeLinejoin="round"
      />

      {/* 左右书封面的浅棕装饰内框线，强化立体封面观感 */}
      <path
        d="M 3.35 5.25 Q 5.3 5.20 7.2 5.65 L 7.2 7.05 Q 5.3 6.65 3.45 6.70 Z"
        fill="none"
        stroke="#A97442"
        strokeWidth={0.16}
        strokeLinejoin="round"
      />
      <path
        d="M 12.65 5.25 Q 10.7 5.20 8.8 5.65 L 8.8 7.05 Q 10.7 6.65 12.55 6.70 Z"
        fill="none"
        stroke="#A97442"
        strokeWidth={0.16}
        strokeLinejoin="round"
      />
    </g>
  );
};
