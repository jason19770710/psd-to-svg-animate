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
    const origin = `${cx}px ${cy}px`;
    const hasFlip = !!(layer.flipH || layer.flipV);
    const flipPart = hasFlip ? `scale(${layer.flipH ? -1 : 1}, ${layer.flipV ? -1 : 1})` : "";

    const hasScale = anim.scale.enabled;
    const hasBounce = anim.bounce.enabled;
    const hasMove = anim.move.enabled;
    const hasRotate = anim.rotate.enabled;
    const hasFade = anim.fade?.enabled;
    const hasColor = anim.colorShift?.enabled;

    if (!hasScale && !hasBounce && !hasMove && !hasRotate && !hasFade && !hasColor && !hasFlip) continue;

    // --- Flip (static transform on image element) ---
    if (hasFlip) {
      css += `.layer-flip-${id} { transform-origin: ${origin}; transform: ${flipPart}; }\n`;
    }

    // --- Continuous rotate (separate wrapper) ---
    if (hasRotate && anim.rotate.mode === "continuous") {
      const deg = anim.rotate.clockwise ? anim.rotate.angle : -anim.rotate.angle;
      const rName = `anim-rot-${id}`;
      css += `@keyframes ${rName} {
  from { transform: rotate(0deg); }
  to { transform: rotate(${deg}deg); }
}\n`;
      css += `.layer-rot-${id} { transform-origin: ${origin}; animation: ${rName} ${anim.rotate.speed}s linear ${anim.rotate.loop ? "infinite" : "1"}; }\n`;
    }

    // --- Oscillating transform (bounce + move + scale + alternate rotate) ---
    const hasAlternateRotate = hasRotate && anim.rotate.mode === "alternate";
    const hasOscTransform = hasScale || hasBounce || hasMove || hasAlternateRotate;

    if (hasOscTransform) {
      const oName = `anim-osc-${id}`;
      const buildOsc = (phase: "start" | "mid") => {
        const parts: string[] = [];
        if (hasBounce) {
          parts.push(`translateY(${phase === "mid" ? `-${anim.bounce.distance}px` : "0"})`);
        }
        if (hasMove) {
          parts.push(`translateX(${phase === "mid" ? `${anim.move.distance}px` : "0"})`);
        }
        if (hasScale) {
          parts.push(`scale(${phase === "mid" ? anim.scale.value : 1})`);
        }
        if (hasAlternateRotate) {
          const deg = anim.rotate.clockwise ? anim.rotate.angle : -anim.rotate.angle;
          parts.push(`rotate(${phase === "mid" ? deg : 0}deg)`);
        }
        return parts.join(" ");
      };

      const oscSpeeds: number[] = [];
      if (hasScale) oscSpeeds.push(anim.scale.speed);
      if (hasBounce) oscSpeeds.push(anim.bounce.speed);
      if (hasMove) oscSpeeds.push(anim.move.speed);
      if (hasAlternateRotate) oscSpeeds.push(anim.rotate.speed);
      const oscDuration = Math.max(...oscSpeeds);

      const anyOscLoop = (hasScale && anim.scale.loop) ||
                         (hasBounce && anim.bounce.loop) ||
                         (hasMove && anim.move.loop) ||
                         (hasAlternateRotate && anim.rotate.loop);

      css += `@keyframes ${oName} {
  0%, 100% { transform: ${buildOsc("start")}; }
  50% { transform: ${buildOsc("mid")}; }
}\n`;
      css += `.layer-osc-${id} { transform-origin: ${origin}; animation: ${oName} ${oscDuration}s ease-in-out ${anyOscLoop ? "infinite" : "1"}; }\n`;
    }

    // --- Fade (opacity) ---
    if (hasFade) {
      const fName = `anim-fade-${id}`;
      css += `@keyframes ${fName} {
  0%, 100% { opacity: ${anim.fade.fromOpacity}; }
  50% { opacity: ${anim.fade.toOpacity}; }
}\n`;
      css += `.layer-fade-${id} { animation: ${fName} ${anim.fade.speed}s ease-in-out ${anim.fade.loop ? "infinite" : "1"}; }\n`;
    }

    // --- Color shift (filter) ---
    if (hasColor) {
      const cName = `anim-color-${id}`;
      css += `@keyframes ${cName} {
  0%, 100% { filter: hue-rotate(0deg) saturate(1) brightness(1); }
  50% { filter: hue-rotate(${anim.colorShift.hueRotate}deg) saturate(${anim.colorShift.saturate}) brightness(${anim.colorShift.brightness}); }
}\n`;
      css += `.layer-color-${id} { animation: ${cName} ${anim.colorShift.speed}s ease-in-out ${anim.colorShift.loop ? "infinite" : "1"}; }\n`;
    }
  }

  return css;
}

/** Build nested SVG elements for a layer (for both preview and export) */
export function buildLayerSvgElements(layer: LayerInfo, anim: AnimationConfig | undefined): {
  wrapperClasses: string[];  // classes for nested <g> wrappers, outermost first
  imageClass: string;        // class for the <image> element (flip)
} {
  const id = layer.id;
  const hasFlip = !!(layer.flipH || layer.flipV);
  const hasRotate = anim?.rotate?.enabled;
  const isContinuousRotate = hasRotate && anim?.rotate?.mode === "continuous";
  const hasOscTransform = anim?.scale?.enabled || anim?.bounce?.enabled || anim?.move?.enabled ||
    (hasRotate && anim?.rotate?.mode === "alternate");
  const hasFade = anim?.fade?.enabled;
  const hasColor = anim?.colorShift?.enabled;

  const wrapperClasses: string[] = [];

  // Outermost → innermost order
  if (isContinuousRotate) wrapperClasses.push(`layer-rot-${id}`);
  if (hasOscTransform) wrapperClasses.push(`layer-osc-${id}`);
  if (hasFade) wrapperClasses.push(`layer-fade-${id}`);
  if (hasColor) wrapperClasses.push(`layer-color-${id}`);

  const imageClass = hasFlip ? `layer-flip-${id}` : "";

  return { wrapperClasses, imageClass };
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
    .map((l) => {
      const anim = animations[l.id];
      const { wrapperClasses, imageClass } = buildLayerSvgElements(l, anim);
      const origin = `${l.left + l.width / 2}px ${l.top + l.height / 2}px`;

      let inner = `<image href="${l.imageDataUrl}" x="${l.left}" y="${l.top}" width="${l.width}" height="${l.height}"${imageClass ? ` class="${imageClass}"` : ""} style="transform-origin: ${origin}" />`;

      // Wrap with nested <g> elements (innermost class last in array = innermost wrapper)
      for (let i = wrapperClasses.length - 1; i >= 0; i--) {
        inner = `<g class="${wrapperClasses[i]}" style="transform-origin: ${origin}">${inner}</g>`;
      }

      return `  ${inner}`;
    })
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
