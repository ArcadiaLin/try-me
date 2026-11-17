import React from "react";
import type { StageKeyboardState } from "../../timeline/verse1";

export interface StageAutoKeyboardProps {
  keyboard: StageKeyboardState;
}

const WHITE_KEY_COUNT = 10; // F3, G3, A3, B3, C4, D4, E4, F4, G4, A4
const WHITE_KEY_WIDTH = 54;
const WHITE_KEY_GAP = 2;
const KEYBED_INNER_WIDTH =
  WHITE_KEY_COUNT * WHITE_KEY_WIDTH + (WHITE_KEY_COUNT - 1) * WHITE_KEY_GAP; // 558px
const CHASSIS_WIDTH = KEYBED_INNER_WIDTH + 52; // 610px
const BLACK_KEY_AFTER_INDICES = [0, 1, 2, 4, 5, 7, 8] as const;

const ACTIVE_ZONE_BY_KEY: Record<number, 0 | 1 | 2> = {
  1: 0,
  2: 1,
  9: 2,
};

/**
 * 舞台前侧抽出的自动演奏键盘（橙色段 0.254s–18.477s 专属装置；青绿段完整收回离开）
 */
export const StageAutoKeyboard: React.FC<StageAutoKeyboardProps> = ({
  keyboard,
}) => {
  if (!keyboard.visible) return null;

  const deckTopHeight = Math.round(5 + 16 * keyboard.trayUnfold);
  const blackKeyHeight = Math.round(3 + 10 * keyboard.trayUnfold);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 12,
        width: CHASSIS_WIDTH + 16,
        height: 68,
        transform: "translateX(-50%)",
        overflow: "hidden",
        zIndex: 2,
      }}
    >
      {/* 抽出的键盘托盘主体 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: CHASSIS_WIDTH,
          transform: `translate(-50%, ${(1 - keyboard.traySlide) * -58}px)`,
          backgroundColor: "#181B2B",
          borderLeft: "2px solid rgba(148, 163, 184, 0.32)",
          borderRight: "2px solid rgba(148, 163, 184, 0.32)",
          borderBottom: "2px solid #0B0D16",
          borderRadius: "0 0 7px 7px",
          boxShadow: "0 6px 14px rgba(0, 0, 0, 0.48)",
          padding: "3px 24px 5px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* 两侧深色机械护翼刻度 */}
        <div
          style={{
            position: "absolute",
            left: 6,
            top: 6,
            bottom: 6,
            width: 10,
            borderRadius: 2,
            backgroundColor: "#111320",
            border: "1px solid rgba(100, 116, 139, 0.22)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 6,
            top: 6,
            bottom: 6,
            width: 10,
            borderRadius: 2,
            backgroundColor: "#111320",
            border: "1px solid rgba(100, 116, 139, 0.22)",
          }}
        />

        {/* 琴键槽区域 */}
        <div
          style={{
            position: "relative",
            width: KEYBED_INNER_WIDTH,
            height: deckTopHeight + 13,
            backgroundColor: "#0D0F18",
            borderRadius: "2px 2px 3px 3px",
            paddingTop: 1,
          }}
        >
          {/* 10 枚浅色白键 */}
          {Array.from({ length: WHITE_KEY_COUNT }).map((_, kIdx) => {
            const zIdx = ACTIVE_ZONE_BY_KEY[kIdx];
            const zoneState =
              zIdx !== undefined
                ? keyboard.zones[zIdx]
                : { press: 0, velocity: 0 };
            const press = zoneState.press * keyboard.trayUnfold;
            const vel = zoneState.velocity;
            const dropPx = press * 6.0;
            const frontLipThickness = Math.max(
              3.2,
              7.2 * keyboard.trayUnfold - press * 2.2,
            );
            const orangeLiningHeight = press * 5.6;
            const orangeAlpha = Math.min(1, press * (0.72 + 0.28 * vel));
            const keyLeft = kIdx * (WHITE_KEY_WIDTH + WHITE_KEY_GAP);

            return (
              <div
                key={`wk-${kIdx}`}
                style={{
                  position: "absolute",
                  left: keyLeft,
                  top: 0,
                  width: WHITE_KEY_WIDTH,
                  height: deckTopHeight + 12,
                }}
              >
                {orangeAlpha > 0.02 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: Math.max(0, deckTopHeight - 2),
                      height: orangeLiningHeight + 4,
                      background:
                        "linear-gradient(90deg, #D87757 0%, #FB923C 50%, #D87757 100%)",
                      opacity: orangeAlpha,
                      borderRadius: 1.5,
                    }}
                  />
                )}
                {orangeAlpha > 0.02 && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 2,
                        width: 2.5,
                        height: deckTopHeight + dropPx,
                        backgroundColor: "#D87757",
                        opacity: orangeAlpha * 0.85,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 2,
                        width: 2.5,
                        height: deckTopHeight + dropPx,
                        backgroundColor: "#D87757",
                        opacity: orangeAlpha * 0.85,
                      }}
                    />
                  </>
                )}

                {/* 琴键上表面 */}
                <div
                  style={{
                    position: "absolute",
                    left: press > 0.05 ? 1.5 : 0,
                    right: press > 0.05 ? 1.5 : 0,
                    top: 0,
                    height: deckTopHeight + dropPx * 0.55,
                    background:
                      press > 0.05
                        ? `linear-gradient(180deg, #CBD5E1 0%, #94A3B8 68%, #78879B 100%)`
                        : `linear-gradient(180deg, #E2E8F0 0%, #CBD5E1 100%)`,
                    borderTop: "1px solid #F8FAFC",
                    borderBottom:
                      press > 0.05
                        ? `2px solid rgba(251, 146, 60, ${orangeAlpha.toFixed(3)})`
                        : "1px solid #94A3B8",
                    borderRadius: "1.5px 1.5px 0 0",
                  }}
                />

                {/* 琴键前端厚度面 */}
                <div
                  style={{
                    position: "absolute",
                    left: press > 0.05 ? 1.5 : 0,
                    right: press > 0.05 ? 1.5 : 0,
                    top: deckTopHeight + dropPx * 0.55,
                    height: frontLipThickness,
                    backgroundColor: press > 0.05 ? "#64748B" : "#94A3B8",
                    borderBottom: "1.5px solid #334155",
                    borderRadius: "0 0 2px 2px",
                  }}
                />
              </div>
            );
          })}

          {/* 7 枚深色黑键 */}
          {BLACK_KEY_AFTER_INDICES.map((afterIdx) => {
            const bkWidth = 28;
            const bkLeft =
              (afterIdx + 1) * (WHITE_KEY_WIDTH + WHITE_KEY_GAP) -
              WHITE_KEY_GAP / 2 -
              bkWidth / 2;
            return (
              <div
                key={`bk-${afterIdx}`}
                style={{
                  position: "absolute",
                  left: bkLeft,
                  top: 0,
                  width: bkWidth,
                  height: blackKeyHeight + 3,
                  backgroundColor: "#171A29",
                  borderLeft: "1px solid #334155",
                  borderRight: "1px solid #0B0D16",
                  borderBottom: "3px solid #0B0D16",
                  borderRadius: "0 0 2px 2px",
                  zIndex: 2,
                }}
              />
            );
          })}
        </div>

        {/* 键盘前侧下沿与三个机械指示窗 */}
        <div
          style={{
            position: "relative",
            width: KEYBED_INNER_WIDTH,
            height: 13,
            marginTop: 2,
            backgroundColor: "#121522",
            borderTop: "1px solid rgba(100, 116, 139, 0.25)",
            borderRadius: "0 0 4px 4px",
          }}
        >
          {([1, 2, 9] as const).map((kIdx, winOrder) => {
            const zIdx = ACTIVE_ZONE_BY_KEY[kIdx]!;
            const zoneState = keyboard.zones[zIdx];
            const press = zoneState.press * keyboard.trayUnfold;
            const vel = zoneState.velocity;
            const winWidth = 44;
            const winLeft =
              kIdx * (WHITE_KEY_WIDTH + WHITE_KEY_GAP) +
              (WHITE_KEY_WIDTH - winWidth) / 2;

            return (
              <div
                key={`ind-win-${winOrder}`}
                style={{
                  position: "absolute",
                  left: winLeft,
                  top: 2,
                  width: winWidth,
                  height: 8,
                  backgroundColor: "#08090F",
                  border: "1px solid rgba(100, 116, 139, 0.38)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 0,
                    width: 6,
                    height: Math.max(1.5, press * 3.5),
                    transform: "translateX(-50%)",
                    backgroundColor: "#94A3B8",
                  }}
                />
                {press > 0.02 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 1,
                      right: 1,
                      top: 0,
                      height: "100%",
                      transformOrigin: "top center",
                      transform: `scaleY(${Math.min(1, press).toFixed(3)})`,
                      background:
                        vel >= 0.9
                          ? "linear-gradient(180deg, #D87757 0%, #FB923C 75%, #FDBA74 100%)"
                          : "linear-gradient(180deg, #B85D3D 0%, #D87757 80%, #FDBA74 100%)",
                      borderRadius: "0 0 1.5px 1.5px",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
