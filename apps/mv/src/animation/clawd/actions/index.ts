import type { ClawdAction } from "../../../components/clawd/types.ts";
import type { ClawdPoseDelta } from "../poses.ts";
import { sampleLoopAction } from "./loop-actions.ts";
import { sampleReadLookUpAction } from "./read-look-up.ts";
import { sampleElasticPopAction, sampleSnappyNodAction } from "./snappy-nod.ts";
import {
  getStumbleLeftKinematics,
  sampleStumbleLeftAction,
} from "./stumble-left.ts";
import { sampleVerse1IntroAction } from "./verse1-intro.ts";

export { getStumbleLeftKinematics };

export function sampleClawdActionDelta(
  action: ClawdAction,
  p: number,
  timeSec: number,
  breathY: number,
): ClawdPoseDelta {
  switch (action) {
    case "static":
    case "idle":
    case "crouch":
    case "nod":
    case "walk":
    case "wave":
    case "bounce":
      return sampleLoopAction(action, timeSec, breathY);

    case "weight-shift":
    case "wave-step":
    case "tilt-invite":
    case "posture-nod":
    case "self-present":
    case "crouch-lean":
    case "peek-present":
      return sampleVerse1IntroAction(action, p, breathY);

    case "read-look-up":
      return sampleReadLookUpAction(p, breathY);

    case "elastic-pop":
      return sampleElasticPopAction(p, breathY);

    case "stumble-left":
      return sampleStumbleLeftAction(p, breathY);

    case "snappy-nod":
      return sampleSnappyNodAction(p, breathY);
  }
}
