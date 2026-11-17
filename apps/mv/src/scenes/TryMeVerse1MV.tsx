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
  RhythmPopups,
  StageDeck,
  Verse1Hud,
} from "../components/environment";
import {
  ExitTerminalPerformance,
  PlayTrumpetPerformance,
  ReadBookPerformance,
  resolveVerse1ClawdPerformance,
  SpeakLanguagesPerformance,
} from "../performances";
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

  // 1. 采样全局节拍律动
  const rhythm = rhythmMotion(
    sec,
    beatPosition(authoredFrame, VERSE1_RHYTHM.beatFrames),
  );

  // 2. 编排唯一 Clawd 实例的连续舞台位置与各段动作/视线/道具（含前奏弹奏小键盘）状态
  const { placement, actor } = resolveVerse1ClawdPerformance(
    sec,
    authoredFrame,
    rhythm,
  );

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

      {/* 舞台环境层：追光与固定稳固的舞台上沿（下方彻底留空） */}
      <StageDeck clawdStageX={placement.x} />

      {/* 舞台环境节奏弹出层：鼓掌、鼓组、镲片与 Bass 小图标随节奏弹出 */}
      <RhythmPopups sec={sec} />

      {/* 协同表演层：按时间区间安排背景、画外道具与多元素交互 */}
      <ReadBookPerformance sec={sec} />
      <ExitTerminalPerformance sec={sec} />
      <SpeakLanguagesPerformance sec={sec} />
      <PlayTrumpetPerformance sec={sec} />

      {/* 全程唯一的连续 Clawd 主角实例（绝不卸载或突变尺寸） */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 162,
          transform: `translateX(-50%) translateX(${placement.x}px) translateY(${placement.y}px) scale(${placement.scale})`,
          transformOrigin: "bottom center",
          opacity: placement.opacity,
          zIndex: placement.zIndex,
        }}
      >
        <Clawd
          width={310}
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
