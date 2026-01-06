<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns mask-tool-layout">
      <div class="panel mask-column">
        <div class="panel-header">
          <h2>重绘区域遮罩绘制</h2>
          <p>上传图片，使用画笔绘制遮罩区域，导出二值掩膜图像。</p>
        </div>

        <div class="mask-controls" v-if="imageUrl">
          <div class="control-group">
            <label class="field-label">工具</label>
            <div class="btn-group">
              <button
                class="btn"
                :class="{ 'btn-primary': toolType === 'brush', 'btn-secondary': toolType !== 'brush' }"
                @click="toolType = 'brush'"
                title="画笔"
              >
                画笔
              </button>
              <button
                class="btn"
                :class="{ 'btn-primary': toolType === 'eraser', 'btn-secondary': toolType !== 'eraser' }"
                @click="toolType = 'eraser'"
                title="橡皮擦"
              >
                橡皮擦
              </button>
              <button
                class="btn"
                :class="{ 'btn-primary': toolType === 'fill', 'btn-secondary': toolType !== 'fill' }"
                @click="toolType = 'fill'"
                title="油漆桶"
              >
                油漆桶
              </button>
            </div>
          </div>

          <div class="control-group" v-if="toolType !== 'fill'">
            <label class="field-label">笔刷大小: <span class="size-value">{{ brushSize }}px</span></label>
            <input
              type="range"
              min="1"
              max="100"
              v-model.number="brushSize"
              class="range-input"
            >
          </div>

          <div class="control-group">
            <label class="field-label">缩放: <span class="size-value" style="width: 60px">{{ fitToScreen ? '自适应' : Math.round(zoomLevel * 100) + '%' }}</span></label>
            <div class="btn-group">
              <button class="btn btn-secondary" @click="zoomOut" title="缩小">-</button>
              <button class="btn btn-secondary" @click="resetZoom" title="自适应">Fit</button>
              <button class="btn btn-secondary" @click="zoomIn" title="放大">+</button>
            </div>
          </div>

          <div class="control-group actions">
            <button class="btn btn-secondary" @click="clearMask">清空遮罩</button>
            <button class="btn btn-primary" @click="saveMask">保存遮罩</button>
          </div>
        </div>

        <div
          class="mask-dropzone"
          :class="{ 'has-image': !!imageUrl }"
          v-if="!imageUrl"
        >
          <FileDropzone
            accept="image/*"
            placeholder="点击或拖入图片"
            hint="支持 PNG, JPG, WEBP 等格式"
            @files="handleFileSelect"
          />
        </div>
        
        <div class="mask-workspace" v-else>
          <div class="canvas-container" ref="containerRef">
            <div class="canvas-wrapper" :class="{ 'fit-mode': fitToScreen }" :style="wrapperStyle">
              <img :src="imageUrl" ref="imageRef" alt="Original" class="bg-image" @load="initCanvas" />
              <canvas
                ref="canvasRef"
                class="draw-canvas"
                @mousedown="startDrawing"
                @mousemove="draw"
                @mouseup="stopDrawing"
                @mouseleave="stopDrawing"
              ></canvas>
            </div>
          </div>
          <div class="workspace-actions">
             <button class="btn btn-ghost small" @click="resetTool">重新上传</button>
          </div>
        </div>
      </div>

      <div class="panel preview-column" v-if="imageUrl">
        <div class="panel-header">
           <h2>遮罩预览</h2>
           <p>最终导出的二值图像效果</p>
        </div>
        <div class="preview-box">
           <canvas ref="previewCanvasRef" class="preview-canvas"></canvas>
        </div>

        <div class="usage-hint">
          <h3>AI重绘提示词</h3>
          <div class="hint-content">
            <p>使用方法：<br>将原图作为图1、遮罩图作为图2输入大香蕉，然后使用以下提示词：</p>
            <pre class="code-block">
我想编辑一张图片。

图1是原始图像。

图2是一个Binary Mask，其中白色像素表示需要修改/修复的区域，黑色像素应保持不变。

任务：&lt;此处替换为具体任务描述&gt;

确保修改部分与原始图像的其他部分自然融合。
            </pre>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import FileDropzone from '../common/FileDropzone.vue';
import { useToast } from '../../composables/useToast.js';
import { useDownload } from '../../composables/useDownload.js';

const { showToast } = useToast();
const { downloadBlob } = useDownload();

const imageUrl = ref('');
const fileName = ref('');
const toolType = ref('brush');
const brushSize = ref(20);
const isDrawing = ref(false);

const naturalWidth = ref(0);
const naturalHeight = ref(0);
const fitToScreen = ref(true);
const zoomLevel = ref(1);

const containerRef = ref(null);
const imageRef = ref(null);
const canvasRef = ref(null);
const previewCanvasRef = ref(null);

let ctx = null;
let lastX = 0;
let lastY = 0;

// Initialize canvas size to match image
function initCanvas() {
  if (!imageRef.value || !canvasRef.value) return;
  
  const img = imageRef.value;
  const canvas = canvasRef.value;
  
  naturalWidth.value = img.naturalWidth;
  naturalHeight.value = img.naturalHeight;

  // Set canvas internal dimensions to match image natural size
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  
  ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  updatePreview();
}

function handleFileSelect(files) {
  if (!files.length) return;
  const file = files[0];
  if (!file.type.startsWith('image/')) {
    showToast('请上传图片文件', 'error');
    return;
  }
  
  fileName.value = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    imageUrl.value = e.target.result;
    // Wait for DOM update and image load
  };
  reader.readAsDataURL(file);
}

function startDrawing(e) {
  isDrawing.value = true;
  const { x, y } = getCoordinates(e);
  
  if (toolType.value === 'fill') {
    floodFill(x, y);
    return;
  }
  
  lastX = x;
  lastY = y;
  draw(e); // Draw a dot on click
}

function floodFill(startX, startY) {
  if (!ctx || !canvasRef.value) return;

  // Round coordinates
  startX = Math.round(startX);
  startY = Math.round(startY);

  const width = canvasRef.value.width;
  const height = canvasRef.value.height;

  // Get image data
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Check if we are filling on empty (0) or filled (255 alpha) area
  // We use alpha channel to determine state
  const startPos = (startY * width + startX) * 4;
  const startAlpha = data[startPos + 3];
  
  // If clicking on filled area, we erase (fill with 0 alpha)
  // If clicking on empty area, we fill (fill with color)
  const isErasing = startAlpha > 128;
  
  // Target color to fill with
  const r = 255, g = 0, b = 0, a = 255; // Red for mask

  // Stack-based flood fill
  const stack = [[startX, startY]];
  const visited = new Set(); // Use a Set to track visited pixels by index
  
  // Maximum iterations safeguard to prevent freeze
  let iterations = 0;
  const MAX_ITERATIONS = width * height * 4; // Safety limit

  while (stack.length && iterations < MAX_ITERATIONS) {
    iterations++;
    const [x, y] = stack.pop();
    const pos = (y * width + x) * 4;
    
    // Use position index as key for visited set (faster than string)
    if (visited.has(pos)) continue;
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    
    const currentAlpha = data[pos + 3];
    
    // Check if this pixel matches the start state (filled vs empty)
    const matchesStart = isErasing ? currentAlpha > 128 : currentAlpha <= 128;
    
    if (matchesStart) {
      visited.add(pos); // Mark as processed

      // Apply change
      if (isErasing) {
         data[pos + 3] = 0; // Clear alpha
      } else {
         data[pos] = r;
         data[pos + 1] = g;
         data[pos + 2] = b;
         data[pos + 3] = a;
      }
      
      // Add neighbors
      if (x + 1 < width) stack.push([x + 1, y]);
      if (x - 1 >= 0) stack.push([x - 1, y]);
      if (y + 1 < height) stack.push([x, y + 1]);
      if (y - 1 >= 0) stack.push([x, y - 1]);
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  updatePreview();
}

function draw(e) {
  if (!isDrawing.value || !ctx) return;
  
  const { x, y } = getCoordinates(e);
  
  ctx.lineWidth = brushSize.value;
  if (toolType.value === 'brush') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ff0000'; // Opaque red (opacity handled by CSS)
  } else {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
  }
  
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();
  
  lastX = x;
  lastY = y;
  
  updatePreview();
}

function stopDrawing() {
  isDrawing.value = false;
}

function getCoordinates(e) {
  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  
  // Calculate scale in case displayed size differs from natural size
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function clearMask() {
  if (!ctx || !canvasRef.value) return;
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
  updatePreview();
}

function updatePreview() {
    if (!previewCanvasRef.value || !canvasRef.value) return;
    
    const sourceCanvas = canvasRef.value;
    const previewCanvas = previewCanvasRef.value;
    const pCtx = previewCanvas.getContext('2d');
    
    previewCanvas.width = sourceCanvas.width;
    previewCanvas.height = sourceCanvas.height;
    
    // Fill black background
    pCtx.fillStyle = '#000000';
    pCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    // Draw mask as white
    // We can't just drawImage because the source is semi-transparent red.
    // We need to use the source alpha to draw white.
    
    // Strategy: Draw the source canvas onto preview canvas, but use composite operation or image data manipulation
    // Easier: Draw white rectangle over everything, but masked by the source canvas alpha.
    
    pCtx.globalCompositeOperation = 'source-over';
    // Create a temp canvas to extract the alpha shape as solid white
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sourceCanvas.width;
    tempCanvas.height = sourceCanvas.height;
    const tCtx = tempCanvas.getContext('2d');
    
    tCtx.drawImage(sourceCanvas, 0, 0);
    tCtx.globalCompositeOperation = 'source-in';
    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Now draw this solid white shape onto the black background
    pCtx.drawImage(tempCanvas, 0, 0);
}

function saveMask() {
  if (!previewCanvasRef.value) return;
  
  previewCanvasRef.value.toBlob((blob) => {
    const name = fileName.value.replace(/\.[^.]+$/, '') + '_mask.png';
    downloadBlob(name, blob);
    showToast('遮罩已保存', 'success');
  }, 'image/png');
}

function resetTool() {
  imageUrl.value = '';
  fileName.value = '';
  ctx = null;
  resetZoom();
}

function updateZoomFromFit() {
  if (!containerRef.value || !naturalWidth.value || !naturalHeight.value) return;
  
  const container = containerRef.value;
  const { clientWidth, clientHeight } = container;
  
  const scaleX = clientWidth / naturalWidth.value;
  const scaleY = clientHeight / naturalHeight.value;
  
  // fit mode logic: scale to fit, but max 1
  let scale = Math.min(scaleX, scaleY);
  if (scale > 1) scale = 1;
  
  zoomLevel.value = scale;
}

function zoomIn() {
  if (fitToScreen.value) {
    updateZoomFromFit();
    fitToScreen.value = false;
  }
  zoomLevel.value = Number((Math.min(5, zoomLevel.value + 0.1)).toFixed(2));
}

function zoomOut() {
  if (fitToScreen.value) {
    updateZoomFromFit();
    fitToScreen.value = false;
  }
  zoomLevel.value = Number((Math.max(0.1, zoomLevel.value - 0.1)).toFixed(2));
}

function resetZoom() {
  fitToScreen.value = true;
  zoomLevel.value = 1;
}

const wrapperStyle = computed(() => {
  if (fitToScreen.value) {
    return {
      width: '100%',
      height: '100%',
      display: 'grid',
      placeItems: 'center'
    };
  }
  return {
    width: `${naturalWidth.value * zoomLevel.value}px`,
    height: `${naturalHeight.value * zoomLevel.value}px`,
    display: 'grid',
    placeItems: 'center'
  };
});

watch(brushSize, () => {
  // could show cursor size indicator
});

</script>

<style scoped>
.mask-tool-layout {
  height: calc(100vh - 200px);
  min-height: 600px;
}

.mask-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.preview-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.mask-dropzone {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.mask-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: hidden;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
}

.canvas-container {
  position: relative;
  flex: 1;
  overflow: auto;
  display: grid;
  place-items: center;
  background: repeating-conic-gradient(#80808033 0% 25%, transparent 0% 50%) 50% / 20px 20px;
}

.canvas-wrapper {
  display: grid;
  place-items: center;
}

.bg-image {
  grid-area: 1 / 1;
  display: block;
  object-fit: contain;
}

.canvas-wrapper.fit-mode .bg-image {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.canvas-wrapper:not(.fit-mode) .bg-image {
  width: 100%;
  height: 100%;
}

.draw-canvas {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  opacity: 0.6;
  cursor: crosshair;
  touch-action: none;
}

.mask-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.range-input {
  width: 120px;
}

.size-value {
  display: inline-block;
  width: 48px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.btn-group {
  display: flex;
  gap: 0.25rem;
}

.preview-box {
  background: #000;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.preview-canvas {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border: 1px solid #333;
}

.workspace-actions {
    display: flex;
    justify-content: flex-end;
}

.usage-hint {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color, #444);
}

.usage-hint h3 {
  font-size: 1rem;
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.hint-content p {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.code-block {
  background: #000;
  padding: 0.75rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
  color: #e0e0e0;
  border: 1px solid #333;
  line-height: 1.5;
}
</style>

