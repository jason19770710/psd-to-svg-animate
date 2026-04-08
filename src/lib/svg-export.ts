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

    const hasTransform = hasScale || hasBounce || hasMove || hasRotate || hasFlip;

    // Build transform string for a given phase
    const buildTransform = (phase: "start" | "mid" | "end") => {
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

      if (hasRotate) {
        const deg = anim.rotate.clockwise ? anim.rotate.angle : -anim.rotate.angle;
        if (anim.rotate.mode === "continuous") {
          // continuous: 0 → full angle
          if (phase === "start") parts.push("rotate(0deg)");
          else if (phase === "mid") parts.push(`rotate(${deg / 2}deg)`);
          else parts.push(`rotate(${deg}deg)`);
        } else {
          // alternate: 0 → angle → 0
          const rv = phase === "mid" ? deg : 0;
          parts.push(`rotate(${rv}deg)`);
        }
      }

      return parts.join(" ");
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

    // Determine loop and duration
    const anyLoop = (hasScale && anim.scale.loop) ||
                    (hasBounce && anim.bounce.loop) ||
                    (hasMove && anim.move.loop) ||
                    (hasRotate && anim.rotate.loop) ||
                    (hasFade && anim.fade.loop) ||
                    (hasColor && anim.colorShift.loop);

    const speeds: number[] = [];
    if (hasScale) speeds.push(anim.scale.speed);
    if (hasBounce) speeds.push(anim.bounce.speed);
    if (hasMove) speeds.push(anim.move.speed);
    if (hasRotate) speeds.push(anim.rotate.speed);
    if (hasFade) speeds.push(anim.fade.speed);
    if (hasColor) speeds.push(anim.colorShift.speed);
    const duration = Math.max(...speeds);

    const isRotateOnly = hasRotate && !hasScale && !hasBounce && !hasMove && !hasFade && !hasColor;

    const name = `anim-${id}`;

    const buildFrame = (phase: "start" | "mid" | "end") => {
      const props: string[] = [];
      if (hasTransform) props.push(`transform: ${buildTransform(phase)};`);
      const opacity = buildOpacity(phase);
      if (opacity !== null) props.push(`opacity: ${opacity};`);
      const filter = buildFilter(phase);
      if (filter !== null) props.push(`filter: ${filter};`);
      return props.join(" ");
    };

    if (isRotateOnly) {
      css += `@keyframes ${name} {
  from { ${buildFrame("start")} }
  to { ${buildFrame("end")} }
}\n`;
    } else {
      css += `@keyframes ${name} {
  0%, 100% { ${buildFrame("start")} }
  50% { ${buildFrame("mid")} }
}\n`;
    }

    const easing = isRotateOnly ? "linear" : "ease-in-out";
    css += `.layer-${id} { transform-origin: ${cx}px ${cy}px; animation: ${name} ${duration}s ${easing} ${anyLoop ? "infinite" : "1"}; }\n`;
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
