import { LayerInfo, AnimationConfig, defaultAnimationConfig } from "@/types/psd";

interface SvgImportResult {
  layers: LayerInfo[];
  animations: Record<string, AnimationConfig>;
  canvasSize: { w: number; h: number };
}

export function importSvg(svgText: string): SvgImportResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) throw new Error("Invalid SVG");

  // Parse canvas size from viewBox or width/height
  const viewBox = svg.getAttribute("viewBox");
  let w = parseInt(svg.getAttribute("width") || "0");
  let h = parseInt(svg.getAttribute("height") || "0");
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length === 4) {
      w = parts[2] || w;
      h = parts[3] || h;
    }
  }

  // Try to read embedded metadata first
  const metaEl = svg.querySelector("metadata *");
  let embeddedMeta: Record<string, { name?: string; animation?: AnimationConfig }> | null = null;
  if (metaEl?.textContent) {
    try {
      embeddedMeta = JSON.parse(metaEl.textContent);
    } catch { /* fall back to CSS parsing */ }
  }

  // Extract CSS from <style> inside <defs> (fallback)
  const styleEl = svg.querySelector("defs style");
  const cssText = styleEl?.textContent || "";

  // Parse layers from <image> elements
  const images = svg.querySelectorAll("image");
  const layers: LayerInfo[] = [];
  const animations: Record<string, AnimationConfig> = {};

  // Images are rendered in reverse order (bottom-up), so we reverse back
  const imageArr = Array.from(images).reverse();

  for (const img of imageArr) {
    const className = img.getAttribute("class") || "";
    const match = className.match(/layer-(.+)/);
    if (!match) continue;

    const id = match[1];
    const href = img.getAttribute("href") || img.getAttributeNS("http://www.w3.org/1999/xlink", "href") || "";
    const left = parseFloat(img.getAttribute("x") || "0");
    const top = parseFloat(img.getAttribute("y") || "0");
    const width = parseFloat(img.getAttribute("width") || "0");
    const height = parseFloat(img.getAttribute("height") || "0");

    const meta = embeddedMeta?.[id];

    layers.push({
      id,
      name: meta?.name || `圖層 ${layers.length + 1}`,
      left,
      top,
      width,
      height,
      imageDataUrl: href,
      visible: true,
    });

    // Use embedded metadata if available, otherwise fall back to CSS parsing
    animations[id] = meta?.animation
      ? JSON.parse(JSON.stringify(meta.animation))
      : parseAnimationFromCSS(cssText, id);
  }

  return { layers, animations, canvasSize: { w, h } };
}

function parseAnimationFromCSS(css: string, layerId: string): AnimationConfig {
  const config: AnimationConfig = JSON.parse(JSON.stringify(defaultAnimationConfig));
  const animName = `anim-${layerId}`;

  // Find the .layer-{id} rule to get duration, iteration
  const layerRuleRegex = new RegExp(`\\.layer-${escapeRegex(layerId)}\\s*\\{([^}]+)\\}`);
  const layerMatch = css.match(layerRuleRegex);
  if (!layerMatch) return config;

  const layerProps = layerMatch[1];
  const animProp = layerProps.match(/animation:\s*([^;]+)/);
  if (!animProp) return config;

  const animValue = animProp[1].trim();
  const durationMatch = animValue.match(/([\d.]+)s/);
  const duration = durationMatch ? parseFloat(durationMatch[1]) : 1;
  const isInfinite = animValue.includes("infinite");

  // Find the keyframes
  const kfRegex = new RegExp(`@keyframes\\s+${escapeRegex(animName)}\\s*\\{([\\s\\S]*?)\\}\\n`);
  const kfMatch = css.match(kfRegex);
  if (!kfMatch) return config;

  const kfBody = kfMatch[1];
  const isFromTo = kfBody.includes("from {") || kfBody.includes("from{");

  // Extract 50% or "to" frame properties
  let midFrame = "";
  if (isFromTo) {
    const toMatch = kfBody.match(/to\s*\{([^}]+)\}/);
    midFrame = toMatch ? toMatch[1] : "";
  } else {
    const fiftyMatch = kfBody.match(/50%\s*\{([^}]+)\}/);
    midFrame = fiftyMatch ? fiftyMatch[1] : "";
  }

  // Parse transform
  const transformMatch = midFrame.match(/transform:\s*([^;]+)/);
  if (transformMatch) {
    const transform = transformMatch[1].trim();

    // translateY → bounce
    const tyMatch = transform.match(/translateY\((-?[\d.]+)px\)/);
    if (tyMatch) {
      config.bounce.enabled = true;
      config.bounce.distance = Math.abs(parseFloat(tyMatch[1]));
      config.bounce.speed = duration;
      config.bounce.loop = isInfinite;
    }

    // translateX → move
    const txMatch = transform.match(/translateX\((-?[\d.]+)px\)/);
    if (txMatch) {
      config.move.enabled = true;
      config.move.distance = parseFloat(txMatch[1]);
      config.move.speed = duration;
      config.move.loop = isInfinite;
    }

    // scale
    const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
    if (scaleMatch) {
      config.scale.enabled = true;
      config.scale.value = parseFloat(scaleMatch[1]);
      config.scale.speed = duration;
      config.scale.loop = isInfinite;
    }

    // rotate (from-to style: parse "to" frame)
    const rotateMatch = transform.match(/rotate\((-?[\d.]+)deg\)/);
    if (rotateMatch) {
      const angle = parseFloat(rotateMatch[1]);
      config.rotate.enabled = true;
      if (isFromTo) {
        // from/to → full rotation
        config.rotate.angle = Math.abs(angle);
        config.rotate.clockwise = angle >= 0;
      } else {
        // 50% keyframe has half the angle
        config.rotate.angle = Math.abs(angle) * 2;
        config.rotate.clockwise = angle >= 0;
      }
      config.rotate.speed = duration;
      config.rotate.loop = isInfinite;
    }
  }

  // Parse opacity → fade
  const opacityMatch = midFrame.match(/opacity:\s*([\d.]+)/);
  if (opacityMatch) {
    config.fade.enabled = true;
    config.fade.toOpacity = parseFloat(opacityMatch[1]);
    // Parse start frame opacity
    const startFrame = isFromTo
      ? (kfBody.match(/from\s*\{([^}]+)\}/) || ["", ""])[1]
      : (kfBody.match(/0%[^{]*\{([^}]+)\}/) || ["", ""])[1];
    const startOpMatch = startFrame.match(/opacity:\s*([\d.]+)/);
    config.fade.fromOpacity = startOpMatch ? parseFloat(startOpMatch[1]) : 1;
    config.fade.speed = duration;
    config.fade.loop = isInfinite;
  }

  // Parse filter → colorShift
  const filterMatch = midFrame.match(/filter:\s*([^;]+)/);
  if (filterMatch) {
    const filter = filterMatch[1];
    const hueMatch = filter.match(/hue-rotate\((\d+)deg\)/);
    const satMatch = filter.match(/saturate\(([\d.]+)\)/);
    const brightMatch = filter.match(/brightness\(([\d.]+)\)/);
    if (hueMatch || satMatch || brightMatch) {
      config.colorShift.enabled = true;
      config.colorShift.hueRotate = hueMatch ? parseInt(hueMatch[1]) : 0;
      config.colorShift.saturate = satMatch ? parseFloat(satMatch[1]) : 1;
      config.colorShift.brightness = brightMatch ? parseFloat(brightMatch[1]) : 1;
      config.colorShift.speed = duration;
      config.colorShift.loop = isInfinite;
    }
  }

  return config;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
