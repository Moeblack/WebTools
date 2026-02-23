/**
 * Braille Art Conversion Logic
 */

/**
 * Convert ImageData to Braille Art string
 * @param {ImageData} imageData 
 * @param {Object} options 
 * @returns {string}
 */
export function imageDataToBraille(imageData, options = {}) {
  const { width, height, data } = imageData;
  const { threshold = 128, invert = false } = options;

  let result = "";

  // Braille dot mapping (2x4 grid)
  // (0,0) -> 0x01
  // (0,1) -> 0x02
  // (0,2) -> 0x04
  // (1,0) -> 0x08
  // (1,1) -> 0x10
  // (1,2) -> 0x20
  // (0,3) -> 0x40
  // (1,3) -> 0x80

  const dotMapping = [
    [0x01, 0x08],
    [0x02, 0x10],
    [0x04, 0x20],
    [0x40, 0x80],
  ];

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 2) {
      let brailleChar = 0;

      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const px = x + dx;
          const py = y + dy;

          if (px < width && py < height) {
            const idx = (py * width + px) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // Calculate luminance
            // If alpha is 0, consider it white (not a dot)
            let luminance = a === 0 ? 255 : (0.2126 * r + 0.7152 * g + 0.0722 * b);
            
            let isDot = invert ? luminance > threshold : luminance < threshold;

            if (isDot) {
              brailleChar |= dotMapping[dy][dx];
            }
          }
        }
      }

      result += String.fromCharCode(0x2800 + brailleChar);
    }
    result += "\n";
  }

  return result;
}

/**
 * Resize image to target width in Braille characters
 * @param {HTMLImageElement} img 
 * @param {number} targetCharWidth 
 * @returns {HTMLCanvasElement}
 */
export function resizeImageForBraille(img, targetCharWidth) {
  // Each Braille character is 2 pixels wide
  const targetPixelWidth = targetCharWidth * 2;
  const scale = targetPixelWidth / img.width;
  const targetPixelHeight = Math.round(img.height * scale);

  // We want height to be a multiple of 4 for clean Braille blocks
  const finalPixelHeight = Math.ceil(targetPixelHeight / 4) * 4;

  const canvas = document.createElement("canvas");
  canvas.width = targetPixelWidth;
  canvas.height = finalPixelHeight;
  
  const ctx = canvas.getContext("2d");
  // Use imageSmoothingEnabled = true for better downscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetPixelWidth, finalPixelHeight);

  return canvas;
}
