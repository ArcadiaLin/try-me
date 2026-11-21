import React from "react";
import { interpolate } from "remotion";
import { linearProg, smoothStep } from "../../animation/clawd/motion-style";
import { POP_PALETTE } from "../../styles/palette";

export const MULTILANG_LINES = [
  {
    lang: "EN",
    text: "I speak different languages",
    color: POP_PALETTE.mint,
  },
  {
    lang: "ZH",
    text: "我会说不同的语言",
    color: POP_PALETTE.amberMid,
  },
  {
    lang: "JA",
    text: "いろんな言葉が話せるよ",
    color: POP_PALETTE.pinkLight,
  },
  {
    lang: "ES",
    text: "Hablo diferentes idiomas",
    color: POP_PALETTE.lime,
  },
] as const;

export interface MultilangBubbleProps {
  sec: number;
}

/**
 * L007–L008: 跨句共享的五行多语言对话气泡 + 两侧极简听众回应
 */
export const MultilangBubble: React.FC<MultilangBubbleProps> = ({ sec }) => {
  if (sec < 40.78 || sec > 45.32) return null;

  const bubbleIn = smoothStep(sec, 40.8, 41.04);
  const moveToHeader = smoothStep(sec, 42.78, 43.35);
  const bubbleOut = smoothStep(sec, 44.68, 45.26);

  const bubbleX = interpolate(moveToHeader, [0, 1], [155, 0]);
  const bubbleY =
    interpolate(moveToHeader, [0, 1], [235, 148]) - bubbleOut * 28;
  const bubbleScale =
    interpolate(bubbleIn, [0, 1], [0.86, 1]) *
    interpolate(moveToHeader, [0, 1], [1, 0.88]) *
    interpolate(bubbleOut, [0, 1], [1, 0.9]);
  const bubbleOpacity = bubbleIn * (1 - bubbleOut);

  const parallelTypeProg = linearProg(sec, 40.92, 42.38);
  const isTypingFour = sec >= 40.92 && sec < 42.38;
  const moreProg = linearProg(sec, 42.34, 42.74);
  const isTypingMore = sec >= 42.34 && sec < 42.74;

  const badgePop = smoothStep(sec, 43.25, 43.52);
  const listenerEnter = smoothStep(sec, 42.91, 43.42);
  const listenerExit = smoothStep(sec, 44.65, 45.26);
  const listenerPresence = listenerEnter * (1 - listenerExit);
  const leftNod =
    sec >= 43.48 && sec <= 44.02
      ? Math.sin(linearProg(sec, 43.48, 44.02) * Math.PI) * 14
      : 0;
  const rightNod =
    sec >= 43.78 && sec <= 44.32
      ? Math.sin(linearProg(sec, 43.78, 44.32) * Math.PI) * 14
      : 0;
  const leftGotIt = sec >= 43.48 && sec <= 44.82;
  const rightGotIt = sec >= 43.78 && sec <= 44.82;

  return (
    <>
      {/* 跨 L007–L008 连续存在的五行多语言气泡 */}
      <div
        style={{
          position: "absolute",
          left: `calc(50% + ${bubbleX}px)`,
          top: bubbleY,
          width: 520,
          transform: `translate(-50%, -50%) scale(${bubbleScale})`,
          opacity: bubbleOpacity,
          backgroundColor: POP_PALETTE.cream,
          color: POP_PALETTE.ink,
          border: `4px solid ${POP_PALETTE.ink}`,
          borderRadius: 20,
          padding: "14px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 7,
          zIndex: 6,
          boxShadow: `7px 8px 0 ${POP_PALETTE.ink}`,
        }}
      >
        {MULTILANG_LINES.map((line) => {
          const chars = Math.round(parallelTypeProg * line.text.length);
          const visibleText = line.text.slice(0, chars);
          return (
            <div
              key={line.lang}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                minHeight: 30,
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  padding: "2px 8px",
                  borderRadius: 6,
                  backgroundColor: line.color,
                  color: POP_PALETTE.ink,
                  width: 42,
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                {line.lang}
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: POP_PALETTE.ink,
                  whiteSpace: "nowrap",
                  letterSpacing: -0.2,
                }}
              >
                {visibleText}
                {isTypingFour && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 9,
                      height: 21,
                      backgroundColor: POP_PALETTE.ink,
                      marginLeft: 3,
                      verticalAlign: "middle",
                    }}
                  />
                )}
              </span>
            </div>
          );
        })}

        {/* 第五行：+ ... */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minHeight: 28,
            opacity: sec >= 42.34 ? 1 : 0.25,
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: "#64748B",
              width: 42,
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            +
          </span>
          <span
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: "#334155",
              letterSpacing: 3,
            }}
          >
            {"...".slice(0, Math.round(moreProg * 3))}
            {isTypingMore && (
              <span
                style={{
                  display: "inline-block",
                  width: 9,
                  height: 21,
                  backgroundColor: POP_PALETTE.ink,
                  marginLeft: 3,
                  verticalAlign: "middle",
                }}
              />
            )}
          </span>
        </div>

        {/* 气泡指向 Clawd 的尖角 */}
        <div
          style={{
            position: "absolute",
            left: `${interpolate(moveToHeader, [0, 1], [8, 50])}%`,
            bottom: -11,
            width: 18,
            height: 18,
            backgroundColor: POP_PALETTE.cream,
            borderRight: `4px solid ${POP_PALETTE.ink}`,
            borderBottom: `4px solid ${POP_PALETTE.ink}`,
            transform: "translateX(-50%) rotate(45deg)",
          }}
        />

        {/* L008 气泡右下角浮现同款理解 ★ 徽章 */}
        {badgePop > 0.01 && (
          <div
            style={{
              position: "absolute",
              right: -16,
              bottom: -14,
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: POP_PALETTE.yellowDeep,
              border: `3px solid ${POP_PALETTE.ink}`,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: 26,
              fontWeight: 900,
              color: POP_PALETTE.ink,
              transform: `scale(${badgePop})`,
              boxShadow: `3px 4px 0 ${POP_PALETTE.ink}`,
            }}
          >
            ★
          </div>
        )}
      </div>

      {/* L008 左侧极简听众 */}
      {listenerPresence > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "calc(50% - 310px)",
            bottom: 195,
            transform: `translateX(-50%) translateX(${interpolate(
              listenerPresence,
              [0, 1],
              [-220, 0],
            )}px) translateY(${leftNod}px)`,
            opacity: listenerPresence,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 4,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: POP_PALETTE.yellowDeep,
              border: `3px solid ${POP_PALETTE.ink}`,
              fontSize: 20,
              fontWeight: 900,
              color: POP_PALETTE.ink,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 10,
              opacity: leftGotIt ? 1 : 0,
              transform: `scale(${leftGotIt ? 1 : 0.5})`,
            }}
          >
            ★
          </div>
          <svg width={118} height={112} viewBox="0 0 10 10">
            <rect x={2} y={0.8} width={6.5} height={1.1} fill={POP_PALETTE.mint} />
            <rect
              x={1.5}
              y={1.8}
              width={6.5}
              height={5.8}
              fill="#64748B"
              stroke="#11131F"
              strokeWidth={0.4}
            />
            <rect x={3.8} y={3.1} width={0.8} height={1.5} fill={POP_PALETTE.ink} />
            <rect x={6.0} y={3.1} width={0.8} height={1.5} fill={POP_PALETTE.ink} />
            <rect x={2.5} y={7.6} width={1.1} height={2.2} fill="#64748B" />
            <rect x={5.8} y={7.6} width={1.1} height={2.2} fill="#64748B" />
          </svg>
        </div>
      )}

      {/* L008 右侧极简听众 */}
      {listenerPresence > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "calc(50% + 310px)",
            bottom: 195,
            transform: `translateX(-50%) translateX(${interpolate(
              listenerPresence,
              [0, 1],
              [220, 0],
            )}px) translateY(${rightNod}px)`,
            opacity: listenerPresence,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 4,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: POP_PALETTE.yellowDeep,
              border: `3px solid ${POP_PALETTE.ink}`,
              fontSize: 20,
              fontWeight: 900,
              color: POP_PALETTE.ink,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 10,
              opacity: rightGotIt ? 1 : 0,
              transform: `scale(${rightGotIt ? 1 : 0.5})`,
            }}
          >
            ★
          </div>
          <svg width={118} height={112} viewBox="0 0 10 10">
            <rect x={4.6} y={0.3} width={0.9} height={1.5} fill={POP_PALETTE.pinkLight} />
            <rect x={3.8} y={0.3} width={2.4} height={0.7} fill={POP_PALETTE.pinkLight} />
            <rect
              x={2.0}
              y={1.8}
              width={6.5}
              height={5.8}
              fill="#4D7C73"
              stroke="#11131F"
              strokeWidth={0.4}
            />
            <rect x={3.2} y={3.1} width={0.8} height={1.5} fill={POP_PALETTE.ink} />
            <rect x={5.4} y={3.1} width={0.8} height={1.5} fill={POP_PALETTE.ink} />
            <rect x={3.0} y={7.6} width={1.1} height={2.2} fill="#4D7C73" />
            <rect x={6.3} y={7.6} width={1.1} height={2.2} fill="#4D7C73" />
          </svg>
        </div>
      )}
    </>
  );
};
