import { VIDEO_FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from "../video-spec";
import { withOutputCanvas } from "../components/OutputCanvas";
import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  getStaticFiles,
  Html5Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveClawdPose } from "../animation/clawd/blend";
import {
  applyHopToPose,
  laggedFollow,
  sampleHopTravel,
  type HopPhase,
  type HopSpec,
} from "../animation/clawd/hop-travel";
import type { ClawdPose } from "../components/clawd/types";
import { LyricTerminal, Spotlight } from "../components/environment";
import { HeyBubblePerformance, resolveVerse1ClawdPerformance } from "../performances";
import {
  beatPosition,
  rhythmMotion,
  VERSE1_RHYTHM,
} from "../timeline/verse1";
import {
  Footprints,
  LabBackdrop,
  LabCaption,
  LabClawd,
  LabReadout,
  MicProp,
} from "./lab/LabParts";
import { summonedSpotX } from "./StageFxLab";

/**
 * Clawd 动作样片：L001 聚光灯滑过头后，Clawd 怎样“追进光里”，以及 L002 怎样回到中央。
 * 仅供试看讨论，未接入 TryMeVerse1MV；时间点为候选（拍点来自未确认小节首拍的候选网格）。
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function useLocalSec() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
}

const idlePose = (sec: number) => resolveClawdPose({ action: "idle", timeSec: sec });

const PHASE_LABEL: Record<HopPhase, string> = {
  stand: "站稳（脚锁定）",
  load: "① 预备下压，身体朝前进方向探",
  air: "② 四脚离地，只有这时水平移动",
  land: "③ 落地缓冲，脚立刻锁定",
};

/** A. 原地探身（不位移，备选） */
const SegLean: React.FC = () => {
  const t = useLocalSec();
  const spotX = interpolate(
    t,
    [0.4, 1.35, 1.7, 2.5, 3.1],
    [-400, 140, 100, 100, 0],
    { ...clamp, easing: Easing.inOut(Easing.cubic) },
  );
  const lean = interpolate(t, [1.3, 1.7, 2.5, 3.0], [0, 1, 1, 0], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const base = idlePose(t);
  const pose: ClawdPose = {
    ...base,
    bodyOffsetX: base.bodyOffsetX + 0.9 * lean,
    torsoTiltDeg: base.torsoTiltDeg + 4 * lean,
    rightArmExtend: base.rightArmExtend + 0.6 * lean,
    rightArmOffsetY: base.rightArmOffsetY - 0.7 * lean,
    actionLook: { x: 0.45 * lean, y: -0.05 },
  };
  return (
    <AbsoluteFill>
      <LabBackdrop showGlow={false} />
      <Spotlight layer="floor" x={spotX} iris={1} ambient={0.5} />
      <LabClawd x={0} pose={pose} />
      <Spotlight layer="air" x={spotX} iris={1} ambient={0.5} />
      <LabCaption
        tag="A · 备选：不位移"
        title="原地探身：脚不动，光自己弹回来"
        lines={[
          "身体往右倾、右爪去够，脚钉在原地；光过头后再滑回中心。",
          "改动最小，但没有“追进光里”这一拍。",
        ]}
      />
    </AbsoluteFill>
  );
};

/** B. 碎步跳追光（推荐） */
const CHASE_HOPS: HopSpec[] = [
  { takeoffSec: 2.0, landSec: 2.2, toX: 40 },
  { takeoffSec: 2.45, landSec: 2.65, toX: 80 },
];
function chaseSpotX(t: number) {
  const summoned = summonedSpotX(t, 0.4);
  const lock = interpolate(t, [2.75, 3.2], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  return summoned + (80 - summoned) * lock;
}
function chaseLook(t: number) {
  return interpolate(t, [0.4, 1.2, 1.6, 2.7, 3.1], [-0.3, 0.1, 0.45, 0.45, 0], clamp);
}

const ChaseScene: React.FC<{ t: number; debug: boolean }> = ({ t, debug }) => {
  const hop = sampleHopTravel(t, 0, CHASE_HOPS);
  const spotX = chaseSpotX(t);
  const pose = applyHopToPose(idlePose(t), hop);
  return (
    <>
      <LabBackdrop showGlow={false} />
      <Spotlight layer="floor" x={spotX} iris={1} ambient={0.5} />
      <LabClawd
        x={hop.x}
        pose={{ ...pose, actionLook: { x: chaseLook(t), y: 0 } }}
        eyes={hop.phase === "air" ? "wince" : "normal"}
      />
      <Spotlight layer="air" x={spotX} iris={1} ambient={0.5} />
      <Footprints
        plantedXs={debug ? hop.plantedXs : []}
        currentX={hop.x}
        grounded={debug && hop.phase !== "air"}
      />
      {debug && (
        <LabReadout
          rows={[
            ["Clawd x", `${hop.x.toFixed(1)} px`],
            ["光圈 x", `${spotX.toFixed(1)} px`],
            ["阶段", PHASE_LABEL[hop.phase]],
          ]}
        />
      )}
    </>
  );
};

const SegChase: React.FC = () => {
  const t = useLocalSec();
  return (
    <AbsoluteFill>
      <ChaseScene t={t} debug />
      <LabCaption
        tag="B · 推荐"
        title="碎步跳追光：两小跳，往右 80px"
        lines={[
          "光停在右边 → Clawd 看过去 → 两小跳进光 → 光再锁定到他身上。",
          "蓝色刻度是落脚点：着地时脚和刻度对齐，就没有滑步。",
        ]}
      />
    </AbsoluteFill>
  );
};

/** B 慢放：1/6 速度拆解两跳 */
const SLOW_FROM = 1.8;
const SLOW_FACTOR = 6;
const SegChaseSlow: React.FC = () => {
  const t = SLOW_FROM + useLocalSec() / SLOW_FACTOR;
  const hop = sampleHopTravel(t, 0, CHASE_HOPS);
  return (
    <AbsoluteFill>
      <ChaseScene t={t} debug />
      <LabCaption
        tag="B · 慢放 1/6"
        title="怎么做到的：只在腾空时平移"
        lines={[
          "Clawd 的四条短腿长在躯干下，没法一只一只迈步。",
          "所以每一步做成一个小跳：着地时 X 完全不变，离地那 0.2 秒里才移动。",
          "落点、起跳和落地时刻都是参数，可以对到拍点上。",
        ]}
      />
      <div
        style={{
          position: "absolute",
          left: 40,
          bottom: 40,
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: 24,
          color: "#7DD3FC",
        }}
      >
        {PHASE_LABEL[hop.phase]}
      </div>
    </AbsoluteFill>
  );
};

/** C. 麦克风伸来，Clawd 跳回中央 */
const RETURN_HOPS: HopSpec[] = [
  { takeoffSec: 1.0, landSec: 1.2, toX: 40 },
  { takeoffSec: 1.42, landSec: 1.62, toX: 0 },
];
const SegReturn: React.FC = () => {
  const t = useLocalSec();
  const hop = sampleHopTravel(t, 80, RETURN_HOPS);
  const spotX = laggedFollow((s) => sampleHopTravel(s, 80, RETURN_HOPS).x, t, 0.3);
  const micIn = interpolate(t, [0.25, 0.8], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  const reach = interpolate(t, [1.9, 2.3], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const base = applyHopToPose(idlePose(t), hop);
  const pose: ClawdPose = {
    ...base,
    bodyOffsetX: base.bodyOffsetX - 0.35 * reach,
    bodyOffsetY: base.bodyOffsetY - 0.25 * reach,
    leftArmOffsetY: base.leftArmOffsetY - 0.25 * reach,
    rightArmOffsetY: base.rightArmOffsetY - 0.25 * reach,
    actionLook: {
      x: interpolate(t, [0.4, 0.8], [0, -0.4], clamp),
      y: interpolate(t, [0.4, 0.8], [0, -0.3], clamp),
    },
  };
  return (
    <AbsoluteFill>
      <LabBackdrop showGlow={false} />
      <Spotlight layer="floor" x={spotX} iris={1} ambient={0.5} />
      <MicProp
        headX={interpolate(micIn, [0, 1], [-330, -40])}
        headY={interpolate(micIn, [0, 1], [-60, 300])}
      />
      <LabClawd x={hop.x} pose={pose} eyes={t > 2.3 ? "happy" : "normal"} />
      <Spotlight layer="air" x={spotX} iris={1} ambient={0.5} />
      <LabCaption
        tag="C · L002"
        title="麦克风伸到中央，Clawd 凑过去，顺便回到中心"
        lines={[
          "麦克风从左上方伸到中线位置，Clawd 两小跳凑过去，光跟着他回来。",
          "回到 x = 0 之后，L003 起的现有站位都不用改。",
        ]}
      />
    </AbsoluteFill>
  );
};

/** D. 按真实歌曲时间连播 17.6–24.6s */
const SONG_FROM = 17.6;
const SONG_HOPS: HopSpec[] = [
  { takeoffSec: 19.98, landSec: 20.165, toX: 40 },
  { takeoffSec: 20.54, landSec: 20.726, toX: 80 },
  { takeoffSec: 23.0, landSec: 23.2, toX: 40 },
  { takeoffSec: 23.33, landSec: 23.53, toX: 0 },
];
function songClawdX(sec: number) {
  return sampleHopTravel(sec, 0, SONG_HOPS).x;
}
function songSpotX(sec: number) {
  if (sec < 20.8) return summonedSpotX(sec, 18.48);
  const follow = laggedFollow(songClawdX, sec, 0.3);
  const blend = interpolate(sec, [20.8, 21.2], [0, 1], clamp);
  return 100 + (follow - 100) * blend;
}

function hasPrivateAudio(): boolean {
  return getStaticFiles().some(
    (file) => file.name.replace(/\\/g, "/") === "private/audio/try-me.flac",
  );
}

const SegSong: React.FC<{ silent: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = SONG_FROM + frame / fps;
  const authoredFrame = sec * VERSE1_RHYTHM.fps;
  const beatPos = beatPosition(authoredFrame, VERSE1_RHYTHM.beatFrames);
  const rhythm = rhythmMotion(sec, beatPos);
  const { actor } = resolveVerse1ClawdPerformance(sec, authoredFrame, rhythm);
  const hop = sampleHopTravel(sec, 0, SONG_HOPS);
  const spotX = songSpotX(sec);
  const ambient = 0.5;

  const base = resolveClawdPose({
    action: actor.action,
    actionProgress: actor.actionProgress,
    prop: actor.prop,
    bookProgress: actor.bookProgress,
    keyboardState: actor.keyboardState,
    beatPulse: actor.beatPulse,
    rhythm,
    timeSec: sec,
  });
  const lookToLight = interpolate(sec, [19.3, 19.7, 20.8, 21.3], [0, 0.45, 0.45, 0], clamp);
  const lookToMic = interpolate(sec, [22.8, 23.0], [0, 1], clamp);
  const hopped = applyHopToPose(base, hop);
  const pose: ClawdPose = {
    ...hopped,
    actionLook:
      lookToMic > 0
        ? { x: -0.4 * lookToMic, y: -0.3 * lookToMic }
        : { x: hopped.actionLook.x + lookToLight, y: hopped.actionLook.y },
  };
  const micIn = interpolate(sec, [22.72, 23.1], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });

  return (
    <AbsoluteFill>
      {!silent && hasPrivateAudio() && (
        <Html5Audio src={staticFile("private/audio/try-me.flac")} trimBefore={Math.round(SONG_FROM * fps)} />
      )}
      <LabBackdrop showGlow={false} />
      <LyricTerminal frame={Math.round(sec * fps)} fps={fps} beatPos={beatPos} />
      <Spotlight layer="floor" x={spotX} iris={1} ambient={ambient} />
      <HeyBubblePerformance sec={sec} offsetX={0} />
      {micIn > 0 && (
        <MicProp
          headX={interpolate(micIn, [0, 1], [-330, -40])}
          headY={interpolate(micIn, [0, 1], [-60, 300])}
        />
      )}
      <LabClawd
        x={hop.x}
        pose={pose}
        eyes={hop.phase === "air" ? "wince" : actor.eyes}
        extra={{
          prop: actor.prop,
          keyboardState: actor.keyboardState,
          rhythm,
        }}
      />
      <Spotlight layer="air" x={spotX} iris={1} ambient={ambient} />
      <LabCaption
        tag="D · 连播（歌曲 17.6–24.6s，有私有音轨时带声音）"
        title="Hey 招光 → let's go 两跳进光 → L002 跳回麦克风前"
        lines={[
          "两跳落在候选拍点 20.165s / 20.726s；回中心两跳落在 23.2s / 23.53s。",
          "拍网格未确认小节首拍；L002 现有 tilt-invite 视线朝右，这里临时改成朝左上看麦克风。",
        ]}
      />
      <LabReadout rows={[["song", `${sec.toFixed(2)} s`], ["Clawd x", `${hop.x.toFixed(0)} px`]]} />
    </AbsoluteFill>
  );
};

export interface ClawdMotionLabProps {
  silentPreview?: boolean;
}

const SEGMENTS: { sec: number; name: string }[] = [
  { sec: 4, name: "A 原地探身" },
  { sec: 4.5, name: "B 碎步跳追光" },
  { sec: 9, name: "B 慢放" },
  { sec: 3.5, name: "C 跳回中心" },
  { sec: 7, name: "D 歌曲连播" },
];
export const CLAWD_MOTION_LAB_SEC = SEGMENTS.reduce((s, x) => s + x.sec, 0);

export const ClawdMotionLab: React.FC<ClawdMotionLabProps> = ({ silentPreview = false }) => {
  const { fps } = useVideoConfig();
  const comps: React.ReactNode[] = [
    <SegLean key="a" />,
    <SegChase key="b" />,
    <SegChaseSlow key="bs" />,
    <SegReturn key="c" />,
    <SegSong key="d" silent={silentPreview} />,
  ];
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0B11", overflow: "hidden" }}>
      {SEGMENTS.map(({ sec, name }, i) => {
        const start = from;
        from += Math.round(sec * fps);
        return (
          <Sequence key={name} name={name} from={start} durationInFrames={Math.round(sec * fps)}>
            {comps[i]}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const ClawdMotionLabComposition: React.FC = () => (
  <Composition
    id="ClawdMotionLab"
    component={ClawdMotionLabOutput}
    durationInFrames={Math.round(CLAWD_MOTION_LAB_SEC * VIDEO_FPS)}
    fps={VIDEO_FPS}
    width={VIDEO_WIDTH}
    height={VIDEO_HEIGHT}
    defaultProps={{ silentPreview: false }}
  />
);

const ClawdMotionLabOutput = withOutputCanvas(ClawdMotionLab);
