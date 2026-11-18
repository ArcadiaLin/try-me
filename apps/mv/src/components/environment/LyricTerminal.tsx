import React from "react";
import {
  sampleLyricTerminal,
  TERMINAL_VISIBLE_ROWS,
  type LyricTerminalCue,
} from "../../timeline/verse1-lyrics";

export interface LyricTerminalProps {
  frame: number;
  fps: number;
  /** 连续拍位置（beatPosition），光标按拍闪烁 */
  beatPos: number;
  cues?: readonly LyricTerminalCue[];
}

/** 与 StageDeck 台面上沿同宽，Clawd 站在终端顶边上 */
const TERMINAL_WIDTH = 1000;
const TERMINAL_HEIGHT = 183; // 195px 舞台区减去 12px 台面上沿
const ROW_HEIGHT = 27;
const LOG_TOP = 12;
const INPUT_TOP = LOG_TOP + ROW_HEIGHT * TERMINAL_VISIBLE_ROWS + 10;

const MONO_STACK =
  '"Cascadia Mono", "JetBrains Mono", Consolas, "Yu Gothic UI", "Microsoft YaHei", monospace';

const ACCENT = "#D87757";

/**
 * 舞台底部终端：歌词像 stdout 一句一句打印、整体上滚；底部常驻 `>` 输入行。
 * 扁平 TUI 面板，不做窗口标题栏、毛玻璃或发光。
 */
export const LyricTerminal: React.FC<LyricTerminalProps> = ({
  frame,
  fps,
  beatPos,
  cues,
}) => {
  const { lines, input } = sampleLyricTerminal(frame, fps, cues);
  const cursorOn = input.typing || beatPos % 1 < 0.5;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 0,
        width: TERMINAL_WIDTH,
        height: TERMINAL_HEIGHT,
        transform: "translateX(-50%)",
        backgroundColor: "#0B0C12",
        borderLeft: "1.5px solid rgba(148, 163, 184, 0.22)",
        borderRight: "1.5px solid rgba(148, 163, 184, 0.22)",
        fontFamily: MONO_STACK,
        zIndex: 2,
        pointerEvents: "none",
      }}
    >
      {/* stdout 历史区 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: LOG_TOP,
          height: ROW_HEIGHT * TERMINAL_VISIBLE_ROWS,
          overflow: "hidden",
        }}
      >
        {lines.map(({ cue, row, depthOpacity, isNewest }) => {
          const isGhost = cue.mode === "ghost";
          const isInput = cue.mode === "input";
          const opacity = depthOpacity * (isGhost ? 0.38 : 1);
          return (
            <div
              key={cue.id}
              style={{
                position: "absolute",
                left: 30,
                right: 30,
                top: row * ROW_HEIGHT,
                height: ROW_HEIGHT,
                display: "flex",
                alignItems: "center",
                gap: 12,
                opacity,
                whiteSpace: "nowrap",
              }}
            >
              {isInput ? (
                <span
                  style={{
                    width: 8,
                    textAlign: "center",
                    color: "#64748B",
                    fontSize: 18,
                  }}
                >
                  {">"}
                </span>
              ) : (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flex: "0 0 auto",
                    backgroundColor:
                      isNewest && !isGhost ? ACCENT : "#94A3B8",
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 19,
                  letterSpacing: 0.2,
                  color: isInput ? "#94A3B8" : "#E8EAF0",
                }}
              >
                {cue.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* `>` 输入行 */}
      <div
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          top: INPUT_TOP,
          height: 34,
          border: `1px solid ${
            input.standby ? ACCENT : "rgba(148, 163, 184, 0.32)"
          }`,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 10,
          fontSize: 17,
          color: "#E8EAF0",
        }}
      >
        <span style={{ color: "#64748B" }}>{">"}</span>
        <span style={{ display: "flex", alignItems: "center" }}>
          {input.text}
          <span
            style={{
              display: "inline-block",
              width: 9,
              height: 19,
              marginLeft: input.text ? 1 : 0,
              backgroundColor: cursorOn ? "#CBD5E1" : "transparent",
            }}
          />
        </span>
        {input.standby && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 13,
              letterSpacing: 0.6,
              color: ACCENT,
            }}
          >
            standby
          </span>
        )}
      </div>
    </div>
  );
};
