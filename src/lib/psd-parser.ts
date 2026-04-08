import PSD from "psd.js";
import { LayerInfo } from "@/types/psd";

export interface ParsedPsd {
  width: number;
  height: number;
  layers: LayerInfo[];
}

function layerPixelsToDataUrl(node: any): string | null {
  try {
    // Try toPng first
    const png = node.layer.image.toPng();
    if (png && png.src && png.src.length > 50) {
      return png.src;
    }
  } catch {
    // fall through
  }

  // Fallback: manually compose from pixel data via canvas
  try {
    const { width, height } = node.layer.image;
    if (!width || !height || width <= 0 || height <= 0) return null;

    const pixelData = node.layer.image.pixelData;
    if (!pixelData || pixelData.length === 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const imageData = ctx.createImageData(width, height);

    // psd.js pixel data is in RGBA format
    if (pixelData.length === width * height * 4) {
      imageData.data.set(pixelData);
    } else {
      // Sometimes pixel data is channel-separated
      const numPixels = width * height;
      for (let i = 0; i < numPixels; i++) {
        imageData.data[i * 4] = pixelData[i] || 0;               // R
        imageData.data[i * 4 + 1] = pixelData[numPixels + i] || 0;   // G
        imageData.data[i * 4 + 2] = pixelData[numPixels * 2 + i] || 0; // B
        imageData.data[i * 4 + 3] = pixelData[numPixels * 3 + i] || 255; // A
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("Canvas fallback failed:", err);
    return null;
  }
}

export async function parsePsdFile(buffer: ArrayBuffer): Promise<ParsedPsd> {
  const psd = new PSD(new Uint8Array(buffer));
  psd.parse();

  const tree = psd.tree();
  const width = psd.header.cols;
  const height = psd.header.rows;
  const layers: LayerInfo[] = [];

  const descendants = tree.descendants();

  for (let i = 0; i < descendants.length; i++) {
    const node = descendants[i];
    if (!node.isLayer || !node.isLayer()) continue;
    

    const dataUrl = layerPixelsToDataUrl(node);

    if (!dataUrl) {
      console.warn(`Layer "${node.name}" could not be exported, skipping`);
      continue;
    }

    console.log(`Layer "${node.name}": pos(${node.left},${node.top}) size(${node.width}x${node.height})`);

    layers.push({
      id: `layer-${i}`,
      name: node.name,
      left: node.left,
      top: node.top,
      width: node.width,
      height: node.height,
      imageDataUrl: dataUrl,
      visible: true,
    });
  }

  console.log(`Total layers extracted: ${layers.length}`);
  return { width, height, layers };
}
