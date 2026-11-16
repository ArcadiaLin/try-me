import { MyComposition } from "./Composition";
import { ClawdBasicComposition } from "./scenes/ClawdBasicShowcase";
import { ClawdVerse1BodyComposition } from "./scenes/ClawdVerse1BodyShowcase";
import { ClawdVerse1PropsComposition } from "./scenes/ClawdVerse1PropsShowcase";
import { ClawdPropsComposition } from "./scenes/ClawdPropsShowcase";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <ClawdBasicComposition />
      <ClawdVerse1BodyComposition />
      <ClawdVerse1PropsComposition />
      <ClawdPropsComposition />
    </>
  );
};
