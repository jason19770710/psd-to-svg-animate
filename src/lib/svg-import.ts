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

  const viewBox = svg.getAttribute("viewBox");
  let w = parseInt(svg.getAttribute("width") || "0");
  let h = parseInt(svg.getAttribute("height") || "0");
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length === 4) { w = parts[2] || w; h = parts[3] || h; }
  }

  const metaEl = svg.querySelector("metadata *");
  let embeddedMeta: Record<string, { name?: string; animation?: AnimationConfig }> | null = null;
  if (metaEl?.textContent) {
    try {
      const parsed = JSON.parse(metaEl.textContent);
      // Migrate old bounce/move → movement with angle
      for (const key of Object.keys(parsed)) {
        const anim = parsed[key]?.animation;
        if (anim && !anim.movement && (anim.bounce || anim.move)) {
          anim.movement = { ...defaultAnimationConfig.movement };
          if (anim.bounce?.enabled) {
            anim.movement.enabled = true;
            anim.movement.angle = 0; // up
            anim.movement.distance = anim.bounce.distance;
            anim.movement.speed = anim.bounce.speed;
            anim.movement.loop = anim.bounce.loop;
          }
          if (anim.move?.enabled) {
            anim.movement.enabled = true;
            anim.movement.angle = 90; // right
            anim.movement.distance = Math.abs(anim.move.distance);
            anim.movement.speed = anim.move.speed;
            anim.movement.loop = anim.move.loop;
          }
          delete anim.bounce;
          delete anim.move;
        }
        // Migrate old direction-based movement to angle-based
        if (anim?.movement?.direction) {
          const dirMap: Record<string, number> = {
            up: 0, "up-right": 45, right: 90, "down-right": 135,
            down: 180, "down-left": 225, left: 270, "up-left": 315,
          };
          anim.movement.angle = dirMap[anim.movement.direction] ?? 0;
          delete anim.movement.direction;
        }
      }
      embeddedMeta = parsed;
    } catch { /* fall back to CSS parsing */ }
  }

  const styleEl = svg.querySelector("defs style");
  const cssText = styleEl?.textContent || "";
  const images = svg.querySelectorAll("image");
  const layers: LayerInfo[] = [];
  const animations: Record<string, AnimationConfig> = {};
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

    layers.push({ id, name: meta?.name || `圖層 ${layers.length + 1}`, left, top, width, height, imageDataUrl: href, visible: true });
    animations[id] = meta?.animation ? JSON.parse(JSON.stringify(meta.animation)) : parseAnimationFromCSS(cssText, id);
  }

  return { layers, animations, canvasSize: { w, h } };
}

function parseAnimationFromCSS(css: string, layerId: string): AnimationConfig {
  const config: AnimationConfig = JSON.parse(JSON.stringify(defaultAnimationConfig));
  const animName = `anim-${layerId}`;

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

  const kfRegex = new RegExp(`@keyframes\\s+${escapeRegex(animName)}\\s*\\{([\\s\\S]*?)\\}\\n`);
  const kfMatch = css.match(kfRegex);
  if (!kfMatch) return config;

  const kfBody = kfMatch[1];
  const isFromTo = kfBody.includes("from {") || kfBody.includes("from{");

  let midFrame = "";
  if (isFromTo) {
    const toMatch = kfBody.match(/to\s*\{([^}]+)\}/);
    midFrame = toMatch ? toMatch[1] : "";
  } else {
    const fiftyMatch = kfBody.match(/50%\s*\{([^}]+)\}/);
    midFrame = fiftyMatch ? fiftyMatch[1] : "";
  }

  const transformMatch = midFrame.match(/transform:\s*([^;]+)/);
  if (transformMatch) {
    const transform = transformMatch[1].trim();

    // translate(dx, dy) or translateX/translateY → movement angle
    const translateMatch = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
    const tyMatch = transform.match(/translateY\((-?[\d.]+)px\)/);
    const txMatch = transform.match(/translateX\((-?[\d.]+)px\)/);

    let dx = 0, dy = 0;
    if (translateMatch) {
      dx = parseFloat(translateMatch[1]);
      dy = parseFloat(translateMatch[2]);
    } else if (tyMatch) {
      dy = parseFloat(tyMatch[1]);
    } else if (txMatch) {
      dx = parseFloat(txMatch[1]);
    }

    if (dx !== 0 || dy !== 0) {
      config.movement.enabled = true;
      config.movement.distance = Math.round(Math.sqrt(dx * dx + dy * dy));
      let angle = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
      if (angle < 0) angle += 360;
      config.movement.angle = angle;
      config.movement.speed = duration;
      config.movement.loop = isInfinite;
    }

    const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
    if (scaleMatch) {
      config.scale.enabled = true;
      config.scale.value = parseFloat(scaleMatch[1]);
      config.scale.speed = duration;
      config.scale.loop = isInfinite;
    }

    const rotateMatch = transform.match(/rotate\((-?[\d.]+)deg\)/);
    if (rotateMatch) {
      const a = parseFloat(rotateMatch[1]);
      config.rotate.enabled = true;
      config.rotate.angle = isFromTo ? Math.abs(a) : Math.abs(a) * 2;
      config.rotate.clockwise = a >= 0;
      config.rotate.speed = duration;
      config.rotate.loop = isInfinite;
    }
  }

  const opacityMatch = midFrame.match(/opacity:\s*([\d.]+)/);
  if (opacityMatch) {
    config.fade.enabled = true;
    config.fade.toOpacity = parseFloat(opacityMatch[1]);
    const startFrame = isFromTo
      ? (kfBody.match(/from\s*\{([^}]+)\}/) || ["", ""])[1]
      : (kfBody.match(/0%[^{]*\{([^}]+)\}/) || ["", ""])[1];
    const startOpMatch = startFrame.match(/opacity:\s*([\d.]+)/);
    config.fade.fromOpacity = startOpMatch ? parseFloat(startOpMatch[1]) : 1;
    config.fade.speed = duration;
    config.fade.loop = isInfinite;
  }

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
