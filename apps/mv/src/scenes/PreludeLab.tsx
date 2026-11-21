import React from "react";
import {
  AbsoluteFill,
  Composition,
  getStaticFiles,
  Html5Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  LyricTerminal,
  NoteHighway,
  RhythmPopups,
  Spotlight,
  StageTrapdoor,
} from "../components/environment";
import {
  ExitTerminalPerformance,
  HeyBubblePerformance,
  IntroSpotlightPerformance,
  resolveVerse1ClawdPerformance,
  VERSE1_BASS_IN_SEC,
  VERSE1_HIGHWAY_CLOSE_SEC,
  VERSE1_PRELUDE_SIDE_X,
} from "../performances";
import {
  INTRO_KEYBOARD_GRID_LINES,
  INTRO_KEYBOARD_NOTES,
} from "../timeline/rhythm-timing";
import { beatPosition, rhythmMotion, VERSE1_RHYTHM } from "../timeline/verse1";
import { LabBackdrop, LabCaption, LabClawd, LabReadout } from "./lab/LabParts";

/**
 * 前奏样片 B（0–38.6s）：
 * 直接复用主合成 `resolveVerse1ClawdPerformance` 的编排输出，叠加样片说明卡片与实时坐标读数。
 */
export const PRELUDE_SIDE_X = VERSE1_PRELUDE_SIDE_X;

export interface PreludeLabProps {
  silentPreview?: boolean;
  /** 前奏期间整体压暗 (0 ~ 1)；0 表示和现在一样亮 */
  preludeAmbient?: number;
  /** 聚光期间光圈外的压暗 */
  spotAmbient?: number;
  showCaption?: boolean;
  showRhythmPopups?: boolean;
}

function hasPrivateAudio(): boolean {
  return getStaticFiles().some(
    (file) => file.name.replace(/\\/g, "/") === "private/audio/try-me.flac",
  );
}

export const PreludeLab: React.FC<PreludeLabProps> = ({
  silentPreview = false,
  preludeAmbient = 0.12,
  spotAmbient = 0.5,
  showCaption = true,
  showRhythmPopups = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const authoredFrame = sec * VERSE1_RHYTHM.fps;
  const beatPos = beatPosition(authoredFrame, VERSE1_RHYTHM.beatFrames);
  const rhythm = rhythmMotion(sec, beatPos);

  const { placement, actor, spotlight, trapdoor } =
    resolveVerse1ClawdPerformance(sec, authoredFrame, rhythm, {
      preludeAmbient,
      spotAmbient,
    });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0B11", overflow: "hidden" }}>
      {!silentPreview && hasPrivateAudio() && (
        <Html5Audio
          src={staticFile("private/audio/try-me.flac")}
          trimBefore={0}
        />
      )}
      <LabBackdrop showGlow glowX={placement.x} />
      <LyricTerminal frame={frame} fps={fps} beatPos={beatPos} />
      <AbsoluteFill style={{ zIndex: 4 }}>
        <StageTrapdoor
          x={trapdoor.x}
          open={trapdoor.open}
          sinceEnter={trapdoor.sinceEnter}
        />
      </AbsoluteFill>
      <Spotlight layer="floor" {...spotlight} />
      <NoteHighway
        sec={sec}
        notes={INTRO_KEYBOARD_NOTES}
        gridLines={INTRO_KEYBOARD_GRID_LINES}
        openSec={0}
        levelUpSec={VERSE1_BASS_IN_SEC}
        closeSec={VERSE1_HIGHWAY_CLOSE_SEC}
      />
      {showRhythmPopups && <RhythmPopups sec={sec} />}
      <ExitTerminalPerformance sec={sec} />
      <HeyBubblePerformance sec={sec} offsetX={VERSE1_PRELUDE_SIDE_X} />
      <IntroSpotlightPerformance
        sec={sec}
        clawdX={placement.x}
        layer="behind"
      />
      <IntroSpotlightPerformance
        sec={sec}
        clawdX={placement.x}
        layer="front"
      />
      <AbsoluteFill
        style={{
          zIndex: placement.zIndex,
          clipPath: placement.clipPath,
        }}
      >
        <LabClawd
          x={placement.x}
          y={placement.y}
          scale={placement.scale}
          opacity={placement.opacity}
          zIndex={placement.zIndex}
          pose={actor.pose}
          eyes={actor.eyes}
          extra={{
            prop: actor.prop,
            keyboardState: actor.keyboardState,
            rhythm,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ zIndex: 6 }}>
        <Spotlight layer="air" {...spotlight} />
      </AbsoluteFill>
      {showCaption && (
        <AbsoluteFill style={{ zIndex: 7 }}>
          <LabCaption
            tag="PreludeLab · B 方案（与 TryMeVerse1MV 共用同一编排管线）"
            title="侧边弹琴 + 透视谱面 → 光打到身上 → 进中央 → 跳进台面小洞"
            lines={[
              "聚光维持到 L004；L064 前半段蹲起，左侧台面滑开小洞，Clawd 一跳一扎挥手掉进去。",
              "掉进去后光束两侧张开，回到初版舞台光；37.54s 起接现有终端亮相。",
            ]}
          />
          <LabReadout
            rows={[
              ["song", `${sec.toFixed(2)} s`],
              ["Clawd x", `${placement.x.toFixed(0)} px`],
            ]}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const PRELUDE_LAB_SEC = 38.6;

export const PreludeLabComposition: React.FC = () => (
  <Composition
    id="PreludeLab"
    component={PreludeLab}
    durationInFrames={Math.round(PRELUDE_LAB_SEC * 30)}
    fps={30}
    width={1280}
    height={720}
    defaultProps={{
      silentPreview: false,
      preludeAmbient: 0.12,
      spotAmbient: 0.5,
      showCaption: true,
      showRhythmPopups: true,
    }}
  />
);
