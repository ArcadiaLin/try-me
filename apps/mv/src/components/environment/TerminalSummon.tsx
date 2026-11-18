import React from "react";
import { interpolate } from "remotion";
import { smoothStep } from "../../animation/clawd/motion-style";
import { Clawd } from "../clawd/Clawd";

export interface TerminalSummonProps {
  sec: number;
}

/**
 * L064 尾 – L005: 地面待命框 [ > _ STANDBY ] + Web / Desktop / Claude Code 终端严格卡拍唤出
 */
export const TerminalSummon: React.FC<TerminalSummonProps> = ({ sec }) => {
  if (sec < 35.3 || sec > 38.52) return null;

  // 1) L064 待命状态已并入舞台底部 LyricTerminal 的输入行（standby），不再单独绘制地面胶囊

  // 2) L005 第一端：Claude Web 网页版窗口 (Beat 1: 36.455s)
  const webIn = smoothStep(sec, 36.42, 36.56);
  const webClawdPop = smoothStep(sec, 36.48, 36.64);
  const allCardsOut = smoothStep(sec, 38.08, 38.38);
  const webOpacity = webIn * (1 - allCardsOut);

  // 3) L005 第二端：Claude Desktop 桌面端悬浮窗 (Beat 2: 37.013s)
  const deskIn = smoothStep(sec, 36.98, 37.12);
  const deskClawdPop = smoothStep(sec, 37.04, 37.2);
  const deskOpacity = deskIn * (1 - allCardsOut);

  // 4) L005 第三端：Claude Code 终端窗口 (37.303s 弹出窗口，37.581s 亮起欢迎界面)
  const termIn = smoothStep(sec, 37.28, 37.42);
  const termWelcomeIn = smoothStep(sec, 37.54, 37.66);
  const termOut = smoothStep(sec, 38.12, 38.42);
  const termOpacity = termIn * (1 - termOut);

  return (
    <>
      {/* ① Claude Web 网页版卡片 */}
      {webOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "calc(50% - 315px)",
            top: 214,
            width: 248,
            backgroundColor: "#1E293B",
            border: "2.5px solid #475569",
            borderRadius: 14,
            overflow: "hidden",
            transform: `translate(-50%, -50%) scale(${interpolate(
              webIn,
              [0, 1],
              [0.82, 1],
            )})`,
            opacity: webOpacity,
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.42)",
            zIndex: 4,
            fontFamily: "monospace",
          }}
        >
          <div
            style={{
              backgroundColor: "#0F172A",
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderBottom: "1px solid #334155",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: "#EF4444",
              }}
            />
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: "#F59E0B",
              }}
            />
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: "#22C55E",
              }}
            />
            <span
              style={{
                marginLeft: 4,
                fontSize: 10.5,
                fontWeight: 700,
                color: "#94A3B8",
                backgroundColor: "#1E293B",
                padding: "1px 8px",
                borderRadius: 4,
              }}
            >
              claude.ai/chat
            </span>
          </div>
          <div
            style={{
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#94A3B8",
                }}
              >
                Claude Web
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: "#F8FAFC",
                }}
              >
                Ready to help ✦
              </span>
            </div>
            <div
              style={{
                transform: `scale(${interpolate(
                  webClawdPop,
                  [0, 0.7, 1],
                  [0, 1.18, 1],
                )})`,
                opacity: webClawdPop,
              }}
            >
              <Clawd
                width={52}
                action="static"
                eyes="happy"
                autoBlink={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* ② Claude Desktop 桌面端快捷悬浮窗 */}
      {deskOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "calc(50% - 35px)",
            top: 132,
            width: 266,
            backgroundColor: "#1E1B2E",
            border: "2.5px solid #D87757",
            borderRadius: 14,
            padding: "9px 14px",
            transform: `translate(-50%, -50%) scale(${interpolate(
              deskIn,
              [0, 1],
              [0.82, 1],
            )})`,
            opacity: deskOpacity,
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 4,
            fontFamily: "monospace",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: "#0F172A",
                  backgroundColor: "#FDBA74",
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                Alt+Space
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "#CBD5E1",
                }}
              >
                Claude Desktop
              </span>
            </div>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                color: "#FFF7ED",
              }}
            >
              Ask anything...
            </span>
          </div>
          <div
            style={{
              transform: `scale(${interpolate(
                deskClawdPop,
                [0, 0.7, 1],
                [0, 1.18, 1],
              )})`,
              opacity: deskClawdPop,
            }}
          >
            <Clawd
              width={50}
              action="static"
              eyes="happy"
              autoBlink={false}
            />
          </div>
        </div>
      )}

      {/* ③ 真实 Windows Terminal 布局的 Claude Code 终端窗口 */}
      {termOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "calc(50% + 198px)",
            top: 276,
            width: 446,
            height: 214,
            backgroundColor: "#000000",
            border: "2px solid #2D2D2D",
            borderRadius: 12,
            overflow: "hidden",
            transform: `translate(-50%, -50%) scale(${interpolate(
              termIn,
              [0, 1],
              [0.86, 1],
            )})`,
            opacity: termOpacity,
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.65)",
            zIndex: 4,
            fontFamily: '"Cascadia Mono", "Consolas", monospace',
          }}
        >
          {/* Windows Terminal 标签栏 */}
          <div
            style={{
              backgroundColor: "#1F1F1F",
              height: 36,
              padding: "6px 10px 0 8px",
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
            }}
          >
            <div
              style={{
                backgroundColor: "#000000",
                height: 30,
                padding: "0 12px",
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 7,
                minWidth: 196,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  fontSize: 8.5,
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {">_"}
              </span>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 2.5,
                  backgroundColor: "#16A34A",
                  color: "#FFFFFF",
                  fontSize: 10,
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                ✳
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  flex: 1,
                }}
              >
                Claude Code
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "#9CA3AF",
                  fontWeight: 600,
                }}
              >
                ×
              </span>
            </div>
            <div
              style={{
                height: 30,
                display: "flex",
                alignItems: "center",
                gap: 10,
                paddingLeft: 4,
                color: "#9CA3AF",
                fontSize: 13,
              }}
            >
              <span>+</span>
              <span style={{ fontSize: 10 }}>∨</span>
            </div>
          </div>

          {/* 终端纯黑内容区 */}
          <div
            style={{
              padding: "20px 18px 18px 20px",
              opacity: termWelcomeIn,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                paddingLeft: 96,
                minHeight: 68,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  lineHeight: 1.25,
                }}
              >
                <div style={{ fontSize: 15.5 }}>
                  <span style={{ color: "#FFFFFF", fontWeight: 800 }}>
                    Claude Code
                  </span>{" "}
                  <span style={{ color: "#8E8E93", fontWeight: 500 }}>
                    v2.1.304
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 14.5,
                    color: "#8E8E93",
                    fontWeight: 500,
                  }}
                >
                  Opus 5.5 · Claude Pro
                </div>
                <div
                  style={{
                    fontSize: 14.5,
                    color: "#8E8E93",
                    fontWeight: 500,
                  }}
                >
                  {"E:\\workspace\\try-me"}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 22,
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12.2,
                color: "#8E8E93",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ color: "#8E8E93", fontWeight: 700 }}>│</span>
              <span>
                {"Using Opus 5.5 (from .claude\\settings.json) · /model"}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
