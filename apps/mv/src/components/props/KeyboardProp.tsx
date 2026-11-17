import React from "react";
import { interpolate } from "remotion";
import type { StageKeyboardState } from "../../timeline/rhythm-timing";
import { CLAWD_MODEL } from "../clawd/model";
import type { ClawdPose } from "../clawd/types";

export interface KeyboardPropProps {
  pose: ClawdPose;
  keyboardState?: StageKeyboardState;
  outlineColor?: string;
}

const KEY_COUNT = 7;
const KEY_START_X = 2.45;
const KEY_WIDTH = 1.5;
const KEY_GAP = 0.09;
const BLACK_KEY_AFTER = [0, 1, 3, 4, 5] as const;

const ZONE_BY_KEY_INDEX: Record<number, 0 | 1 | 2> = {
  0: 0, // A3 半音下切（左手外侧键位）
  1: 1, // B♭3 基准低音（左手内侧键位）
  5: 2, // B♭4 高八度（右手对应键位）
};

/**
 * Clawd 身前弹奏的紧凑 3D 像素小合成器（Mini Synth）：
 * - 前奏橙色段（0.02s–18.88s）从左侧滑入身前，由 Clawd 左右前肢亲自按动左低音区（A3 / B♭3）与右高音区（B♭4）；
 * - 18.47s 末音收束后向右侧轻巧滑出退场，不遮挡角色四条短腿，把舞台完全交给主歌叙事动作。
 */
export const KeyboardProp: React.FC<KeyboardPropProps> = ({
  pose,
  keyboardState,
  outlineColor = CLAWD_MODEL.colors.outline,
}) => {
  if (!keyboardState || !keyboardState.visible) return null;

  const { bodyOffsetX, bodyOffsetY } = pose;
  // 判断当前是入场还是退场（入场从左侧滑入，退场向右侧滑出）
  const isExiting =
    keyboardState.trayUnfold < keyboardState.traySlide - 0.02;
  const slideProgress = keyboardState.traySlide;
  const unfoldProgress = keyboardState.trayUnfold;

  const offsetX = isExiting
    ? interpolate(slideProgress, [0, 1], [7.8, 0])
    : interpolate(slideProgress, [0, 1], [-7.2, 0]);
  const offsetY = isExiting
    ? interpolate(slideProgress, [0, 1], [0.85, 0])
    : interpolate(unfoldProgress, [0, 1], [0.85, 0]);
  const tiltDeg = isExiting
    ? interpolate(slideProgress, [0, 1], [9, 0])
    : interpolate(slideProgress, [0, 1], [-9, 0]);
  const opacity = interpolate(slideProgress, [0, 0.2, 1], [0, 1, 1]);

  // 琴体处于胸前偏下位置 (y ≈ 5.75..7.45)，完全避开下方 y=8..10 的四条短腿
  const deckY = 5.72 + bodyOffsetY * 0.45 + offsetY;
  const deckX = bodyOffsetX * 0.35 + offsetX;

  return (
    <g
      transform={`translate(${deckX}, ${deckY}) rotate(${tiltDeg}, 8, 0.8)`}
      opacity={opacity}
    >
      {/* 合成器深色立体底座外壳（带倾斜顶面与前侧厚度立面） */}
      <polygon
        points="2.0,0.06 14.0,0.06 14.3,1.16 14.0,1.76 2.0,1.76 1.7,1.16"
        fill="#1E2235"
        stroke={outlineColor}
        strokeWidth={0.26}
        strokeLinejoin="round"
      />
      {/* 前侧暗面立体下沿 */}
      <polygon
        points="1.78,1.16 14.22,1.16 13.96,1.72 2.04,1.72"
        fill="#121522"
      />
      {/* 合成器前侧中央暖橙状态铭牌与两侧小螺丝点 */}
      <rect
        x={6.8}
        y={1.34}
        width={2.4}
        height={0.22}
        rx={0.06}
        fill="#D87757"
      />
      {/* 合成器左上角品牌橙色装饰条与右侧电平小灯 */}
      <rect
        x={2.35}
        y={0.2}
        width={1.7}
        height={0.16}
        fill="#D87757"
        rx={0.05}
      />
      <circle cx={13.15} cy={0.28} r={0.1} fill="#38BDF8" />
      <circle cx={13.5} cy={0.28} r={0.1} fill="#FDBA74" />

      {/* 键床内凹暗槽 */}
      <rect
        x={2.3}
        y={0.44}
        width={11.4}
        height={0.94}
        rx={0.1}
        fill="#0B0D16"
        stroke={outlineColor}
        strokeWidth={0.14}
      />

      {/* 7 枚紧凑白键（覆盖左低音 A3/B♭3 与右高八度 B♭4） */}
      {Array.from({ length: KEY_COUNT }).map((_, idx) => {
        const zIdx = ZONE_BY_KEY_INDEX[idx];
        const zone =
          zIdx !== undefined
            ? keyboardState.zones[zIdx]
            : { press: 0, velocity: 0 };
        const press = zone.press * unfoldProgress;
        const kx = KEY_START_X + idx * (KEY_WIDTH + KEY_GAP);
        const dropY = press * 0.24;
        const topHeight = 0.64 + dropY * 0.4;
        const frontLipH = Math.max(0.11, 0.25 - press * 0.12);
        const isPressed = press > 0.06;

        return (
          <g key={`mk-w-${idx}`}>
            {/* 琴键上表面（按下时点亮温暖琥珀橙高光） */}
            <rect
              x={kx}
              y={0.48 + dropY * 0.55}
              width={KEY_WIDTH}
              height={topHeight}
              rx={0.07}
              fill={isPressed ? "#FDBA74" : "#F1F5F9"}
              stroke={outlineColor}
              strokeWidth={0.12}
            />
            {/* 琴键前端立体厚度面 */}
            <rect
              x={kx + 0.04}
              y={0.48 + dropY * 0.55 + topHeight - 0.04}
              width={KEY_WIDTH - 0.08}
              height={frontLipH}
              rx={0.04}
              fill={isPressed ? "#D87757" : "#94A3B8"}
            />
          </g>
        );
      })}

      {/* 5 枚紧凑黑键 */}
      {BLACK_KEY_AFTER.map((afterIdx) => {
        const bkx =
          KEY_START_X +
          (afterIdx + 1) * (KEY_WIDTH + KEY_GAP) -
          KEY_GAP * 0.5 -
          0.35;
        return (
          <rect
            key={`mk-b-${afterIdx}`}
            x={bkx}
            y={0.46}
            width={0.7}
            height={0.48}
            rx={0.06}
            fill="#171A29"
            stroke={outlineColor}
            strokeWidth={0.12}
          />
        );
      })}
    </g>
  );
};
