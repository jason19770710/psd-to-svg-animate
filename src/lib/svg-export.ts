import { LayerInfo, AnimationConfig } from "@/types/psd";

export function generateAnimationCSS(
  layers: LayerInfo[],
  animations: Record<string, AnimationConfig>
): string {
  let css = "";

  for (const layer of layers) {
    const anim = animations[layer.id];
    if (!anim) continue;

    const id = layer.id;
    const cx = layer.left + layer.width / 2;
    const cy = layer.top + layer.height / 2;
    const hasFlip = !!(layer.flipH || layer.flipV);
    const flipPart = hasFlip ? `scale(${layer.flipH ? -1 : 1}, ${layer.flipV ? -1 : 1})` : "";

    const hasScale = anim.scale.enabled;
    const hasBounce = anim.bounce.enabled;
    const hasMove = anim.move.enabled;
    const hasRotate = anim.rotate.enabled;
    const hasFade = anim.fade?.enabled;
    const hasColor = anim.colorShift?.enabled;

    if (!hasScale && !hasBounce && !hasMove && !hasRotate && !hasFade && !hasColor && !hasFlip) continue;

    // Build transform parts WITHOUT rotate (for oscillating animation)
    const buildOscillatingTransform = (phase: "start" | "mid" | "end") => {
      const parts: string[] = [];
      if (flipPart) parts.push(flipPart);
      if (hasBounce) {
        const ty = phase === "mid" ? `-${anim.bounce.distance}px` : "0";
        parts.push(`translateY(${ty})`);
      }
      if (hasMove) {
        const tx = phase === "mid" ? `${anim.move.distance}px` : "0";
        parts.push(`translateX(${tx})`);
      }
      if (hasScale) {
        const sv = phase === "mid" ? anim.scale.value : 1;
        parts.push(`scale(${sv})`);
      }
      if (hasRotate && anim.rotate.mode === "alternate") {
        const deg = anim.rotate.clockwise ? anim.rotate.angle : -anim.rotate.angle;
        const rv = phase === "mid" ? deg : 0;
        parts.push(`rotate(${rv}deg)`);
      }
      return parts.join(" ");
    };

    // Build continuous rotate transform
    const buildContinuousRotateTransform = (phase: "start" | "end") => {
      const deg = anim.rotate.clockwise ? anim.rotate.angle : -anim.rotate.angle;
      return phase === "start" ? "rotate(0deg)" : `rotate(${deg}deg)`;
    };

    const buildOpacity = (phase: "start" | "mid" | "end") => {
      if (!hasFade) return null;
      if (phase === "start") return anim.fade.fromOpacity;
      if (phase === "mid") return anim.fade.toOpacity;
      return anim.fade.fromOpacity;
    };

    const buildFilter = (phase: "start" | "mid" | "end") => {
      if (!hasColor) return null;
      if (phase === "start") return "hue-rotate(0deg) saturate(1) brightness(1)";
      if (phase === "mid") return `hue-rotate(${anim.colorShift.hueRotate}deg) saturate(${anim.colorShift.saturate}) brightness(${anim.colorShift.brightness})`;
      return "hue-rotate(0deg) saturate(1) brightness(1)";
    };

    const hasAnyEffect = hasScale || hasBounce || hasMove || hasRotate || hasFade || hasColor;

    // Flip-only: no animation, just static transform
    if (!hasAnyEffect && hasFlip) {
      css += `.layer-${id} { transform-origin: ${cx}px ${cy}px; transform: ${flipPart}; }\n`;
      continue;
    }

    const isContinuousRotate = hasRotate && anim.rotate.mode === "continuous";
    const hasOscillating = hasScale || hasBounce || hasMove || (hasRotate && anim.rotate.mode === "alternate") || hasFade || hasColor;

    // Determine loop and duration per group
    const anyLoop = (hasScale && anim.scale.loop) ||
                    (hasBounce && anim.bounce.loop) ||
                    (hasMove && anim.move.loop) ||
                    (hasRotate && anim.rotate.loop) ||
                    (hasFade && anim.fade.loop) ||
                    (hasColor && anim.colorShift.loop);

    const animParts: string[] = [];

    // --- Continuous rotate animation (separate) ---
    if (isContinuousRotate) {
      const rName = `anim-rot-${id}`;
      css += `@keyframes ${rName} {
  from { transform: ${flipPart ? flipPart + ' ' : ''}${buildContinuousRotateTransform("start")}; }
  to { transform: ${flipPart ? flipPart + ' ' : ''}${buildContinuousRotateTransform("end")}; }
}\n`;
      animParts.push(`${rName} ${anim.rotate.speed}s linear ${anim.rotate.loop ? "infinite" : "1"}`);
    }

    // --- Oscillating animation (bounce, scale, move, alternate rotate, fade, color) ---
    if (hasOscillating || (hasFlip && !isContinuousRotate)) {
      const hasOscTransform = hasScale || hasBounce || hasMove || (hasRotate && anim.rotate.mode === "alternate") || hasFlip;
      const oName = `anim-osc-${id}`;

      const buildOscFrame = (phase: "start" | "mid" | "end") => {
        const props: string[] = [];
        if (hasOscTransform) props.push(`transform: ${buildOscillatingTransform(phase)};`);
        const opacity = buildOpacity(phase);
        if (opacity !== null) props.push(`opacity: ${opacity};`);
        const filter = buildFilter(phase);
        if (filter !== null) props.push(`filter: ${filter};`);
        return props.join(" ");
      };

      css += `@keyframes ${oName} {
  0%, 100% { ${buildOscFrame("start")} }
  50% { ${buildOscFrame("mid")} }
}\n`;

      const oscSpeeds: number[] = [];
      if (hasScale) oscSpeeds.push(anim.scale.speed);
      if (hasBounce) oscSpeeds.push(anim.bounce.speed);
      if (hasMove) oscSpeeds.push(anim.move.speed);
      if (hasRotate && anim.rotate.mode === "alternate") oscSpeeds.push(anim.rotate.speed);
      if (hasFade) oscSpeeds.push(anim.fade.speed);
      if (hasColor) oscSpeeds.push(anim.colorShift.speed);
      const oscDuration = oscSpeeds.length > 0 ? Math.max(...oscSpeeds) : 1;

      animParts.push(`${oName} ${oscDuration}s ease-in-out ${anyLoop ? "infinite" : "1"}`);
    }

    // --- Only continuous rotate, no other effects ---
    if (isContinuousRotate && !hasOscillating && hasFlip) {
      // flip is in the rotate keyframe already, no extra needed
    }

    if (animParts.length > 0) {
      css += `.layer-${id} { transform-origin: ${cx}px ${cy}px; animation: ${animParts.join(", ")}; }\n`;
    } else if (hasFlip) {
      css += `.layer-${id} { transform-origin: ${cx}px ${cy}px; transform: ${flipPart}; }\n`;
    }
  }

  return css;
}

export function exportHtml(
  layers: LayerInfo[],
  animations: Record<string, AnimationConfig>,
  width: number,
  height: number
): string {
  const svgContent = exportSvg(layers, animations, width, height);
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Animated SVG</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #1a1a2e; }
  svg { max-width: 100vw; max-height: 100vh; width: auto; height: auto; }
</style>
</head>
<body>
${svgContent}
</body>
</html>`;
}

export function exportSvg(
  layers: LayerInfo[],
  animations: Record<string, AnimationConfig>,
  width: number,
  height: number
): string {
  const css = generateAnimationCSS(layers, animations);
  const visibleLayers = layers.filter((l) => l.visible && !l.exportExcluded);
  const renderLayers = [...visibleLayers].reverse();

  const images = renderLayers
    .map(
      (l) =>
        `  <image href="${l.imageDataUrl}" x="${l.left}" y="${l.top}" width="${l.width}" height="${l.height}" class="layer-${l.id}" style="transform-origin: ${l.left + l.width / 2}px ${l.top + l.height / 2}px" />`
    )
    .join("\n");

  // Embed animation metadata as JSON in a custom metadata element
  const metadata = JSON.stringify(
    Object.fromEntries(
      layers
        .filter((l) => l.visible && !l.exportExcluded)
        .map((l) => [l.id, { name: l.name, animation: animations[l.id] || null }])
    )
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <metadata>
    <animtool:settings xmlns:animtool="https://psd-sparkle-svg.lovable.app/ns">${metadata}</animtool:settings>
  </metadata>
  <defs>
    <style>
${css}
    </style>
  </defs>
${images}
</svg>`;
}
