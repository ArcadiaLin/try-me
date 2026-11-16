import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export type ClawdAction =
  | "static"
  | "idle"
  | "crouch"
  | "nod"
  | "walk"
  | "wave"
  | "bounce";

export type ClawdMouth = "none" | "smile" | "talk" | "yawn" | "blush";
export type ClawdOutfit = "none" | "swag" | "gentleman" | "party";
export type ClawdProp = "none" | "coffee" | "book" | "juggle" | "dj";

export interface ClawdMascotProps {
  /** 渲染宽度（像素），高度按比例自动计算 */
  width?: number;
  /** 预设肢体动作模式（包含极简纯肢体动作与进阶律动） */
  action?: ClawdAction;
  /** 嘴部与五官表情（无 / 像素微笑 / 说话方嘴 / 打哈欠 / 弯眼腮红） */
  mouth?: ClawdMouth;
  /** 换装造型（原版 / Superstar 潮人墨镜反戴帽 / 绅士高礼帽单片镜 / 派对尖顶帽） */
  outfit?: ClawdOutfit;
  /** 手持或场景道具（无 / 端咖啡 / 捧书阅读 / 杂耍抛球 / DJ 打碟台） */
  prop?: ClawdProp;
  /** 外部节拍脉冲强度 (0 ~ 1)，用于和音乐拍点同步弹跳 */
  beatPulse?: number;
  /** 身体主色（默认取自参考图 #D87757 陶土橙） */
  bodyColor?: string;
  /** 眼睛颜色（默认纯黑 #000000） */
  eyeColor?: string;
  /** 外轮廓描边颜色（默认深色描边 #11131F） */
  outlineColor?: string;
  /** 外轮廓描边宽度（以 16x10 网格单位计，设为 0 则关闭描边） */
  outlineWidth?: number;
  /** 眼神看向的偏移量（以网格为单位，范围约 -0.5 ~ 0.5） */
  lookOffset?: { x: number; y: number };
  /** 是否叠加显示 16x10 像素网格与坐标辅助线（教学/调试用） */
  showGrid?: boolean;
  /** 是否开启自动眨眼 */
  autoBlink?: boolean;
}

/**
 * Clawd 像素吉祥物组件（基于 16×10 正方形网格坐标系）
 *
 * 按由简入繁分为三阶能力：
 * - Tier 1 极简肢体动作 (action): idle(呼吸眨眼) / crouch(小幅蹲起) / nod(点头律动) / walk(四足小碎步) / wave(挥手) / bounce(弹跳)
 * - Tier 2 轻表情互动 (mouth):    none / smile(微笑) / talk(说话气泡) / yawn(打哈欠) / blush(弯眼腮红比心)
 * - Tier 3 换装与舞台道具:        outfit(swag/gentleman/party) + prop(book/coffee/juggle/dj)
 */
export const ClawdMascot: React.FC<ClawdMascotProps> = ({
  width = 320,
  action = "idle",
  mouth = "none",
  outfit = "none",
  prop = "none",
  beatPulse = 0,
  bodyColor = "#D87757",
  eyeColor = "#000000",
  outlineColor = "#11131F",
  outlineWidth = 0.18,
  lookOffset = { x: 0, y: 0 },
  showGrid = false,
  autoBlink = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  // 1. 整体呼吸 / 蹲起 / 弹跳位移与挤压拉伸 (Squash & Stretch)
  let bodyOffsetY = 0;
  let bodyOffsetX = 0;
  let scaleX = 1;
  let scaleY = 1;

  if (action === "idle") {
    bodyOffsetY = Math.sin(timeSec * Math.PI * 2) * 0.18;
  } else if (action === "crouch") {
    // 间奏小幅度蹲起（对应 L064 批注：周期性下蹲蓄力再回弹）
    const squatWave = Math.max(0, Math.sin(timeSec * Math.PI * 3.5));
    bodyOffsetY = squatWave * 0.65;
    scaleX = 1 + squatWave * 0.06;
    scaleY = 1 - squatWave * 0.06;
  } else if (action === "nod") {
    // 极简合成器律动：随节拍轻微左右摇摆+点头
    bodyOffsetY = Math.abs(Math.sin(timeSec * Math.PI * 3.56)) * 0.32;
    bodyOffsetX = Math.sin(timeSec * Math.PI * 1.78) * 0.25;
  } else if (action === "walk") {
    bodyOffsetY = Math.abs(Math.sin(timeSec * Math.PI * 6)) * -0.28;
  } else if (action === "wave") {
    bodyOffsetY = Math.sin(timeSec * Math.PI * 3) * 0.15;
  } else if (action === "bounce") {
    const phase = (timeSec * 2) % 1;
    const jumpArc = Math.sin(phase * Math.PI);
    bodyOffsetY = -jumpArc * 0.85;
    scaleX = phase < 0.12 ? 1.07 : 1 - jumpArc * 0.04;
    scaleY = phase < 0.12 ? 0.93 : 1 + jumpArc * 0.05;
  }

  if (prop === "dj") {
    bodyOffsetY = Math.abs(Math.sin(timeSec * Math.PI * 4)) * -0.26;
  }

  // 叠加外部音乐节拍脉冲 (beatPulse: 0 ~ 1)
  if (beatPulse > 0.01) {
    bodyOffsetY -= beatPulse * 0.55;
    scaleX *= 1 + beatPulse * 0.06;
    scaleY *= 1 - beatPulse * 0.04;
  }

  // 2. 双臂动作（以网格单位计算上下偏移或挥动）
  let leftArmOffsetY = bodyOffsetY;
  let rightArmOffsetY = bodyOffsetY;

  if (prop === "juggle") {
    leftArmOffsetY += Math.sin(timeSec * Math.PI * 6) * 0.35;
    rightArmOffsetY += Math.cos(timeSec * Math.PI * 6) * 0.35;
  } else if (prop === "dj") {
    leftArmOffsetY += Math.sin(timeSec * Math.PI * 8) * 0.22;
    rightArmOffsetY -= Math.sin(timeSec * Math.PI * 8) * 0.22;
  } else if (prop === "coffee") {
    const sipWave = Math.max(0, Math.sin(timeSec * Math.PI * 1.2));
    rightArmOffsetY += -0.25 - sipWave * 0.45;
  } else if (action === "crouch") {
    const squatWave = Math.max(0, Math.sin(timeSec * Math.PI * 3.5));
    leftArmOffsetY += -squatWave * 0.25;
    rightArmOffsetY += -squatWave * 0.25;
  } else if (action === "nod") {
    leftArmOffsetY += Math.sin(timeSec * Math.PI * 3.56) * 0.18;
    rightArmOffsetY -= Math.sin(timeSec * Math.PI * 3.56) * 0.18;
  } else if (action === "walk") {
    leftArmOffsetY += Math.sin(timeSec * Math.PI * 6) * 0.25;
    rightArmOffsetY -= Math.sin(timeSec * Math.PI * 6) * 0.25;
  } else if (action === "wave") {
    rightArmOffsetY += -0.65 + Math.sin(timeSec * Math.PI * 8) * 0.45;
    leftArmOffsetY += Math.sin(timeSec * Math.PI * 3) * 0.15;
  } else if (action === "bounce") {
    leftArmOffsetY += bodyOffsetY * 0.35;
    rightArmOffsetY += bodyOffsetY * 0.35;
  }

  // 3. 四条小短腿动作
  let leg1Height = 2;
  let leg2Height = 2;
  let leg3Height = 2;
  let leg4Height = 2;

  if (action === "crouch") {
    const shorten = Math.max(0, bodyOffsetY);
    leg1Height = 2 - shorten;
    leg2Height = 2 - shorten;
    leg3Height = 2 - shorten;
    leg4Height = 2 - shorten;
  } else if (action === "walk") {
    const stride = Math.sin(timeSec * Math.PI * 6);
    leg1Height = 2 - Math.max(0, stride) * 0.75;
    leg3Height = 2 - Math.max(0, stride) * 0.75;
    leg2Height = 2 - Math.max(0, -stride) * 0.75;
    leg4Height = 2 - Math.max(0, -stride) * 0.75;
  } else if (action === "bounce") {
    const lift = Math.max(0, -bodyOffsetY) * 0.35;
    leg1Height = 2 - lift;
    leg2Height = 2 - lift;
    leg3Height = 2 - lift;
    leg4Height = 2 - lift;
  }

  // 4. 自动眨眼与阅读视线控制
  let eyeScaleY = 1;
  if (autoBlink && action !== "static" && outfit !== "swag") {
    const blinkCycle = timeSec % 3.2;
    if (blinkCycle > 2.95 && blinkCycle < 3.11) {
      const blinkProgress = (blinkCycle - 2.95) / 0.16;
      eyeScaleY = interpolate(
        blinkProgress,
        [0, 0.5, 1],
        [1, 0.08, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      );
    }
  }

  const readingLookX =
    prop === "book" ? Math.sin(timeSec * Math.PI * 2.5) * 0.35 : 0;
  const readingLookY = prop === "book" ? 0.25 : 0;
  const nodLookY =
    action === "nod"
      ? Math.abs(Math.sin(timeSec * Math.PI * 3.56)) * 0.22
      : 0;

  const isHappyFlatEyes = mouth === "smile" && outfit === "none";
  const isYawnEyes = mouth === "yawn";
  const baseEyeHeight = isYawnEyes ? 0.38 : isHappyFlatEyes ? 1.15 : 2;
  const baseEyeWidth = isYawnEyes ? 1.65 : isHappyFlatEyes ? 1.55 : 1;

  const eyeHeight = baseEyeHeight * eyeScaleY;
  const eyeY =
    2 +
    bodyOffsetY +
    (2 - eyeHeight) / 2 +
    lookOffset.y +
    readingLookY +
    nodLookY;
  const leftEyeX =
    4 - (baseEyeWidth - 1) / 2 + lookOffset.x + readingLookX + bodyOffsetX;
  const rightEyeX =
    11 - (baseEyeWidth - 1) / 2 + lookOffset.x + readingLookX + bodyOffsetX;

  const padX = 3.2;
  const padTop = 3.8;
  const padBottom = 1.8;
  const viewBoxWidth = 16 + padX * 2;
  const viewBoxHeight = 10 + padTop + padBottom;
  const height = Math.round(width * (viewBoxHeight / viewBoxWidth));

  const overlap = 0.04;

  const renderBodyParts = (fill: string, stroke?: string, strokeWidth = 0) => (
    <g
      transform={`translate(${bodyOffsetX}, 0)`}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    >
      {/* 躯干主体: x=2..14 (w=12), y=0..8 (h=8) */}
      <rect x={2} y={bodyOffsetY} width={12} height={8} />
      {/* 左臂: x=0..2 (w=2), y=4..6 (h=2) */}
      <rect x={0} y={4 + leftArmOffsetY} width={2 + overlap} height={2} />
      {/* 右臂: x=14..16 (w=2), y=4..6 (h=2) */}
      <rect
        x={14 - overlap}
        y={4 + rightArmOffsetY}
        width={2 + overlap}
        height={2}
      />
      {/* 四条腿: x=3, 5, 10, 12 (w=1), y=8..10 (h=2) */}
      <rect
        x={3}
        y={8 + bodyOffsetY - overlap}
        width={1}
        height={leg1Height + overlap}
      />
      <rect
        x={5}
        y={8 + bodyOffsetY - overlap}
        width={1}
        height={leg2Height + overlap}
      />
      <rect
        x={10}
        y={8 + bodyOffsetY - overlap}
        width={1}
        height={leg3Height + overlap}
      />
      <rect
        x={12}
        y={8 + bodyOffsetY - overlap}
        width={1}
        height={leg4Height + overlap}
      />
    </g>
  );

  const talkOpen =
    mouth === "talk"
      ? 0.45 + Math.abs(Math.sin(timeSec * Math.PI * 9)) * 0.75
      : 0.9;

  const yawnOpen =
    mouth === "yawn"
      ? 0.6 + Math.abs(Math.sin(timeSec * Math.PI * 1.6)) * 1.45
      : 1.2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`${-padX} ${-padTop} ${viewBoxWidth} ${viewBoxHeight}`}
      style={{
        display: "block",
        overflow: "visible",
      }}
    >
      <g
        style={{
          transformOrigin: "8px 9px",
          scale: `${scaleX} ${scaleY}`,
        }}
      >
        {/* 第 1 层：无缝外轮廓层 */}
        {outlineWidth > 0 &&
          renderBodyParts(outlineColor, outlineColor, outlineWidth * 2)}

        {/* 第 2 层：橙色实体填充层 */}
        {renderBodyParts(bodyColor)}

        {/* 第 3 层：眼睛与墨镜 / 单片眼镜 / 弯眼笑脸 */}
        {outfit === "swag" ? (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            <rect x={2} y={1.55} width={12} height={0.5} fill="#14131D" />
            <rect x={2.7} y={1.9} width={3.4} height={1.85} fill="#14131D" />
            <rect x={3.25} y={2.25} width={0.55} height={0.55} fill="#FFFFFF" />
            <rect x={9.5} y={1.9} width={3.4} height={1.85} fill="#14131D" />
            <rect x={10.05} y={2.25} width={0.55} height={0.55} fill="#FFFFFF" />
          </g>
        ) : mouth === "blush" ? (
          /* Clawd idle-heart 弯弯笑眼 ^ ^ + 粉色腮红 */
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            <rect x={3.4} y={2.45} width={0.6} height={0.6} fill={eyeColor} />
            <rect x={4.0} y={1.85} width={0.6} height={0.6} fill={eyeColor} />
            <rect x={4.6} y={2.45} width={0.6} height={0.6} fill={eyeColor} />
            <rect x={10.8} y={2.45} width={0.6} height={0.6} fill={eyeColor} />
            <rect x={11.4} y={1.85} width={0.6} height={0.6} fill={eyeColor} />
            <rect x={12.0} y={2.45} width={0.6} height={0.6} fill={eyeColor} />
            <rect x={2.6} y={3.45} width={1.4} height={0.65} fill="#F48FB1" />
            <rect x={12.0} y={3.45} width={1.4} height={0.65} fill="#F48FB1" />
          </g>
        ) : (
          <g fill={eyeColor}>
            <rect
              x={leftEyeX}
              y={eyeY}
              width={baseEyeWidth}
              height={eyeHeight}
            />
            <rect
              x={rightEyeX}
              y={eyeY}
              width={
                outfit === "gentleman" ? baseEyeWidth * 0.75 : baseEyeWidth
              }
              height={
                outfit === "gentleman" ? eyeHeight * 0.75 : eyeHeight
              }
            />
          </g>
        )}

        {/* 第 4 层：嘴部表情与胡须 */}
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

        {(mouth === "smile" || mouth === "blush") && outfit !== "gentleman" && (
          /* Clawd 经典 3 段式像素微笑弧线 ‿ */
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`} fill="#000000">
            <rect x={6.4} y={3.55} width={0.65} height={0.65} />
            <rect x={7.05} y={4.15} width={1.9} height={0.65} />
            <rect x={8.95} y={3.55} width={0.65} height={0.65} />
          </g>
        )}

        {mouth === "blush" && (
          <g
            transform={`translate(${15.2 + bodyOffsetX}, ${-0.6 + Math.sin(timeSec * Math.PI * 3) * 0.4})`}
          >
            <path
              d="M 1.4 0.6 C 1.4 0, 0 0, 0 1.0 C 0 2.0, 1.4 2.6, 1.4 3.2 C 1.4 2.6, 2.8 2.0, 2.8 1.0 C 2.8 0, 1.4 0, 1.4 0.6 Z"
              fill="#E05252"
            />
            <rect x={0.45} y={0.65} width={0.4} height={0.4} fill="#FFFFFF" />
          </g>
        )}

        {mouth === "yawn" && (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            <rect
              x={6.6}
              y={3.2 + (2.0 - yawnOpen) / 2}
              width={2.8}
              height={yawnOpen}
              fill="#000000"
            />
            <text
              x={15.0}
              y={0.8 - ((timeSec * 0.7) % 1) * 1.6}
              fill="#93C5FD"
              fontSize={2.1}
              fontWeight="bold"
              fontFamily="monospace"
              opacity={1 - ((timeSec * 0.7) % 1) * 0.6}
            >
              Z
            </text>
            <text
              x={16.8}
              y={-0.6 - (((timeSec * 0.7 + 0.5) % 1) * 1.4)}
              fill="#93C5FD"
              fontSize={1.5}
              fontWeight="bold"
              fontFamily="monospace"
              opacity={1 - ((timeSec * 0.7 + 0.5) % 1) * 0.6}
            >
              z
            </text>
          </g>
        )}

        {mouth === "talk" && (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            {outfit !== "gentleman" && (
              <rect
                x={7.0}
                y={3.65 + (1.1 - talkOpen) / 2}
                width={2.0}
                height={talkOpen}
                fill="#000000"
              />
            )}
            <g
              transform={`translate(14.5, ${-1.8 + Math.sin(timeSec * Math.PI * 4) * 0.2})`}
            >
              <rect
                x={0}
                y={0}
                width={3.2}
                height={3.2}
                rx={0.4}
                fill="#FFFFFF"
                stroke="#11131F"
                strokeWidth={0.18}
              />
              <polygon points="0.4,3.1 -0.3,3.8 1.2,3.1" fill="#FFFFFF" />
              <rect x={1.35} y={0.55} width={0.45} height={1.35} fill="#000000" />
              <rect x={1.35} y={2.25} width={0.45} height={0.45} fill="#000000" />
            </g>
          </g>
        )}

        {/* 第 5 层：头饰与项链配件 (Outfit) */}
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

        {outfit === "gentleman" && (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            <rect x={1.1} y={-0.35} width={13.8} height={0.6} fill="#1E202B" />
            <rect x={3.2} y={-3.3} width={9.6} height={2.95} fill="#1E202B" />
            <rect x={3.2} y={-1.15} width={9.6} height={0.8} fill="#C93B3B" />
            <rect x={3.6} y={-3.0} width={1.8} height={0.25} fill="#94A3B8" />
          </g>
        )}

        {outfit === "party" && (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            <polygon points="8,-2.7 5.1,0.15 10.9,0.15" fill="#F5C542" />
            <polygon points="6.2,-0.9 9.8,-0.9 10.2,-0.45 5.8,-0.45" fill="#FFFFFF" />
            <rect x={7.5} y={-3.35} width={1.0} height={0.85} fill="#E04F4F" />
          </g>
        )}

        {/* 第 6 层：手持与场景道具 (Props) */}
        {prop === "coffee" && (
          <g transform={`translate(${14.3 + bodyOffsetX}, ${4.3 + rightArmOffsetY})`}>
            <rect
              x={0}
              y={0}
              width={2.6}
              height={2.3}
              fill="#F1F5F9"
              stroke="#94A3B8"
              strokeWidth={0.14}
            />
            <rect x={0.25} y={0.35} width={2.1} height={0.5} fill="#6B3E26" />
            <path
              d="M 2.6 0.55 H 3.15 V 1.65 H 2.6"
              fill="none"
              stroke="#CBD5E1"
              strokeWidth={0.28}
            />
            <rect
              x={0.8}
              y={-0.6 - ((timeSec * 1.5) % 1) * 0.9}
              width={0.4}
              height={0.4}
              fill="#E2E8F0"
              opacity={1 - ((timeSec * 1.5) % 1)}
            />
            <rect
              x={1.55}
              y={-0.4 - (((timeSec * 1.5 + 0.5) % 1) * 0.9)}
              width={0.4}
              height={0.4}
              fill="#E2E8F0"
              opacity={1 - ((timeSec * 1.5 + 0.5) % 1)}
            />
          </g>
        )}

        {prop === "book" && (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            <rect x={2.9} y={4.0} width={10.2} height={3.5} fill="#7C5236" />
            <rect x={3.3} y={4.25} width={4.5} height={2.95} fill="#F5F2EB" />
            <rect x={8.2} y={4.25} width={4.5} height={2.95} fill="#F5F2EB" />
            {[4.8, 5.5, 6.2].map((ly) => (
              <React.Fragment key={ly}>
                <rect x={3.8} y={ly} width={3.4} height={0.22} fill="#94A3B8" />
                <rect x={8.7} y={ly} width={3.4} height={0.22} fill="#94A3B8" />
              </React.Fragment>
            ))}
            <rect x={7.75} y={7.15} width={0.5} height={0.9} fill="#E04F4F" />
            <rect x={2.3} y={4.7} width={1.3} height={1.8} fill="#B85D3D" />
            <rect x={12.4} y={4.7} width={1.3} height={1.8} fill="#B85D3D" />
          </g>
        )}

        {prop === "juggle" && (
          <g>
            {[
              { color: "#F5C542", offset: 0 },
              { color: "#8EC5FC", offset: 0.333 },
              { color: "#E05A5A", offset: 0.666 },
            ].map((ball, idx) => {
              const t = (timeSec * 0.9 + ball.offset) % 1;
              const angle = t * Math.PI * 2;
              const bx = 8 + Math.cos(angle) * 6.8 + bodyOffsetX;
              const by =
                1.8 - Math.abs(Math.sin(angle)) * 3.2 + bodyOffsetY * 0.5;
              return (
                <g key={idx} transform={`translate(${bx}, ${by})`}>
                  <circle cx={0} cy={0} r={1.05} fill={ball.color} />
                  <rect
                    x={-0.45}
                    y={-0.55}
                    width={0.35}
                    height={0.35}
                    fill="#FFFFFF"
                  />
                </g>
              );
            })}
          </g>
        )}

        {prop === "dj" && (
          <g>
            <rect x={-1.8} y={6.2} width={19.6} height={4.5} fill="#585E74" />
            <rect x={-1.8} y={5.6} width={19.6} height={0.75} fill="#383C4C" />
            <ellipse cx={2.2} cy={5.8} rx={2.6} ry={1.45} fill="#1E202B" />
            <ellipse cx={2.2} cy={5.8} rx={1.1} ry={0.6} fill="#F4A2B8" />
            <ellipse cx={13.8} cy={5.8} rx={2.6} ry={1.45} fill="#1E202B" />
            <ellipse cx={13.8} cy={5.8} rx={1.1} ry={0.6} fill="#93C5FD" />
            <rect
              x={1.2}
              y={4.2 + leftArmOffsetY}
              width={2.2}
              height={1.6}
              fill={bodyColor}
            />
            <rect
              x={12.6}
              y={4.2 + rightArmOffsetY}
              width={2.2}
              height={1.6}
              fill={bodyColor}
            />
            <text
              x={8}
              y={8.6}
              textAnchor="middle"
              fill="#F5C542"
              fontSize={1.9}
              fontWeight="bold"
              fontFamily="monospace"
            >
              DJ
            </text>
            <rect x={-0.8} y={9.4} width={0.5} height={0.5} fill="#4ADE80" />
            <rect x={0.0} y={9.4} width={0.5} height={0.5} fill="#FACC15" />
            <rect x={0.8} y={9.4} width={0.5} height={0.5} fill="#F87171" />
            <rect x={14.7} y={9.4} width={0.5} height={0.5} fill="#4ADE80" />
            <rect x={15.5} y={9.4} width={0.5} height={0.5} fill="#FACC15" />
            <rect x={16.3} y={9.4} width={0.5} height={0.5} fill="#F87171" />
            {[
              { color: "#F5C542", delay: 0, dx: 15.2 },
              { color: "#F4A2B8", delay: 0.33, dx: 16.8 },
              { color: "#93C5FD", delay: 0.66, dx: 18.2 },
            ].map((note, idx) => {
              const p = (timeSec * 0.8 + note.delay) % 1;
              const ny = 4.2 - p * 5.2;
              return (
                <g
                  key={idx}
                  transform={`translate(${note.dx}, ${ny})`}
                  opacity={1 - p * 0.7}
                  fill={note.color}
                >
                  <rect x={0} y={0.8} width={0.8} height={0.7} />
                  <rect x={0.55} y={-0.5} width={0.3} height={1.4} />
                  <rect x={0.55} y={-0.5} width={0.75} height={0.35} />
                </g>
              );
            })}
          </g>
        )}
      </g>

      {/* 可选第 7 层：16×10 正方形像素网格 & 16×5 终端字符行辅助线 */}
      {showGrid && (
        <g pointerEvents="none">
          {Array.from({ length: 17 }).map((_, col) => (
            <line
              key={`v-${col}`}
              x1={col}
              y1={0}
              x2={col}
              y2={10}
              stroke="rgba(56, 189, 248, 0.35)"
              strokeWidth={col % 2 === 0 ? 0.05 : 0.025}
            />
          ))}
          {Array.from({ length: 11 }).map((_, row) => (
            <line
              key={`h-${row}`}
              x1={0}
              y1={row}
              x2={16}
              y2={row}
              stroke={
                row % 2 === 0
                  ? "rgba(250, 204, 21, 0.55)"
                  : "rgba(56, 189, 248, 0.28)"
              }
              strokeWidth={row % 2 === 0 ? 0.06 : 0.025}
            />
          ))}
          <rect
            x={0}
            y={0}
            width={16}
            height={10}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={0.07}
          />
        </g>
      )}
    </svg>
  );
};
