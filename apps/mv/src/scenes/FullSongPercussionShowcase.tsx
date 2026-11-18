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
import { RhythmPopups, StageDeck } from "../components/environment";
import { FULL_SONG_DURATION_SEC } from "../timeline/score-drums-v2";

export const FULL_PERCUSSION_FPS = 30;
export const FULL_PERCUSSION_FRAMES = Math.ceil(
  FULL_SONG_DURATION_SEC * FULL_PERCUSSION_FPS,
); // 6292 帧 @ 30fps (209.72s 全曲)

export interface FullSongPercussionMVProps {
  /** 是否强制静音预览（未放置私有 FLAC 音源时也会自动降级为静音预览） */
  silentPreview?: boolean;
}

function hasPrivateAudio(): boolean {
  return getStaticFiles().some(
    (file) => file.name.replace(/\\/g, "/") === "private/audio/try-me.flac",
  );
}

/**
 * 全曲打击乐独立动画（严格对齐 `全曲鼓组 · 鼓谱修订 v2` 全曲 0.248s–206.879s 共 952 个点事件）：
 * - 包含 👏 Emoji 风格双手鼓掌、交叉鼓槌扁圆柱军鼓、双层合击踩镲/倾斜吊镲、带踏板槌头与圆形冲击波的正面底鼓；
 * - 任何 Composition（如 TryMeVerse1MV）只需延长时长并挂载 `<RhythmPopups sec={sec} />`，即可自动按时间轴演绎全曲打点。
 */
export const FullSongPercussionMV: React.FC<FullSongPercussionMVProps> = ({
  silentPreview = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
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
      {canPlayAudio && (
        <Html5Audio
          src={staticFile("private/audio/try-me.flac")}
          trimBefore={0}
        />
      )}

      <StageDeck clawdStageX={0} />
      <RhythmPopups sec={sec} />
    </AbsoluteFill>
  );
};

export const FullSongPercussionComposition: React.FC = () => {
  return (
    <Composition
      id="FullSongPercussion"
      component={FullSongPercussionMV}
      durationInFrames={FULL_PERCUSSION_FRAMES}
      fps={FULL_PERCUSSION_FPS}
      width={1280}
      height={720}
      defaultProps={{
        silentPreview: false,
      }}
    />
  );
};
