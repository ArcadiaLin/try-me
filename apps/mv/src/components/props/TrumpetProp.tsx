import React from "react";
import { interpolate } from "remotion";
import { POP_PALETTE } from "../../styles/palette";
import type { ClawdPose } from "../clawd/types";

export interface TrumpetPropProps {
  pose: ClawdPose;
  progress: number;
  bodyColor: string;
}

/**
 * 弧形波普漫画铜管小号路径（局部坐标：吹嘴 x=8.45, 号身重心 x=12.1, 喇叭口 x=17.9, 中心 y=4.1）
 * 用三次贝塞尔勾勒真实铜管喇叭弧度、圆润 U 形调音回管与三枚活塞阀柱，彻底告别三角形+矩形硬拼接。
 */
const TRUMPET_BELL_BODY_PATH =
  "M 9.35 3.74 L 14.15 3.74 C 15.55 3.74 16.78 3.22 17.88 2.02 L 17.88 6.18 C 16.78 4.98 15.55 4.46 14.15 4.46 L 9.35 4.46 Z";

const TRUMPET_LOWER_LOOP_PATH =
  "M 10.45 4.46 L 10.45 5.08 C 10.45 5.56 10.85 5.82 11.42 5.82 L 13.72 5.82 C 14.32 5.82 14.72 5.54 14.72 5.06 L 14.72 4.46";

const TRUMPET_MOUTHPIECE_PATH =
  "M 8.42 3.68 C 8.72 3.68 8.95 3.84 9.38 3.88 L 9.38 4.32 C 8.95 4.36 8.72 4.52 8.42 4.52 Z";

/**
 * L011–L065 铜管部小号：
 * 1. tp: 0.00 -> 0.16 由右侧顶棚吊绳像钟摆般晃进舞台（支点在右侧，不挤占 Clawd 位置），Clawd 探身伸爪迎接；
 * 2. tp: 0.16 -> 0.22 Clawd 实体右手稳稳接住并拉到嘴边，挂钩脱开后吊绳向右上抽回顶棚；
 * 3. tp: 0.22 -> 0.76 吹奏（真实右手由 ClawdHandsOverlay 覆在号管前握持）；
 * 4. tp: 0.76 -> 1.00 吹奏结束，右手回到原位 [14, 16]，小号顺势放低交到原位右手斜持；
 * 5. tp: 1.00 -> 1.82 L065 (ほら！) 期间拿在原位右手上随贴地回弹得意展示；
 * 6. tp: 1.82 -> 2.00 随 ほら！ 收尾轻巧离场。
 */
export const TrumpetProp: React.FC<TrumpetPropProps> = ({
  pose,
  progress: tp,
}) => {
  if (tp <= 0.005 || tp >= 1.995) return null;

  const { bodyOffsetX, bodyOffsetY } = pose;
  const isSwingingIn = tp < 0.16;
  const isPullingToMouth = tp >= 0.16 && tp < 0.22;
  const isPlaying = tp >= 0.22 && tp <= 0.76;
  const isLoweringToSide = tp > 0.76 && tp < 1.0;
  const isHoldingForHora = tp >= 1.0 && tp < 1.82;
  const isFinalExit = tp >= 1.82;

  // 吊绳挂点在小号局部坐标系中的位置（活塞上方重心处）
  const LOCAL_HOOK_X = 12.1;
  const LOCAL_HOOK_Y = 3.45;

  // 右侧顶棚吊绳支点与绳长（更靠右，彻底不挤占中央 Clawd 的位置，且 gy < -28.5 完全在画框外）
  const ROPE_PIVOT_X = 24.5;
  const ROPE_PIVOT_Y = -36.0;
  const ROPE_LEN = 40.4;

  // 1. 钟摆摆荡角度：从更右侧 (+30°) 优雅荡到 Clawd 探身伸爪的右侧接住点 (-11.5°)
  const swingRaw = interpolate(tp, [0, 0.16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const swingEase = 1 - Math.pow(1 - swingRaw, 2.2);
  const swingDeg = interpolate(swingEase, [0, 1], [30, -11.5]);
  const swingRad = (swingDeg * Math.PI) / 180;

  const swingHookX = ROPE_PIVOT_X + Math.sin(swingRad) * ROPE_LEN;
  const swingHookY = ROPE_PIVOT_Y + Math.cos(swingRad) * ROPE_LEN;

  // 2. 接住瞬间的位置（swingRaw = 1 时，约 x=16.45, y=3.6）
  const catchRad = (-11.5 * Math.PI) / 180;
  const catchHookX = ROPE_PIVOT_X + Math.sin(catchRad) * ROPE_LEN;
  const catchHookY = ROPE_PIVOT_Y + Math.cos(catchRad) * ROPE_LEN;

  // 3. 吹奏时的挂点目标位置
  const playHookX = bodyOffsetX + LOCAL_HOOK_X;
  const playHookY = bodyOffsetY + LOCAL_HOOK_Y;

  // 4. L065 (ほら！) 原位右手斜持时的相对偏移（右手原位在 x=14..16, y=4..6，避免吹嘴碰到右眼）
  const SIDE_HOLD_TX = 4.5;
  const SIDE_HOLD_TY = 1.15;
  const SIDE_HOLD_ANGLE = 28;

  let tx = 0;
  let ty = 0;
  let bellSway = 0;
  let pivotX = 9.5;
  let pivotY = 4.1;

  if (isSwingingIn) {
    tx = swingHookX - LOCAL_HOOK_X - bodyOffsetX;
    ty = swingHookY - LOCAL_HOOK_Y - bodyOffsetY;
    bellSway = swingDeg * 0.42;
    pivotX = LOCAL_HOOK_X;
    pivotY = LOCAL_HOOK_Y;
  } else if (isPullingToMouth) {
    const pullRaw = interpolate(tp, [0.16, 0.22], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const pullEase = pullRaw * pullRaw * (3 - 2 * pullRaw);
    const curHookX = interpolate(pullEase, [0, 1], [catchHookX, playHookX]);
    const curHookY = interpolate(pullEase, [0, 1], [catchHookY, playHookY]);
    tx = curHookX - LOCAL_HOOK_X - bodyOffsetX;
    ty = curHookY - LOCAL_HOOK_Y - bodyOffsetY;
    bellSway = interpolate(pullEase, [0, 1], [-11.5 * 0.42, 0]);
    pivotX = LOCAL_HOOK_X;
    pivotY = LOCAL_HOOK_Y;
  } else if (isPlaying) {
    const playPhase = (tp - 0.22) / 0.54;
    bellSway = Math.sin(playPhase * Math.PI * 2) * -6.5;
  } else if (isLoweringToSide) {
    // 随右手回到原位 [14, 16]，小号顺势放低到身体右侧斜持
    const lowerRaw = interpolate(tp, [0.76, 0.96], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const lowerEase = lowerRaw * lowerRaw * (3 - 2 * lowerRaw);
    tx = interpolate(lowerEase, [0, 1], [0, SIDE_HOLD_TX]);
    ty = interpolate(lowerEase, [0, 1], [0, SIDE_HOLD_TY]);
    bellSway = interpolate(lowerEase, [0, 1], [0, SIDE_HOLD_ANGLE]);
    pivotX = LOCAL_HOOK_X;
    pivotY = 4.2;
  } else if (isHoldingForHora) {
    // L065 ほら！期间稳稳拿在原位右手上，随贴地回弹略微扬起一点
    const popLift = Math.max(0, -bodyOffsetY) * 6;
    tx = SIDE_HOLD_TX;
    ty = SIDE_HOLD_TY;
    bellSway = SIDE_HOLD_ANGLE - popLift;
    pivotX = LOCAL_HOOK_X;
    pivotY = 4.2;
  } else if (isFinalExit) {
    const exitRaw = interpolate(tp, [1.82, 2.0], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const exitEase = exitRaw * exitRaw;
    tx = SIDE_HOLD_TX + exitEase * 6.5;
    ty = SIDE_HOLD_TY + exitEase * 1.8;
    bellSway = SIDE_HOLD_ANGLE + exitEase * 18;
    pivotX = LOCAL_HOOK_X;
    pivotY = 4.2;
  }

  const opacity = isFinalExit
    ? interpolate(tp, [1.82, 1.94, 2.0], [1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : interpolate(tp, [0, 0.03, 1], [0, 1, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  // 5. 吊绳与挂钩：tp < 0.16 挂在小号上摆荡进来；tp: 0.16 -> 0.25 脱钩后沿绳轴抽回右上方顶棚
  const ropeRetractRaw = interpolate(tp, [0.16, 0.25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showRope = tp < 0.255;
  const ropeRetractEase = ropeRetractRaw * ropeRetractRaw;
  const activeHookX = isSwingingIn
    ? swingHookX
    : interpolate(ropeRetractEase, [0, 1], [catchHookX, ROPE_PIVOT_X]);
  const activeHookY = isSwingingIn
    ? swingHookY
    : interpolate(ropeRetractEase, [0, 1], [catchHookY, ROPE_PIVOT_Y]);

  return (
    <g opacity={opacity}>
      {/* 右上方摆荡吊绳与小挂钩（接住瞬间脱钩并向右上抽回顶棚） */}
      {showRope && (
        <g>
          <line
            x1={ROPE_PIVOT_X}
            y1={ROPE_PIVOT_Y}
            x2={activeHookX}
            y2={activeHookY}
            stroke={POP_PALETTE.cream}
            strokeWidth={0.24}
            strokeLinecap="round"
          />
          <line
            x1={ROPE_PIVOT_X}
            y1={ROPE_PIVOT_Y}
            x2={activeHookX}
            y2={activeHookY}
            stroke={POP_PALETTE.ink}
            strokeWidth={0.09}
            strokeDasharray="0.45 0.35"
          />
          {/* 漫画小挂钩环 */}
          <path
            d={`M ${activeHookX - 0.32} ${activeHookY - 0.15} A 0.34 0.34 0 1 0 ${
              activeHookX + 0.34
            } ${activeHookY - 0.05}`}
            fill="none"
            stroke={POP_PALETTE.yellowLight}
            strokeWidth={0.24}
            strokeLinecap="round"
          />
          <circle
            cx={activeHookX}
            cy={activeHookY - 0.42}
            r={0.18}
            fill={POP_PALETTE.ink}
          />
        </g>
      )}

      {/* 弧形波普铜管小号本体：底层统一茄紫深墨粗外轮廓 + 上层明亮蛋黄金与暖奶油高光 */}
      <g
        transform={`translate(${bodyOffsetX + tx}, ${
          bodyOffsetY + ty
        }) rotate(${bellSway}, ${pivotX}, ${pivotY})`}
      >
        {/* 第 1 层：统一粗外轮廓（茄紫深墨 #22182E，圆角包边，与 Clawd 身体彻底拉开边界） */}
        <g
          fill={POP_PALETTE.ink}
          stroke={POP_PALETTE.ink}
          strokeWidth={0.54}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d={TRUMPET_MOUTHPIECE_PATH} />
          <path d={TRUMPET_BELL_BODY_PATH} />
          <path d={TRUMPET_LOWER_LOOP_PATH} fill="none" strokeWidth={0.92} />
          <ellipse cx={17.88} cy={4.1} rx={0.44} ry={2.08} />
          {/* 3 枚活塞键柱外轮廓 */}
          <rect x={11.1} y={2.9} width={0.46} height={0.9} rx={0.18} />
          <rect x={11.88} y={2.9} width={0.46} height={0.9} rx={0.18} />
          <rect x={12.66} y={2.9} width={0.46} height={0.9} rx={0.18} />
          {/* 小指扣环外轮廓 */}
          <circle cx={14.55} cy={3.42} r={0.34} fill="none" strokeWidth={0.42} />
        </g>

        {/* 第 2 层：内部色彩与弧度光影（亮蛋黄金 + 暖奶油高光，绝不与 Clawd 陶土橙混色） */}
        {/* 下方 U 形调音回管（亮奶油金） */}
        <path
          d={TRUMPET_LOWER_LOOP_PATH}
          fill="none"
          stroke={POP_PALETTE.yellowLight}
          strokeWidth={0.46}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={TRUMPET_LOWER_LOOP_PATH}
          fill="none"
          stroke={POP_PALETTE.yellow}
          strokeWidth={0.22}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 小指扣环 */}
        <circle
          cx={14.55}
          cy={3.42}
          r={0.34}
          fill="none"
          stroke={POP_PALETTE.yellowLight}
          strokeWidth={0.16}
        />

        {/* 3 枚活塞阀柱与暖奶油珍珠键帽 */}
        {[11.1, 11.88, 12.66].map((vx, i) => (
          <g key={i}>
            <rect
              x={vx}
              y={3.02}
              width={0.46}
              height={0.78}
              rx={0.14}
              fill={POP_PALETTE.yellowLight}
              stroke={POP_PALETTE.ink}
              strokeWidth={0.12}
            />
            <rect
              x={vx - 0.06}
              y={2.86}
              width={0.58}
              height={0.26}
              rx={0.12}
              fill={POP_PALETTE.creamLight}
              stroke={POP_PALETTE.ink}
              strokeWidth={0.12}
            />
          </g>
        ))}

        {/* 亮银吹嘴 */}
        <path
          d={TRUMPET_MOUTHPIECE_PATH}
          fill="#F8FAFC"
          stroke={POP_PALETTE.ink}
          strokeWidth={0.12}
          strokeLinejoin="round"
        />

        {/* 主号管 + 流畅弧线张开的喇叭口 */}
        <path
          d={TRUMPET_BELL_BODY_PATH}
          fill={POP_PALETTE.yellow}
          stroke={POP_PALETTE.ink}
          strokeWidth={0.14}
          strokeLinejoin="round"
        />

        {/* 喇叭口上沿流畅暖奶油反光弧带（强化金属圆润弧度） */}
        <path
          d="M 9.8 3.92 L 14.2 3.92 C 15.45 3.92 16.52 3.48 17.42 2.58"
          fill="none"
          stroke={POP_PALETTE.creamLight}
          strokeWidth={0.24}
          strokeLinecap="round"
          opacity={0.92}
        />
        {/* 喇叭口下沿暖金明暗交界弧线 */}
        <path
          d="M 10.2 4.32 L 14.25 4.32 C 15.48 4.32 16.55 4.74 17.42 5.62"
          fill="none"
          stroke="#E59A1A"
          strokeWidth={0.2}
          strokeLinecap="round"
          opacity={0.85}
        />

        {/* 喇叭口椭圆内腔（深紫红暗腔 + 暖金内沿） */}
        <ellipse
          cx={17.88}
          cy={4.1}
          rx={0.44}
          ry={2.08}
          fill="#6B2D3E"
          stroke={POP_PALETTE.ink}
          strokeWidth={0.16}
        />
        <ellipse
          cx={17.78}
          cy={4.1}
          rx={0.22}
          ry={1.38}
          fill={POP_PALETTE.ink}
          opacity={0.78}
        />
      </g>
    </g>
  );
};
