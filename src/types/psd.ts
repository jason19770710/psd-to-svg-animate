export interface LayerInfo {
  id: string;
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
  imageDataUrl: string; // base64 PNG
  visible: boolean;
  exportExcluded?: boolean; // marked layers won't be exported
  flipH?: boolean;
  flipV?: boolean;
}

export interface AnimationConfig {
  scale: {
    enabled: boolean;
    value: number;    // 0.5 - 2.0
    speed: number;    // seconds
    loop: boolean;
  };
  movement: {
    enabled: boolean;
    angle: number;    // 0-360 degrees (0=up, 90=right, 180=down, 270=left)
    distance: number; // px
    speed: number;
    loop: boolean;
    mode: "oscillate" | "linear"; // oscillate = back and forth, linear = A to B
  };
  rotate: {
    enabled: boolean;
    angle: number;    // degrees
    clockwise: boolean;
    mode: "continuous" | "alternate"; // continuous = same direction, alternate = back and forth
    speed: number;
    loop: boolean;
  };
  fade: {
    enabled: boolean;
    fromOpacity: number;  // 0-1
    toOpacity: number;    // 0-1
    speed: number;
    loop: boolean;
  };
  colorShift: {
    enabled: boolean;
    hueRotate: number;    // 0-360 degrees
    saturate: number;     // 0-3
    brightness: number;   // 0-3
    speed: number;
    loop: boolean;
  };
}

export const defaultAnimationConfig: AnimationConfig = {
  scale: { enabled: false, value: 1.5, speed: 1, loop: true },
  movement: { enabled: false, angle: 0, distance: 20, speed: 0.5, loop: true },
  rotate: { enabled: false, angle: 360, clockwise: true, mode: "continuous", speed: 2, loop: true },
  fade: { enabled: false, fromOpacity: 1, toOpacity: 0, speed: 1, loop: true },
  colorShift: { enabled: false, hueRotate: 180, saturate: 1, brightness: 1, speed: 2, loop: true },
};
