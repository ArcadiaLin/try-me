import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { resolveClawdPose } from "../../animation/clawd/blend";
import { clamp01 } from "../../animation/clawd/motion-style";
import {
  BookProp,
  CoffeeProp,
  DjBoothProp,
  JuggleProp,
  KeyboardProp,
  TrumpetProp,
} from "../props";
import { ClawdBody, ClawdHandsOverlay } from "./ClawdBody";
import { ClawdFace } from "./ClawdFace";
import { CLAWD_MODEL, getClawdViewBox } from "./model";
import { ClawdOutfitLayer, GlassesOutfit } from "./outfits";
import type { ClawdProps } from "./types";

const DEFAULT_LOOK_OFFSET = { x: 0, y: 0 };

/**
 * Clawd 像素角色组合组件：
 * 将身体 (ClawdBody)、五官视线 (ClawdFace)、外观服装 (outfits) 与手持道具 (props) 组装在 16×10 坐标系中。
 */
export const Clawd: React.FC<ClawdProps> = ({
  width = 320,
  pose: externalPose,
  action = "idle",
  actionProgress,
  eyes = "normal",
  mouth = "none",
  showTalkBubble = true,
  outfit = "none",
  prop = "none",
  glassesProgress = 0,
  bookProgress,
  trumpetProgress,
  keyboardState,
  beatPulse = 0,
  rhythm,
  bodyColor = CLAWD_MODEL.colors.body,
  eyeColor = CLAWD_MODEL.colors.eye,
  outlineColor = CLAWD_MODEL.colors.outline,
  outlineWidth = CLAWD_MODEL.defaultOutlineWidth,
  lookOffset = DEFAULT_LOOK_OFFSET,
  showGrid = false,
  autoBlink = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  const p =
    actionProgress !== undefined
      ? clamp01(actionProgress)
      : (timeSec / 3.0) % 1;

  const pose =
    externalPose ??
    resolveClawdPose({
      action,
      actionProgress,
      prop,
      bookProgress,
      trumpetProgress,
      keyboardState,
      beatPulse,
      rhythm,
      timeSec,
    });

  const { viewBoxWidth, viewBoxHeight, viewBoxString } = getClawdViewBox();
  const height = Math.round(width * (viewBoxHeight / viewBoxWidth));

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBoxString}
      style={{
        display: "block",
        overflow: "visible",
      }}
    >
      <g
        transform={`translate(${pose.stageOffsetX}, 0)`}
        style={{
          transformOrigin: "8px 10px",
          scale: `${pose.scaleX} ${pose.scaleY}`,
        }}
      >
        {/* 1–2 层：无缝外轮廓与实体填充身体、胸前内折线、踉跄汗滴 */}
        <ClawdBody
          pose={pose}
          bodyColor={bodyColor}
          outlineColor={outlineColor}
          outlineWidth={outlineWidth}
        />

        {/* 3–4 层：眼睛、视线、眨眼与嘴部表情 */}
        <ClawdFace
          pose={pose}
          action={action}
          eyes={eyes}
          mouth={mouth}
          showTalkBubble={showTalkBubble}
          outfit={outfit}
          prop={prop}
          eyeColor={eyeColor}
          lookOffset={lookOffset}
          autoBlink={autoBlink}
          timeSec={timeSec}
        />

        {/* L009–L010 中学生白反光眼镜 */}
        <GlassesOutfit pose={pose} glassesProgress={glassesProgress} />

        {/* 5 层：头饰、胡须、单片镜与项链配件 */}
        <ClawdOutfitLayer
          outfit={outfit}
          mouth={mouth}
          pose={pose}
          timeSec={timeSec}
        />

        {/* 6 层：手持与近身道具 */}
        {prop === "coffee" && (
          <CoffeeProp pose={pose} timeSec={timeSec} bodyColor={bodyColor} />
        )}
        {prop === "book" && (
          <BookProp
            pose={pose}
            bookProgress={bookProgress}
            outlineColor={outlineColor}
          />
        )}
        {prop === "keyboard" && (
          <KeyboardProp
            pose={pose}
            keyboardState={keyboardState}
            outlineColor={outlineColor}
          />
        )}
        {prop === "trumpet" && (
          <TrumpetProp
            pose={pose}
            progress={trumpetProgress !== undefined ? trumpetProgress : p}
            bodyColor={bodyColor}
          />
        )}
        {/* 当双手向胸前移动捧书、弹奏键盘或握持小号时，远端与主体/道具重合的手部色块与描边层 */}
        <ClawdHandsOverlay
          pose={pose}
          bodyColor={bodyColor}
          outlineColor={outlineColor}
          outlineWidth={outlineWidth}
        />
        {prop === "juggle" && (
          <JuggleProp pose={pose} timeSec={timeSec} bodyColor={bodyColor} />
        )}
        {prop === "dj" && (
          <DjBoothProp pose={pose} timeSec={timeSec} bodyColor={bodyColor} />
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
