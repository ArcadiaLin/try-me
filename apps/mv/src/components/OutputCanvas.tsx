import React from "react";
import { useVideoConfig } from "remotion";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../video-spec";

/** Scale vector/CSS stage coordinates to output pixels. */
export function withOutputCanvas<Props extends object>(Component: React.FC<Props>): React.FC<Props> {
  const OutputCanvas: React.FC<Props> = (props) => {
    const { width, height } = useVideoConfig();
    return (
      <div style={{
        position: "absolute",
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        transform: `scale(${width / DESIGN_WIDTH}, ${height / DESIGN_HEIGHT})`,
        transformOrigin: "top left",
        overflow: "hidden",
      }}>
        <Component {...props} />
      </div>
    );
  };
  return OutputCanvas;
}
