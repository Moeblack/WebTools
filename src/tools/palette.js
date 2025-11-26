// 调色盘处理模块：提供颜色量化、调色盘生成和像素映射功能
// 使用 gifenc 库的算法实现高质量的颜色量化

import { lazyLoadScript } from "../utils/lazyLoad.js";

// gifenc CDN 地址
const GIFENC_URL = "https://unpkg.com/gifenc@1.0.3/dist/gifenc.umd.js";

// 模块引用缓存
let gifencModule = null;

/**
 * 确保 gifenc 库已加载
 * @returns {Promise<boolean>}
 */
export async function ensureGifenc() {
  if (gifencModule) return true;

  // 尝试 ESM 导入
  try {
    const mod = await import("https://unpkg.com/gifenc@1.0.3/dist/gifenc.esm.js");
    gifencModule = mod;
    return true;
  } catch (e) {
    console.warn("ESM 导入失败，尝试 UMD 方式", e);
  }

  // 降级到 UMD
  try {
    await lazyLoadScript(GIFENC_URL, () => !!window.gifenc, { timeout: 15000 });
    gifencModule = window.gifenc;
    return !!gifencModule;
  } catch (e) {
    console.error("gifenc 加载失败", e);
    return false;
  }
}

/**
 * 获取 gifenc 模块
 * @returns {object|null}
 */
export function getGifencModule() {
  return gifencModule;
}

/**
 * 从 Canvas 获取 RGBA 像素数据
 * @param {HTMLCanvasElement} canvas
 * @returns {{data: Uint8ClampedArray, width: number, height: number}}
 */
export function getCanvasPixels(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    data: imageData.data,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * 从多个 Canvas 合并像素样本用于生成全局调色盘
 * @param {HTMLCanvasElement[]} canvases
 * @param {number} sampleRate 采样率（0-1），1 表示全部采样
 * @returns {Uint8Array} RGBA 像素数组
 */
export function mergeCanvasPixels(canvases, sampleRate = 0.5) {
  if (!canvases?.length) return new Uint8Array(0);

  const allPixels = [];
  const step = Math.max(1, Math.floor(1 / sampleRate));

  canvases.forEach((canvas) => {
    const { data } = getCanvasPixels(canvas);
    // 按采样率抽取像素
    for (let i = 0; i < data.length; i += 4 * step) {
      // 跳过完全透明的像素
      if (data[i + 3] < 10) continue;
      allPixels.push(data[i], data[i + 1], data[i + 2], data[i + 3]);
    }
  });

  return new Uint8Array(allPixels);
}

/**
 * 生成调色盘
 * @param {Uint8Array|Uint8ClampedArray} rgbaPixels RGBA 像素数据
 * @param {number} maxColors 最大颜色数（最多 256）
 * @param {object} options 选项
 * @param {string} options.format 颜色格式 "rgb565" | "rgb444" | "rgba4444"
 * @returns {number[][]} 调色盘数组 [[r,g,b], [r,g,b], ...]
 */
export function generatePalette(rgbaPixels, maxColors = 256, options = {}) {
  if (!gifencModule) {
    throw new Error("gifenc 模块未加载，请先调用 ensureGifenc()");
  }

  const { quantize } = gifencModule;
  const format = options.format || "rgb565";

  // quantize 返回的是 [[r,g,b], [r,g,b], ...] 格式
  const palette = quantize(rgbaPixels, Math.min(256, Math.max(2, maxColors)), {
    format,
    oneBitAlpha: true,
  });

  return palette;
}

/**
 * 将图像像素映射到调色盘
 * @param {Uint8Array|Uint8ClampedArray} rgbaPixels RGBA 像素数据
 * @param {number[][]} palette 调色盘
 * @param {string} format 颜色格式
 * @returns {Uint8Array} 索引数组
 */
export function applyPaletteToPixels(rgbaPixels, palette, format = "rgb565") {
  if (!gifencModule) {
    throw new Error("gifenc 模块未加载");
  }

  const { applyPalette } = gifencModule;
  return applyPalette(rgbaPixels, palette, format);
}

/**
 * 将索引图像还原为 RGBA 像素
 * @param {Uint8Array} indexedPixels 索引数组
 * @param {number[][]} palette 调色盘
 * @returns {Uint8ClampedArray} RGBA 像素数据
 */
export function indexedToRgba(indexedPixels, palette) {
  const rgba = new Uint8ClampedArray(indexedPixels.length * 4);

  for (let i = 0; i < indexedPixels.length; i++) {
    const colorIndex = indexedPixels[i];
    const color = palette[colorIndex] || [0, 0, 0];
    const offset = i * 4;
    rgba[offset] = color[0];     // R
    rgba[offset + 1] = color[1]; // G
    rgba[offset + 2] = color[2]; // B
    rgba[offset + 3] = 255;      // A（调色盘颜色默认不透明）
  }

  return rgba;
}

/**
 * 对 Canvas 应用调色盘量化
 * @param {HTMLCanvasElement} sourceCanvas 源 Canvas
 * @param {number[][]} palette 调色盘
 * @param {string} format 颜色格式
 * @returns {HTMLCanvasElement} 新的量化后的 Canvas
 */
export function quantizeCanvas(sourceCanvas, palette, format = "rgb565") {
  const { data, width, height } = getCanvasPixels(sourceCanvas);

  // 应用调色盘获取索引
  const indexed = applyPaletteToPixels(data, palette, format);

  // 将索引还原为 RGBA
  const quantizedRgba = indexedToRgba(indexed, palette);

  // 创建新 Canvas
  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = width;
  resultCanvas.height = height;
  const ctx = resultCanvas.getContext("2d");

  const imageData = new ImageData(quantizedRgba, width, height);
  ctx.putImageData(imageData, 0, 0);

  return resultCanvas;
}

/**
 * 将调色盘转换为可视化的颜色数组（用于 UI 展示）
 * @param {number[][]} palette
 * @returns {{hex: string, rgb: number[], index: number}[]}
 */
export function paletteToDisplayColors(palette) {
  return palette.map((color, index) => {
    const [r, g, b] = color;
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    return { hex, rgb: [r, g, b], index };
  });
}

/**
 * 计算两个颜色之间的欧几里得距离
 * @param {number[]} c1 [r, g, b]
 * @param {number[]} c2 [r, g, b]
 * @returns {number}
 */
export function colorDistance(c1, c2) {
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * 对调色盘按亮度排序
 * @param {number[][]} palette
 * @returns {number[][]}
 */
export function sortPaletteByLuminance(palette) {
  return [...palette].sort((a, b) => {
    // 使用相对亮度公式
    const lumA = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2];
    const lumB = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
    return lumA - lumB;
  });
}

/**
 * 对调色盘按色相排序
 * @param {number[][]} palette
 * @returns {number[][]}
 */
export function sortPaletteByHue(palette) {
  return [...palette].sort((a, b) => {
    const hueA = rgbToHue(a[0], a[1], a[2]);
    const hueB = rgbToHue(b[0], b[1], b[2]);
    return hueA - hueB;
  });
}

/**
 * RGB 转色相值
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number} 0-360
 */
function rgbToHue(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  if (d === 0) return 0;

  let h;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return h * 360;
}
