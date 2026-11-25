import { MyComposition } from "./Composition";
import { TryMeVerse1MVComposition } from "./scenes/TryMeVerse1MV";
import { FullSongPercussionComposition } from "./scenes/FullSongPercussionShowcase";
import { ClawdBasicComposition } from "./scenes/ClawdBasicShowcase";
import { ClawdVerse1BodyComposition } from "./scenes/ClawdVerse1BodyShowcase";
import { ClawdVerse1PropsComposition } from "./scenes/ClawdVerse1PropsShowcase";
import { ClawdPropsComposition } from "./scenes/ClawdPropsShowcase";
import { StageFxLabComposition } from "./scenes/StageFxLab";
import { ClawdMotionLabComposition } from "./scenes/ClawdMotionLab";
import { PreludeLabComposition } from "./scenes/PreludeLab";
import { ThinkDabLabComposition } from "./scenes/ThinkDabLab";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <TryMeVerse1MVComposition />
      <ThinkDabLabComposition />
      <PreludeLabComposition />
      <StageFxLabComposition />
      <ClawdMotionLabComposition />
      <FullSongPercussionComposition />
      <MyComposition />
      <ClawdBasicComposition />
      <ClawdVerse1BodyComposition />
      <ClawdVerse1PropsComposition />
      <ClawdPropsComposition />
    </>
  );
};
