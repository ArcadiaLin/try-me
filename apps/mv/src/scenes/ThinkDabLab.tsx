import React from "react";
import { Composition } from "remotion";
import { withOutputCanvas } from "../components/OutputCanvas";
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "../video-spec";
import { TryMeVerse1MV, type TryMeVerse1MVProps } from "./TryMeVerse1MV";

/**
 * L065 收尾 (52.50s) → L013 闭眼深呼吸思考气泡 → L014 Superstar 卡点 Dab → L069 (62.70s)
 * 局部快速循环试看样片（直接复用 TryMeVerse1MV 编排与私有音轨，便于听辨卡点）。
 */
export const THINK_DAB_LAB_START_SEC = 52.5;
export const THINK_DAB_LAB_END_SEC = 62.7;
export const THINK_DAB_LAB_FRAMES = Math.round(
  (THINK_DAB_LAB_END_SEC - THINK_DAB_LAB_START_SEC) * VIDEO_FPS,
);

const ThinkDabLabScene: React.FC<Omit<TryMeVerse1MVProps, "startSec">> = (
  props,
) => {
  return <TryMeVerse1MV {...props} startSec={THINK_DAB_LAB_START_SEC} />;
};

const ThinkDabLabOutput = withOutputCanvas(ThinkDabLabScene);

export const ThinkDabLabComposition: React.FC = () => {
  return (
    <Composition
      id="ThinkDabLab"
      component={ThinkDabLabOutput}
      durationInFrames={THINK_DAB_LAB_FRAMES}
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
