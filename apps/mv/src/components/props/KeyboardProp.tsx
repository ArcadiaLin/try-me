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

// 10 枚白键 G3..B4（跨度覆盖 G3 到 B4，完整容纳 A3 ↔ B♭3 ↔ B♭4 小九度及两侧相邻白键）：
// idx 0: G3, idx 1: A3 (zone 0 半音下切), idx 2: B3, idx 3: C4, idx 4: D4, idx 5: E4, idx 6: F4, idx 7: G4, idx 8: A4, idx 9: B4
const KEY_COUNT = 10;
const KEY_START_X = 1.66;
const KEY_WIDTH = 1.2;
const KEY_GAP = 0.08;

// 7 枚黑键（位于 afterIdx 白键与 afterIdx+1 白键交界处）：
// after 0: G♯3, after 1: B♭3 (zone 1 基准低音), after 3: C♯4, after 4: D♯4, after 6: F♯4, after 7: G♯4, after 8: B♭4 (zone 2 高八度音)
const BLACK_KEY_AFTER = [0, 1, 3, 4, 6, 7, 8] as const;

const WHITE_ZONE_BY_KEY_INDEX: Partial<Record<number, 0 | 1 | 2>> = {
  1: 0, // A3 半音下切（左手白键）
};

const BLACK_ZONE_BY_AFTER_INDEX: Partial<Record<number, 0 | 1 | 2>> = {
  1: 1, // B♭3 基准低音（左手黑键，位于 A3 与 B3 之间）
  8: 2, // B♭4 高八度（右手黑键，位于 A4 与 B4 之间）
};

/**
 * Clawd 身前弹奏的紧凑 3D 像素小合成器（Mini Synth，扩展宽度与真实 G3–B4 10白+7黑键位）：
 * - 前奏橙色段（0.02s–18.42s）从左侧滑入身前，由 Clawd 左右前肢按真实音高键位演奏：
 *   左爪在低音区白键 A3（idx=1）与紧邻右上方的黑键 B♭3（after=1）之间切换按动，
 *   右爪在右侧高八度黑键 B♭4（after=8）上弹奏；
 * - 18.42s 前向右侧轻巧滑出退场，不遮挡角色四条短腿，把舞台完全交给主歌叙事动作。
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
    ? interpolate(slideProgress, [0, 1], [8.2, 0])
    : interpolate(slideProgress, [0, 1], [-7.6, 0]);
  const offsetY = isExiting
    ? interpolate(slideProgress, [0, 1], [0.85, 0])
    : interpolate(unfoldProgress, [0, 1], [0.85, 0]);
  const tiltDeg = isExiting
    ? interpolate(slideProgress, [0, 1], [9, 0])
    : interpolate(slideProgress, [0, 1], [-9, 0]);
  const opacity = interpolate(slideProgress, [0, 0.2, 1], [0, 1, 1]);

  // 琴体处于胸前偏下位置 (y ≈ 5.72..7.50)，完全避开下方 y=8..10 的四条短腿
  const deckY = 5.72 + bodyOffsetY * 0.45 + offsetY;
  const deckX = bodyOffsetX * 0.35 + offsetX;

  return (
    <g
      transform={`translate(${deckX}, ${deckY}) rotate(${tiltDeg}, 8, 0.8)`}
      opacity={opacity}
    >
      {/* 合成器深色立体底座外壳（适度加宽至 x=0.8..15.2，给双手留出更大活动跨度） */}
      <polygon
        points="1.1,0.04 14.9,0.04 15.22,1.18 14.9,1.8 1.1,1.8 0.78,1.18"
        fill="#1E2235"
        stroke={outlineColor}
        strokeWidth={0.26}
        strokeLinejoin="round"
      />
      {/* 前侧暗面立体下沿 */}
      <polygon
        points="0.86,1.18 15.14,1.18 14.86,1.76 1.14,1.76"
        fill="#121522"
      />
      {/* 合成器前侧中央暖橙状态铭牌 */}
      <rect
        x={6.65}
        y={1.36}
        width={2.7}
        height={0.22}
        rx={0.06}
        fill="#D87757"
      />
      {/* 合成器左上角品牌橙色装饰条与右侧电平小灯 */}
      <rect
        x={1.55}
        y={0.19}
        width={1.85}
        height={0.16}
        fill="#D87757"
        rx={0.05}
      />
      <circle cx={13.95} cy={0.27} r={0.1} fill="#38BDF8" />
      <circle cx={14.32} cy={0.27} r={0.1} fill="#FDBA74" />

      {/* 键床内凹暗槽 */}
      <rect
        x={1.48}
        y={0.42}
        width={13.04}
        height={0.98}
        rx={0.1}
        fill="#0B0D16"
        stroke={outlineColor}
        strokeWidth={0.14}
      />

      {/* 10 枚白键（G3–B4，其中 idx=1 为 A3 半音下切白键） */}
      {Array.from({ length: KEY_COUNT }).map((_, idx) => {
        const zIdx = WHITE_ZONE_BY_KEY_INDEX[idx];
        const zone =
          zIdx !== undefined
            ? keyboardState.zones[zIdx]
            : { press: 0, velocity: 0 };
        const press = zone.press * unfoldProgress;
        const kx = KEY_START_X + idx * (KEY_WIDTH + KEY_GAP);
        const dropY = press * 0.24;
        const topHeight = 0.66 + dropY * 0.38;
        const frontLipH = Math.max(0.11, 0.25 - press * 0.13);
        const isPressed = press > 0.06;

        return (
          <g key={`mk-w-${idx}`}>
            {/* 白键上表面（按下时点亮温暖琥珀橙高光） */}
            <rect
              x={kx}
              y={0.46 + dropY * 0.55}
              width={KEY_WIDTH}
              height={topHeight}
              rx={0.06}
              fill={isPressed ? "#FDBA74" : "#F1F5F9"}
              stroke={outlineColor}
              strokeWidth={0.11}
            />
            {/* 白键前端立体厚度面 */}
            <rect
              x={kx + 0.04}
              y={0.46 + dropY * 0.55 + topHeight - 0.04}
              width={KEY_WIDTH - 0.08}
              height={frontLipH}
              rx={0.04}
              fill={isPressed ? "#D87757" : "#94A3B8"}
            />
          </g>
        );
      })}

      {/* 7 枚黑键（其中 afterIdx=1 为 B♭3 基准低音黑键，afterIdx=8 为 B♭4 高八度黑键，均带按下行程与点亮） */}
      {BLACK_KEY_AFTER.map((afterIdx) => {
        const zIdx = BLACK_ZONE_BY_AFTER_INDEX[afterIdx];
        const zone =
          zIdx !== undefined
            ? keyboardState.zones[zIdx]
            : { press: 0, velocity: 0 };
        const press = zone.press * unfoldProgress;
        const isPressed = press > 0.06;
        const blackW = 0.72;
        const bkx =
          KEY_START_X +
          (afterIdx + 1) * (KEY_WIDTH + KEY_GAP) -
          KEY_GAP * 0.5 -
          blackW * 0.5;
        const dropY = press * 0.18;
        const topH = 0.48 + dropY * 0.22;
        const frontH = Math.max(0.09, 0.17 - press * 0.08);

        return (
          <g key={`mk-b-${afterIdx}`}>
            {/* 黑键立体底座/前端立面 */}
            <rect
              x={bkx}
              y={0.44 + dropY * 0.55}
              width={blackW}
              height={topH + frontH}
              rx={0.05}
              fill={isPressed ? "#EA580C" : "#0F111C"}
              stroke={outlineColor}
              strokeWidth={0.11}
            />
            {/* 黑键顶面（按下时点亮亮琥珀金高光，与爪子本体颜色拉开清晰层次） */}
            <rect
              x={bkx + 0.04}
              y={0.45 + dropY * 0.55}
              width={blackW - 0.08}
              height={topH}
              rx={0.04}
              fill={isPressed ? "#FDE047" : "#262B40"}
            />
          </g>
        );
      })}
    </g>
  );
};
