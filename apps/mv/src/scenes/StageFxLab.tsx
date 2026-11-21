import { VIDEO_FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from "../video-spec";
import { withOutputCanvas } from "../components/OutputCanvas";
import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveClawdPose } from "../animation/clawd/blend";
import {
  applyHopToPose,
  laggedFollow,
  sampleHopTravel,
  type HopSpec,
} from "../animation/clawd/hop-travel";
import { Spotlight, STAGE_FLOOR_Y } from "../components/environment";
import {
  LabBackdrop,
  LabCaption,
  LabClawd,
  LabPointer,
} from "./lab/LabParts";

/**
 * 舞台效果样片：解释“聚光灯 / 追光”指什么，以及开场可用的几种灯光状态。
 * 仅供试看讨论，未接入 TryMeVerse1MV；所有数值为候选。
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function useLocalSec() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
}

const idlePose = (sec: number) => resolveClawdPose({ action: "idle", timeSec: sec });

/** 1. 现状：只有 StageDeck 的一层淡柔光 */
const SegCurrent: React.FC = () => {
  const t = useLocalSec();
  return (
    <AbsoluteFill>
      <LabBackdrop showGlow />
      <LabClawd x={0} pose={idlePose(t)} />
      <LabCaption
        tag="1 / 6 · 现状"
        title="现在舞台上只有一层很淡的柔光"
        lines={[
          "StageDeck 里有一层跟随 Clawd 的径向柔光，透明度约 11%，几乎看不出来。",
          "所以“把聚光灯招过来”目前在画面上没有对应的东西，需要新做。",
        ]}
      />
    </AbsoluteFill>
  );
};

/** 2. 聚光灯由哪几部分组成 */
const SegAnatomy: React.FC = () => {
  const t = useLocalSec();
  const iris = interpolate(t, [0.1, 0.7], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const labels = interpolate(t, [1.0, 1.4], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <LabBackdrop showGlow={false} />
      <Spotlight layer="floor" x={0} iris={iris} ambient={0.55} />
      <LabClawd x={0} pose={idlePose(t)} />
      <Spotlight layer="air" x={0} iris={iris} ambient={0.55} />
      <LabPointer fromX={900} fromY={120} toX={652} toY={40} label="灯具在画外上方（固定不动）" opacity={labels} />
      <LabPointer fromX={900} fromY={250} toX={700} toY={260} label="光束：很淡，只交代光从哪来" opacity={labels} />
      <LabPointer fromX={980} fromY={600} toX={780} toY={STAGE_FLOOR_Y} label="地面光圈：角色站在里面" opacity={labels} />
      <LabPointer fromX={330} fromY={600} toX={250} toY={480} label="光圈外：压暗" opacity={labels} />
      <LabCaption
        tag="2 / 6 · 说法"
        title="聚光灯 = 灯具 + 光束 + 地面光圈 + 其余压暗"
        lines={[
          "舞台上叫追光（follow spot）：一盏可转动的灯，打出一个圆形光圈跟着演员走。",
          "光圈移动时灯具不动，光束会跟着倾斜，所以能看出光是“被转过来”的。",
        ]}
      />
    </AbsoluteFill>
  );
};

/** 3. 演出前：光停在左侧空处 */
const SegParked: React.FC = () => {
  const t = useLocalSec();
  return (
    <AbsoluteFill>
      <LabBackdrop showGlow={false} />
      <Spotlight layer="floor" x={-400} iris={1} ambient={0.5} />
      <LabClawd x={0} pose={idlePose(t)} lookOffset={{ x: -0.3, y: 0 }} />
      <Spotlight layer="air" x={-400} iris={1} ambient={0.5} />
      <LabCaption
        tag="3 / 6 · 前奏状态（候选）"
        title="光停在舞台左侧空处，Clawd 在暗处"
        lines={[
          "对应 D026 的“原本照着角落”。压暗程度可调，这里是 50%，Clawd 仍看得清。",
          "注意：前奏有 18 秒，Clawd 一直在暗处弹琴，要试看会不会太闷。",
        ]}
      />
    </AbsoluteFill>
  );
};

/** 光被招来：-400 → 冲过头 +140 → 回到 +100 停住（秒数相对段落起点） */
export function summonedSpotX(t: number, t0: number) {
  return interpolate(
    t,
    [t0, t0 + 0.95, t0 + 1.3],
    [-400, 140, 100],
    { ...clamp, easing: Easing.inOut(Easing.cubic) },
  );
}

/** 4. 被招来：扫过 → 冲过头 → 停住 */
const SegSummon: React.FC = () => {
  const t = useLocalSec();
  const x = summonedSpotX(t, 0.6);
  return (
    <AbsoluteFill>
      <LabBackdrop showGlow={false} />
      <Spotlight layer="floor" x={x} iris={1} ambient={0.5} />
      <LabClawd x={0} pose={idlePose(t)} lookOffset={{ x: interpolate(t, [0.6, 1.4, 2.0], [-0.3, 0.1, 0.45], clamp), y: 0 }} />
      <Spotlight layer="air" x={x} iris={1} ambient={0.5} />
      <LabCaption
        tag="4 / 6 · L001 Hey"
        title="光被招来：扫过 Clawd，冲过头，停在右边"
        lines={[
          "光从左往右滑，过了中心还多走一点，再往回落一点停住。",
          "停住时 Clawd 只有一半在光里，这就是“他得自己追过去”的理由。",
        ]}
      />
    </AbsoluteFill>
  );
};

/** 5. 追光跟随：光带一点延迟跟着人走 */
const FOLLOW_HOPS: HopSpec[] = [
  { takeoffSec: 0.7, landSec: 0.9, toX: 45 },
  { takeoffSec: 1.1, landSec: 1.3, toX: 90 },
  { takeoffSec: 2.0, landSec: 2.22, toX: 20 },
  { takeoffSec: 2.42, landSec: 2.64, toX: -50 },
  { takeoffSec: 3.3, landSec: 3.5, toX: 0 },
];
const SegFollow: React.FC = () => {
  const t = useLocalSec();
  const hop = sampleHopTravel(t, 0, FOLLOW_HOPS);
  const spotX = laggedFollow((s) => sampleHopTravel(s, 0, FOLLOW_HOPS).x, t, 0.3);
  return (
    <AbsoluteFill>
      <LabBackdrop showGlow={false} />
      <Spotlight layer="floor" x={spotX} iris={1} ambient={0.5} />
      <LabClawd x={hop.x} pose={applyHopToPose(idlePose(t), hop)} />
      <Spotlight layer="air" x={spotX} iris={1} ambient={0.5} />
      <LabCaption
        tag="5 / 6 · 锁定后"
        title="追光：光跟人，慢半拍"
        lines={[
          "Clawd 进光之后，光改成跟随模式，约 0.3 秒延迟，像有人在后面推灯。",
          "这个延迟让观众看出光和人是两样东西。",
        ]}
      />
    </AbsoluteFill>
  );
};

/** 6. 收光 / 开光 */
const SegIris: React.FC = () => {
  const t = useLocalSec();
  const iris = interpolate(t, [0.4, 1.2, 1.8, 2.5], [1, 0, 0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const ambient = interpolate(t, [0.4, 1.2, 1.8, 2.5], [0.5, 0.82, 0.82, 0.5], clamp);
  return (
    <AbsoluteFill>
      <LabBackdrop showGlow={false} />
      <Spotlight layer="floor" x={0} iris={iris} ambient={ambient} />
      <LabClawd x={0} pose={idlePose(t)} />
      <Spotlight layer="air" x={0} iris={iris} ambient={ambient} />
      <LabCaption
        tag="6 / 6 · 可选"
        title="收光 / 开光"
        lines={[
          "光圈缩到没有再张开。可以留给 L064 钻进终端，或者段落切换。",
          "这次不要求使用，只是让你知道这盏灯还能做什么。",
        ]}
      />
    </AbsoluteFill>
  );
};

const SEGMENTS: { sec: number; C: React.FC; name: string }[] = [
  { sec: 3, C: SegCurrent, name: "1 现状" },
  { sec: 4, C: SegAnatomy, name: "2 聚光灯构成" },
  { sec: 3.5, C: SegParked, name: "3 光停在角落" },
  { sec: 4, C: SegSummon, name: "4 被招来" },
  { sec: 4.5, C: SegFollow, name: "5 追光跟随" },
  { sec: 3, C: SegIris, name: "6 收光开光" },
];

export const STAGE_FX_LAB_SEC = SEGMENTS.reduce((s, x) => s + x.sec, 0);

export const StageFxLab: React.FC = () => {
  const { fps } = useVideoConfig();
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0B11", overflow: "hidden" }}>
      {SEGMENTS.map(({ sec, C, name }) => {
        const start = from;
        from += Math.round(sec * fps);
        return (
          <Sequence key={name} name={name} from={start} durationInFrames={Math.round(sec * fps)}>
            <C />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const StageFxLabComposition: React.FC = () => (
  <Composition
    id="StageFxLab"
    component={StageFxLabOutput}
    durationInFrames={Math.round(STAGE_FX_LAB_SEC * VIDEO_FPS)}
    fps={VIDEO_FPS}
    width={VIDEO_WIDTH}
    height={VIDEO_HEIGHT}
  />
);

const StageFxLabOutput = withOutputCanvas(StageFxLab);
