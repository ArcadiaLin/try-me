import React from "react";
import { interpolate } from "remotion";
import { CLAWD_MODEL } from "./model";
import type {
  ClawdAction,
  ClawdEyes,
  ClawdMouth,
  ClawdOutfit,
  ClawdPose,
  ClawdProp,
} from "./types";

export interface ClawdFaceProps {
  pose: ClawdPose;
  action: ClawdAction;
  eyes: ClawdEyes;
  mouth: ClawdMouth;
  showTalkBubble: boolean;
  outfit: ClawdOutfit;
  prop: ClawdProp;
  eyeColor: string;
  lookOffset: { x: number; y: number };
  autoBlink: boolean;
  timeSec: number;
}

export const ClawdFace: React.FC<ClawdFaceProps> = ({
  pose,
  action,
  eyes,
  mouth,
  showTalkBubble,
  outfit,
  prop,
  eyeColor,
  lookOffset,
  autoBlink,
  timeSec,
}) => {
  const { bodyOffsetX, bodyOffsetY, torsoTiltDeg, rotPivotX, actionLook } =
    pose;

  // 1. 自动眨眼
  let eyeScaleY = 1;
  if (autoBlink && action !== "static" && outfit !== "swag") {
    const blinkCycle = timeSec % 3.2;
    if (blinkCycle > 2.95 && blinkCycle < 3.11) {
      const blinkProgress = (blinkCycle - 2.95) / 0.16;
      eyeScaleY = interpolate(blinkProgress, [0, 0.5, 1], [1, 0.08, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
  }

  // 2. 视线合成（含读书视线与点头微视线）
  const readingLookX =
    prop === "book" && action !== "read-look-up"
      ? Math.sin(timeSec * Math.PI * 2.5) * 0.35
      : 0;
  const readingLookY =
    prop === "book" && action !== "read-look-up" ? 0.25 : 0;
  const nodLookY =
    action === "nod"
      ? Math.abs(Math.sin(timeSec * Math.PI * 3.56)) * 0.22
      : 0;

  const isHappyFlatEyes = mouth === "smile" && outfit === "none";
  const isYawnEyes = mouth === "yawn";
  const baseEyeHeight = isYawnEyes
    ? CLAWD_MODEL.eyes.yawnHeight
    : isHappyFlatEyes
      ? CLAWD_MODEL.eyes.happyFlatHeight
      : CLAWD_MODEL.eyes.normalHeight;
  const baseEyeWidth = isYawnEyes
    ? CLAWD_MODEL.eyes.yawnWidth
    : isHappyFlatEyes
      ? CLAWD_MODEL.eyes.happyFlatWidth
      : CLAWD_MODEL.eyes.normalWidth;

  const eyeHeight = baseEyeHeight * eyeScaleY;
  const eyeY =
    2 +
    bodyOffsetY +
    (2 - eyeHeight) / 2 +
    lookOffset.y +
    actionLook.y +
    readingLookY +
    nodLookY;
  const leftEyeX =
    4 -
    (baseEyeWidth - 1) / 2 +
    lookOffset.x +
    actionLook.x +
    readingLookX +
    bodyOffsetX;
  const rightEyeX =
    11 -
    (baseEyeWidth - 1) / 2 +
    lookOffset.x +
    actionLook.x +
    readingLookX +
    bodyOffsetX;

  const talkOpen =
    mouth === "talk"
      ? 0.45 + Math.abs(Math.sin(timeSec * Math.PI * 9)) * 0.75
      : 0.9;
  const yawnOpen =
    mouth === "yawn"
      ? 0.6 + Math.abs(Math.sin(timeSec * Math.PI * 1.6)) * 1.45
      : 1.2;

  return (
    <>
      {/* 眼部与表情符号层 */}
      {outfit === "swag" ? (
        <g
          transform={`translate(${bodyOffsetX}, ${bodyOffsetY}) rotate(${torsoTiltDeg}, 8, 8)`}
        >
          <rect x={2} y={1.55} width={12} height={0.5} fill="#14131D" />
          <rect x={2.7} y={1.9} width={3.4} height={1.85} fill="#14131D" />
          <rect x={3.25} y={2.25} width={0.55} height={0.55} fill="#FFFFFF" />
          <rect x={9.5} y={1.9} width={3.4} height={1.85} fill="#14131D" />
          <rect x={10.05} y={2.25} width={0.55} height={0.55} fill="#FFFFFF" />
        </g>
      ) : mouth === "blush" || eyes === "happy" ? (
        <g
          transform={`translate(${bodyOffsetX}, ${bodyOffsetY}) rotate(${torsoTiltDeg}, 8, 8)`}
        >
          <rect x={3.4} y={2.45} width={0.6} height={0.6} fill={eyeColor} />
          <rect x={4.0} y={1.85} width={0.6} height={0.6} fill={eyeColor} />
          <rect x={4.6} y={2.45} width={0.6} height={0.6} fill={eyeColor} />
          <rect x={10.8} y={2.45} width={0.6} height={0.6} fill={eyeColor} />
          <rect x={11.4} y={1.85} width={0.6} height={0.6} fill={eyeColor} />
          <rect x={12.0} y={2.45} width={0.6} height={0.6} fill={eyeColor} />
          {mouth === "blush" && (
            <>
              <rect
                x={2.6}
                y={3.45}
                width={1.4}
                height={0.65}
                fill={CLAWD_MODEL.colors.blush}
              />
              <rect
                x={12.0}
                y={3.45}
                width={1.4}
                height={0.65}
                fill={CLAWD_MODEL.colors.blush}
              />
            </>
          )}
        </g>
      ) : eyes === "wince" ? (
        <g
          transform={`translate(${bodyOffsetX}, ${bodyOffsetY}) rotate(${torsoTiltDeg}, ${rotPivotX}, 8)`}
          fill="none"
          stroke={eyeColor}
          strokeWidth={0.58}
          strokeLinecap="square"
          strokeLinejoin="miter"
        >
          <polyline points="3.15,1.75 4.75,2.6 3.15,3.45" />
          <polyline points="12.85,1.75 11.25,2.6 12.85,3.45" />
        </g>
      ) : (
        <g
          transform={`rotate(${torsoTiltDeg}, ${rotPivotX + bodyOffsetX}, 8)`}
          fill={eyeColor}
        >
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
            height={outfit === "gentleman" ? eyeHeight * 0.75 : eyeHeight}
          />
        </g>
      )}

      {/* 嘴部表情 */}
      {(mouth === "smile" || mouth === "blush") && outfit !== "gentleman" && (
        <g
          transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}
          fill="#000000"
        >
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
          {showTalkBubble && (
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
              <rect
                x={1.35}
                y={0.55}
                width={0.45}
                height={1.35}
                fill="#000000"
              />
              <rect
                x={1.35}
                y={2.25}
                width={0.45}
                height={0.45}
                fill="#000000"
              />
            </g>
          )}
        </g>
      )}
    </>
  );
};
