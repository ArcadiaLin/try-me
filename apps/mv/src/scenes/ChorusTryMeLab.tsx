import React from "react";
import { Composition } from "remotion";
import { withOutputCanvas } from "../components/OutputCanvas";
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "../video-spec";
import { TryMeVerse1MV, type TryMeVerse1MVProps } from "./TryMeVerse1MV";

/**
 * L014 Dab 收尾 (60.85s) → L069 间奏 → L015 副歌开场 (62.689s–64.982s)
 * 局部快速循环试看样片（复用 TryMeVerse1MV 完整舞台与私有音轨，便于直接听辨 L015 两声 Try me! 卡点）。
 */
export const CHORUS_TRYME_LAB_START_SEC = 60.85;
export const CHORUS_TRYME_LAB_END_SEC = 65.1;
export const CHORUS_TRYME_LAB_FRAMES = Math.round(
  (CHORUS_TRYME_LAB_END_SEC - CHORUS_TRYME_LAB_START_SEC) * VIDEO_FPS,
);

const ChorusTryMeLabScene: React.FC<Omit<TryMeVerse1MVProps, "startSec">> = (
  props,
) => {
  return <TryMeVerse1MV {...props} startSec={CHORUS_TRYME_LAB_START_SEC} />;
};

const ChorusTryMeLabOutput = withOutputCanvas(ChorusTryMeLabScene);

export const ChorusTryMeLabComposition: React.FC = () => {
  return (
    <Composition
      id="ChorusTryMeLab"
      component={ChorusTryMeLabOutput}
      durationInFrames={CHORUS_TRYME_LAB_FRAMES}
      fps={VIDEO_FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      defaultProps={{
        silentPreview: false,
        showHud: false,
      }}
    />
  );
};
