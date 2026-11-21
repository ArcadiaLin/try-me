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
import { Clawd } from "../components/clawd/Clawd";
import {
  LyricTerminal,
  NoteHighway,
  RhythmPopups,
  Spotlight,
  StageDeck,
  StageTrapdoor,
  Verse1Hud,
} from "../components/environment";
import {
  ExitTerminalPerformance,
  HeyBubblePerformance,
  PlayTrumpetPerformance,
  ReadBookPerformance,
  resolveVerse1ClawdPerformance,
  SpeakLanguagesPerformance,
  VERSE1_BASS_IN_SEC,
  VERSE1_HIGHWAY_CLOSE_SEC,
  VERSE1_PRELUDE_SIDE_X,
} from "../performances";
import {
  INTRO_KEYBOARD_GRID_LINES,
  INTRO_KEYBOARD_NOTES,
} from "../timeline/rhythm-timing";
import {
  beatPosition,
  rhythmMotion,
  VERSE1_MV_DURATION_SEC,
  VERSE1_MV_FPS,
  VERSE1_MV_FRAMES,
  VERSE1_RHYTHM,
} from "../timeline/verse1";

export { VERSE1_MV_DURATION_SEC, VERSE1_MV_FPS, VERSE1_MV_FRAMES };

export interface TryMeVerse1MVProps {
  /** 是否强制静音预览（未放置私有 FLAC 音源时也会自动降级为静音预览） */
  silentPreview?: boolean;
  /** 是否显示底部调试栏（默认关闭，保持舞台下方干净留空） */
  showHud?: boolean;
}

function hasPrivateAudio(): boolean {
  return getStaticFiles().some(
    (file) => file.name.replace(/\\/g, "/") === "private/audio/try-me.flac",
  );
}

export const TryMeVerse1MV: React.FC<TryMeVerse1MVProps> = ({
  silentPreview = false,
  showHud = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const authoredFrame = (frame * VERSE1_RHYTHM.fps) / fps;
  const beatPos = beatPosition(authoredFrame, VERSE1_RHYTHM.beatFrames);

  // 1. 采样全局节拍律动
  const rhythm = rhythmMotion(sec, beatPos);

  // 2. 编排唯一 Clawd 实例的连续舞台位置、各段动作/视线/道具、聚光灯与台面小洞状态
  const { placement, actor, spotlight, trapdoor } =
    resolveVerse1ClawdPerformance(sec, authoredFrame, rhythm);

  const canPlayAudio = !silentPreview && hasPrivateAudio();

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 44%, #1E1C2A 0%, #12111A 68%, #0B0B11 100%)",
        color: "#F8FAFC",
        fontFamily:
          '"Inter", "Noto Sans SC", "Hiragino Sans", "Microsoft YaHei", sans-serif',
        overflow: "hidden",
      }}
    >
      {/* 私有音源同步播放 */}
      {canPlayAudio && (
        <Html5Audio
          src={staticFile("private/audio/try-me.flac")}
          trimBefore={0}
        />
      )}

      {/* 舞台环境层：追光与固定稳固的舞台上沿 */}
      <StageDeck clawdStageX={placement.x} />

      {/* 舞台底部终端：歌词 stdout 逐句打印上滚，Clawd 站在终端顶边 */}
      <LyricTerminal frame={frame} fps={fps} beatPos={beatPos} />

      {/* 左侧台面小洞（L064 退场入口，层级高于台面上沿） */}
      <AbsoluteFill style={{ zIndex: 4, pointerEvents: "none" }}>
        <StageTrapdoor
          x={trapdoor.x}
          open={trapdoor.open}
          sinceEnter={trapdoor.sinceEnter}
        />
      </AbsoluteFill>

      {/* 地面聚光灯圈 */}
      <Spotlight layer="floor" {...spotlight} />

      {/* 前奏中央 4 轨透视下落谱面（第 3 轨留空，bass 切入升级，18.47s 收回终端） */}
      <NoteHighway
        sec={sec}
        notes={INTRO_KEYBOARD_NOTES}
        gridLines={INTRO_KEYBOARD_GRID_LINES}
        openSec={0}
        levelUpSec={VERSE1_BASS_IN_SEC}
        closeSec={VERSE1_HIGHWAY_CLOSE_SEC}
      />

      {/* 舞台环境节奏弹出层：鼓掌、鼓组、镲片与 Bass 小图标随节奏弹出 */}
      <RhythmPopups sec={sec} />

      {/* 协同表演层：按时间区间安排背景、画外道具与多元素交互 */}
      <HeyBubblePerformance sec={sec} offsetX={VERSE1_PRELUDE_SIDE_X} />
      <ReadBookPerformance sec={sec} />
      <ExitTerminalPerformance sec={sec} />
      <SpeakLanguagesPerformance sec={sec} />
      <PlayTrumpetPerformance sec={sec} />

      {/* 全程唯一的连续 Clawd 主角实例（绝不卸载或突变尺寸；跳进洞口时裁切台面以下身体） */}
      <AbsoluteFill
        style={{
          zIndex: placement.zIndex,
          clipPath: placement.clipPath,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 162,
            transform: `translateX(-50%) translateX(${placement.x}px) translateY(${placement.y}px) scale(${placement.scale})`,
            transformOrigin: "bottom center",
            opacity: placement.opacity,
          }}
        >
          <Clawd
            width={310}
            pose={actor.pose}
            action={actor.action}
            actionProgress={actor.actionProgress}
            eyes={actor.eyes}
            mouth="none"
            outfit="none"
            prop={actor.prop}
            glassesProgress={actor.glassesProgress}
            bookProgress={actor.bookProgress}
            trumpetProgress={actor.trumpetProgress}
            keyboardState={actor.keyboardState}
            beatPulse={actor.beatPulse}
            rhythm={rhythm}
            lookOffset={actor.lookOffset}
          />
        </div>
      </AbsoluteFill>

      {/* 聚光灯空气光束与场内压暗遮罩（L064 跳洞后张开消散，L005 起完全回归初版全场光） */}
      <AbsoluteFill style={{ zIndex: 6, pointerEvents: "none" }}>
        <Spotlight layer="air" {...spotlight} />
      </AbsoluteFill>

      {/* 可选调试栏（默认关闭） */}
      {showHud && <Verse1Hud sec={sec} frame={frame} />}
    </AbsoluteFill>
  );
};

export const TryMeVerse1MVComposition: React.FC = () => {
  return (
    <Composition
      id="TryMeVerse1MV"
      component={TryMeVerse1MV}
      durationInFrames={VERSE1_MV_FRAMES}
      fps={VERSE1_MV_FPS}
      width={1280}
      height={720}
      defaultProps={{
        silentPreview: false,
        showHud: false,
      }}
    />
  );
};
