import React from "react";
import { interpolate } from "remotion";
import { CLAWD_MODEL } from "./model";
import type { ClawdPose } from "./types";

export interface ClawdBodyProps {
  pose: ClawdPose;
  bodyColor: string;
  outlineColor: string;
  outlineWidth: number;
}

const SWEAT_DROPS = [
  {
    start: 0.04,
    end: 0.48,
    baseX: 1.0,
    baseY: 0.4,
    dx: -1.6,
    dy: 2.3,
    scale: 1.0,
  },
  {
    start: 0.22,
    end: 0.68,
    baseX: 14.8,
    baseY: 0.2,
    dx: 1.7,
    dy: 2.4,
    scale: 0.95,
  },
  {
    start: 0.42,
    end: 0.86,
    baseX: 0.6,
    baseY: 1.6,
    dx: -1.5,
    dy: 2.2,
    scale: 0.88,
  },
] as const;

/**
 * 根据 pose 计算左右手方块（宽 2.0）在网格中的实时坐标：
 * - handHoldProgress = 0 时：左手位于 [0, 2]，右手位于 [14, 16]，完全在躯干 [2, 14] 外侧；
 * - handHoldProgress = 0 -> 1 时：左右手方块连续向躯干内侧平移至 [1.75, 3.75] 与 [12.25, 14.25]，
 *   下移至胸前书本两侧 (y = 5.05)，远端自然越过躯干边界 x=2 / x=14 与主体重合。
 */
export function computeHandBoxes(pose: ClawdPose) {
  const hBook = pose.handHoldProgress;
  const hKey = pose.handKeyboardProgress ?? 0;
  const hTrumpet = pose.handTrumpetProgress ?? 0;
  const h = Math.max(hBook, hKey, hTrumpet);
  const handWidth = 2.0;
  const handHeight = interpolate(h, [0, 1], [2.0, 1.85]);

  if (hTrumpet > hBook && hTrumpet > hKey && hTrumpet > 0) {
    // 握持小号时：左手留在躯干左侧保持平衡，右手连续平移至胸前右侧稳稳托握小号号管
    const leftOuterW = Math.max(0.6, 2 + pose.leftArmExtend);
    const rightStartW = Math.max(0.6, 2 + pose.rightArmExtend);
    return {
      h: hTrumpet,
      left: {
        x: Math.min(1.4, -pose.leftArmExtend),
        y: 4 + pose.leftArmOffsetY,
        width: leftOuterW,
        height: 2.0,
      },
      right: {
        x: interpolate(hTrumpet, [0, 1], [14, 11.45]),
        y: interpolate(
          hTrumpet,
          [0, 1],
          [4 + pose.rightArmOffsetY, 4.18 + pose.bodyOffsetY],
        ),
        width: interpolate(hTrumpet, [0, 1], [rightStartW, 1.95]),
        height: interpolate(hTrumpet, [0, 1], [2.0, 1.65]),
      },
    };
  }

  if (hKey > hBook && hKey > 0) {
    const keyShiftX = pose.leftKeyShiftX ?? 0; // -1: 按左下侧白键 A3; 0: 按右上侧黑键 B♭3
    const lPress = pose.leftKeyPress ?? 0;
    const rPress = pose.rightKeyPress ?? 0;
    const dropA3 = Math.max(0, -keyShiftX); // 0 -> 1 当切换到 A3 白键时

    // 保持手部外侧近端与躯干边界 (x=2 / x=14) 无缝连通，同时手部底边控制在 y≈6.15–6.32，
    // 既让爪尖清晰触碰对应的 A3 白键 / B♭3 黑键 / B♭4 黑键顶端，又完整显露下方点亮的琴键本体与下沉动作：
    const handKeyH = 1.65;
    const targetLeftX = 1.68 - dropA3 * 0.68;
    const targetLeftW = 2.52 - dropA3 * 0.22;
    const targetLeftY = 4.18 + dropA3 * 0.14 + pose.bodyOffsetY + lPress * 0.34;

    const targetRightW = 2.38 + rPress * 0.1;
    const targetRightX = 12.18 - rPress * 0.18;
    const targetRightY = 4.16 + pose.bodyOffsetY + rPress * 0.36;

    return {
      h: hKey,
      left: {
        x: interpolate(hKey, [0, 1], [0, targetLeftX]),
        y: interpolate(hKey, [0, 1], [4 + pose.leftArmOffsetY, targetLeftY]),
        width: interpolate(hKey, [0, 1], [handWidth, targetLeftW]),
        height: interpolate(hKey, [0, 1], [2.0, handKeyH]),
      },
      right: {
        x: interpolate(hKey, [0, 1], [14, targetRightX]),
        y: interpolate(hKey, [0, 1], [4 + pose.rightArmOffsetY, targetRightY]),
        width: interpolate(hKey, [0, 1], [handWidth, targetRightW]),
        height: interpolate(hKey, [0, 1], [2.0, handKeyH]),
      },
    };
  }

  const leftX =
    hBook > 0
      ? interpolate(hBook, [0, 1], [0, 1.75])
      : Math.min(1.4, -pose.leftArmExtend);
  const leftOuterWidth =
    hBook > 0 ? handWidth : Math.max(0.6, 2 + pose.leftArmExtend);
  const leftY = interpolate(
    hBook,
    [0, 1],
    [4 + pose.leftArmOffsetY, 5.05 + pose.bodyOffsetY],
  );

  const rightOuterWidth =
    hBook > 0 ? handWidth : Math.max(0.6, 2 + pose.rightArmExtend);
  const rightX =
    hBook > 0
      ? interpolate(hBook, [0, 1], [14, 12.25])
      : 16 - rightOuterWidth;
  const rightY = interpolate(
    hBook,
    [0, 1],
    [4 + pose.rightArmOffsetY, 4.95 + 0.1 + pose.bodyOffsetY],
  );

  return {
    h: hBook,
    left: {
      x: leftX,
      y: leftY,
      width: leftOuterWidth,
      height: handHeight,
    },
    right: {
      x: rightX,
      y: rightY,
      width: rightOuterWidth,
      height: handHeight,
    },
  };
}

export const ClawdBody: React.FC<ClawdBodyProps> = ({
  pose,
  bodyColor,
  outlineColor,
  outlineWidth,
}) => {
  const {
    bodyOffsetX,
    bodyOffsetY,
    torsoTiltDeg,
    rotPivotX,
    legLifts,
    isAirborneAction,
    isStumbleHop,
    sweatDropsProgress,
  } = pose;

  const { armInset, hipInset, legBaseX } = CLAWD_MODEL.joints;
  const hands = computeHandBoxes(pose);
  const dab = pose.dabProgress ?? 0;

  // 位于躯干外侧 (x < 2 或 x > 14) 的手臂部分与躯干无缝融合，共享外轮廓
  const leftProtrudeX = Math.min(2, hands.left.x);
  const leftProtrudeW = Math.max(0, 2 - leftProtrudeX) + armInset;
  const rightProtrudeRight = Math.max(14, hands.right.x + hands.right.width);
  const rightProtrudeX = 14 - armInset;
  const rightProtrudeW = Math.max(0, rightProtrudeRight - 14) + armInset;

  const upperBodyTransform = `translate(${bodyOffsetX}, 0) rotate(${torsoTiltDeg}, ${rotPivotX}, 8)`;
  const tiltRad = (torsoTiltDeg * Math.PI) / 180;

  // Dab 姿势右侧伸直臂（向画面右上方斜伸，保持 Clawd 短萌手臂比例，与躯干无缝融合共享外轮廓）
  const dabRightAngle = interpolate(dab, [0, 1], [0, -34]);
  const dabRightLen = interpolate(dab, [0, 1], [2.0, 3.3]);
  const dabRightH = interpolate(dab, [0, 1], [2.0, 1.82]);
  const dabRightPivotY = 4.2 + bodyOffsetY;
  // Dab 时左臂收回并改由 ClawdHandsOverlay 渲染为斜跨脸前的弯臂
  const leftNormalScale = Math.max(0, 1 - dab * 2.2);

  const legConfigs = legBaseX.map((baseX, idx) => ({
    baseX,
    lift: legLifts[idx],
  }));

  const renderBodyParts = (fill: string, stroke?: string, strokeWidth = 0) => (
    <g
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    >
      {/* 上半身（躯干 + 伸出躯干外侧的手臂部分） */}
      <g transform={upperBodyTransform}>
        <rect x={2} y={bodyOffsetY} width={12} height={8} />
        {leftProtrudeW > armInset && leftNormalScale > 0.01 && (
          <rect
            x={2 - (2 - leftProtrudeX) * leftNormalScale}
            y={hands.left.y}
            width={(2 - leftProtrudeX) * leftNormalScale + armInset}
            height={hands.left.height}
          />
        )}
        {dab > 0.01 ? (
          <g transform={`rotate(${dabRightAngle}, ${14 - armInset}, ${dabRightPivotY})`}>
            <rect
              x={14 - armInset}
              y={dabRightPivotY - dabRightH * 0.5}
              width={dabRightLen + armInset}
              height={dabRightH}
            />
          </g>
        ) : (
          rightProtrudeW > armInset && (
            <rect
              x={rightProtrudeX}
              y={hands.right.y}
              width={rightProtrudeW}
              height={hands.right.height}
            />
          )
        )}
      </g>

      {/* 四条腿: 顶部髋锚点内嵌于倾斜躯干内部并随身体拉伸，底端足尖锚定地面 y=10 */}
      <g>
        {legConfigs.map(({ baseX, lift }) => {
          const cx = baseX + 0.5;
          const torsoBottomAtLeg =
            8 + bodyOffsetY + (cx - rotPivotX) * Math.tan(tiltRad);
          const hipY = torsoBottomAtLeg - hipInset;
          const footY = isAirborneAction
            ? 10 + Math.min(0, bodyOffsetY) - lift
            : 10 - lift;
          const isRightLeg = baseX >= 10;
          const hipX = isStumbleHop
            ? baseX
            : baseX + (isAirborneAction ? bodyOffsetX : bodyOffsetX * 0.78);
          const footX = isStumbleHop
            ? isRightLeg
              ? baseX + 0.35
              : baseX
            : baseX + (isAirborneAction ? bodyOffsetX : bodyOffsetX * 0.22);
          return (
            <polygon
              key={baseX}
              points={`${hipX},${hipY} ${hipX + 1},${hipY} ${footX + 1},${footY} ${footX},${footY}`}
            />
          );
        })}
      </g>
    </g>
  );

  return (
    <>
      {/* 第 1 层：无缝外轮廓层 */}
      {outlineWidth > 0 &&
        renderBodyParts(outlineColor, outlineColor, outlineWidth * 2)}

      {/* 第 2 层：实体填充层 */}
      {renderBodyParts(bodyColor)}

      {/* 踉跄慌乱时的汗滴特效 (stumble-left) */}
      {sweatDropsProgress !== null && (
        <g>
          {SWEAT_DROPS.map((d, i) => {
            const dp = Math.max(
              0,
              Math.min(1, (sweatDropsProgress - d.start) / (d.end - d.start)),
            );
            if (dp <= 0 || dp >= 1) return null;
            const x = d.baseX + bodyOffsetX + d.dx * dp;
            const y = d.baseY + bodyOffsetY + d.dy * dp * dp;
            const op = dp < 0.2 ? dp / 0.2 : dp > 0.75 ? (1 - dp) / 0.25 : 1;
            return (
              <g
                key={i}
                transform={`translate(${x}, ${y}) scale(${d.scale})`}
                opacity={op}
              >
                <path
                  d="M 0 -0.7 C 0.42 -0.1 0.52 0.35 0.52 0.62 A 0.52 0.52 0 1 1 -0.52 0.62 C -0.52 0.35 -0.42 -0.1 0 -0.7 Z"
                  fill={CLAWD_MODEL.colors.sweatFill}
                  stroke={outlineColor}
                  strokeWidth={0.18}
                />
                <circle
                  cx={-0.16}
                  cy={0.55}
                  r={0.14}
                  fill={CLAWD_MODEL.colors.sweatHighlight}
                />
              </g>
            );
          })}
        </g>
      )}
    </>
  );
};

/**
 * 当双手向胸前移动 (handHoldProgress > 0)、手部方块的远端越过躯干边界 (x=2 / x=14) 与主体/道具重合时：
 * - 重合区域保持 100% 实体橙色填充（绝不做透明度淡入）；
 * - 仅在与主体/书本重合的三条远端边（上、内侧远端、下）自然浮现轮廓边框，近端与躯干外侧突出部无缝连通！
 */
export const ClawdHandsOverlay: React.FC<ClawdBodyProps> = ({
  pose,
  bodyColor,
  outlineColor,
  outlineWidth,
}) => {
  const dab = pose.dabProgress ?? 0;
  const hands = computeHandBoxes(pose);
  if (hands.h <= 0.001 && dab <= 0.001) return null;

  const { bodyOffsetX, bodyOffsetY, torsoTiltDeg, rotPivotX } = pose;
  const upperBodyTransform = `translate(${bodyOffsetX}, 0) rotate(${torsoTiltDeg}, ${rotPivotX}, 8)`;
  const strokeW = Math.max(0.24, outlineWidth * 1.5);

  // L014 Superstar Dab：左前爪抬起并斜跨挡在脸前下方（缩短手臂保持短萌比例，100% 实体填充 + 深墨轮廓）
  if (dab > 0.001) {
    const armLen = interpolate(dab, [0, 1], [2.0, 4.2]);
    const armH = 1.76;
    const shoulderX = 1.95;
    const shoulderY = interpolate(dab, [0, 1], [4.9 + bodyOffsetY, 4.35 + bodyOffsetY]);
    const armAngle = interpolate(dab, [0, 1], [0, -20]);
    const x0 = shoulderX - 0.45 * dab;
    const x1 = shoulderX + armLen;
    const y0 = shoulderY - armH * 0.5;

    return (
      <g transform={upperBodyTransform}>
        <g transform={`rotate(${armAngle}, ${shoulderX}, ${shoulderY})`}>
          <rect
            x={x0}
            y={y0}
            width={x1 - x0}
            height={armH}
            fill={bodyColor}
            stroke={outlineColor}
            strokeWidth={strokeW}
            strokeLinejoin="round"
          />
        </g>
      </g>
    );
  }

  // 左手与主体 (x >= 2) 重合的远端区间 [leftOverlapX0, leftOverlapX1]
  const leftOverlapX0 = Math.max(2, hands.left.x);
  const leftOverlapX1 = hands.left.x + hands.left.width;
  const leftOverlapW = Math.max(0, leftOverlapX1 - leftOverlapX0);

  // 右手与主体 (x <= 14) 重合的远端区间 [rightOverlapX0, rightOverlapX1]
  const rightOverlapX0 = hands.right.x;
  const rightOverlapX1 = Math.min(14, hands.right.x + hands.right.width);
  const rightOverlapW = Math.max(0, rightOverlapX1 - rightOverlapX0);

  return (
    <g transform={upperBodyTransform}>
      {/* 左手：身体外侧无缝衔接段 + 躯干内侧重合描边段 */}
      <rect
        x={hands.left.x}
        y={hands.left.y}
        width={hands.left.width}
        height={hands.left.height}
        fill={bodyColor}
      />
      {leftOverlapW > 0.02 && (
        <path
          d={
            hands.left.x > 2.02
              ? `M ${leftOverlapX0} ${hands.left.y} H ${leftOverlapX1} V ${
                  hands.left.y + hands.left.height
                } H ${leftOverlapX0} Z`
              : `M ${leftOverlapX0} ${hands.left.y} H ${leftOverlapX1} V ${
                  hands.left.y + hands.left.height
                } H ${leftOverlapX0}`
          }
          fill="none"
          stroke={outlineColor}
          strokeWidth={strokeW}
          strokeLinecap="square"
          strokeLinejoin="round"
        />
      )}

      {/* 右手：身体外侧无缝衔接段 + 躯干内侧重合描边段 */}
      <rect
        x={hands.right.x}
        y={hands.right.y}
        width={hands.right.width}
        height={hands.right.height}
        fill={bodyColor}
      />
      {rightOverlapW > 0.02 && (
        <path
          d={
            hands.right.x + hands.right.width < 13.98
              ? `M ${rightOverlapX1} ${hands.right.y} H ${rightOverlapX0} V ${
                  hands.right.y + hands.right.height
                } H ${rightOverlapX1} Z`
              : `M ${rightOverlapX1} ${hands.right.y} H ${rightOverlapX0} V ${
                  hands.right.y + hands.right.height
                } H ${rightOverlapX1}`
          }
          fill="none"
          stroke={outlineColor}
          strokeWidth={strokeW}
          strokeLinecap="square"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
};
