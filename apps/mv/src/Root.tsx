import { MyComposition } from "./Composition";
import { TryMeVerse1MVComposition } from "./scenes/TryMeVerse1MV";
import { ClawdBasicComposition } from "./scenes/ClawdBasicShowcase";
import { ClawdVerse1BodyComposition } from "./scenes/ClawdVerse1BodyShowcase";
import { ClawdVerse1PropsComposition } from "./scenes/ClawdVerse1PropsShowcase";
import { ClawdPropsComposition } from "./scenes/ClawdPropsShowcase";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <TryMeVerse1MVComposition />
      <MyComposition />
      <ClawdBasicComposition />
      <ClawdVerse1BodyComposition />
      <ClawdVerse1PropsComposition />
      <ClawdPropsComposition />
    </>
  );
};
