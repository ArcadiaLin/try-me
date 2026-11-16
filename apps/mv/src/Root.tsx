import { MyComposition } from "./Composition";
import { ClawdBasicComposition } from "./scenes/ClawdBasicShowcase";
import { ClawdPropsComposition } from "./scenes/ClawdPropsShowcase";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <ClawdBasicComposition />
      <ClawdPropsComposition />
    </>
  );
};
