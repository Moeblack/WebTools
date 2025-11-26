<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns sprite-tool-layout">
      <div class="panel sprite-column">
        <div class="panel-header">
          <h2>Sprite Sheet 上传</h2>
          <p>点击或拖拽 PNG / JPG，设定分割参数即可预览动画。</p>
        </div>
        <div
          class="sprite-dropzone"
          :class="{ dragging: isDragging, 'has-image': imageUrl }"
          @click="triggerUpload"
          @dragenter.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @dragover.prevent
          @drop.prevent="handleDrop"
        >
          <input
            ref="fileInput"
            class="sr-only"
            type="file"
            accept=".png,.jpg,.jpeg"
            @change="handleFileSelect($event.target.files)"
          >
          <div v-if="!imageUrl" class="dropzone-hint">
            <strong>点击或拖入精灵图</strong>
            <span>支持 PNG / JPG，推荐透明背景</span>
          </div>
          <div v-else class="dropzone-preview">
            <img :src="imageUrl" :alt="imageName || 'Sprite Sheet 预览'">
            <p class="muted">{{ imageName || 'Sprite Sheet' }}</p>
          </div>
        </div>
        <div class="form-row space-between">
          <p class="hint small-text">{{ status }}</p>
          <button
            class="btn btn-outline"
            :disabled="!imageUrl"
            @click.stop="editPanelOpen = !editPanelOpen"
          >
            {{ editPanelOpen ? "收起简单编辑" : "简单编辑" }}
          </button>
        </div>
        <div class="sprite-edit-panel" v-if="editPanelOpen">
          <div class="sprite-edit-grid">
            <label class="field small">
              <span class="field-label">裁剪起点 X</span>
              <input type="number" min="0" v-model.number="edit.cropX">
            </label>
            <label class="field small">
              <span class="field-label">裁剪起点 Y</span>
              <input type="number" min="0" v-model.number="edit.cropY">
            </label>
            <label class="field small">
              <span class="field-label">裁剪宽度</span>
              <input type="number" min="1" v-model.number="edit.cropWidth">
            </label>
            <label class="field small">
              <span class="field-label">裁剪高度</span>
              <input type="number" min="1" v-model.number="edit.cropHeight">
            </label>
          </div>
          <div class="sprite-edit-grid">
            <label class="field small">
              <span class="field-label">旋转</span>
              <select v-model.number="edit.rotation">
                <option :value="0">0°</option>
                <option :value="90">90°</option>
                <option :value="180">180°</option>
                <option :value="270">270°</option>
              </select>
            </label>
            <label class="checkbox">
              <input type="checkbox" v-model="edit.removeBg">
              <span>尝试去除背景</span>
            </label>
            <label class="field small" v-if="edit.removeBg">
              <span class="field-label">背景颜色</span>
              <input type="color" v-model="edit.bgColor">
            </label>
            <label class="field small" v-if="edit.removeBg">
              <span class="field-label">容差 {{ edit.bgTolerance }}</span>
              <input type="range" min="0" max="100" v-model.number="edit.bgTolerance">
            </label>
          </div>
          <div class="form-row wrap">
            <button class="btn btn-secondary" :disabled="!imageUrl" @click="applySpriteEdits">
              应用编辑
            </button>
            <button class="btn btn-ghost" :disabled="!originalDataUrl" @click="resetSpriteEdits">
              还原原图
            </button>
          </div>
        </div>
        <div class="sprite-settings-grid">
          <label class="field small">
            <span class="field-label">横向分割数（列）</span>
            <input type="number" min="1" v-model.number="columns">
          </label>
          <label class="field small">
            <span class="field-label">纵向分割数（行）</span>
            <input type="number" min="1" v-model.number="rows">
          </label>
          <label class="field small">
            <span class="field-label">动画速度 (FPS)</span>
            <input type="number" min="1" v-model.number="fps">
          </label>
          <label class="field small">
            <span class="field-label">内边距 (px)</span>
            <input type="number" min="0" v-model.number="spritePadding">
          </label>
        </div>
        <div class="sprite-preview-block">
          <div class="preview-canvas">
            <img
              v-if="framePreviews.length"
              :src="framePreviews[previewFrameIndex]"
              alt="GIF 预览"
            >
            <p v-else class="muted">上传并配置精灵图后，可在此处实时预览动画。</p>
          </div>
          <div class="form-row space-between">
            <div class="form-row compact">
              <button
                class="btn btn-secondary"
                :disabled="!framePreviews.length"
                @click="toggleSpritePreview"
              >
                {{ previewPlaying ? "暂停预览" : "继续预览" }}
              </button>
              <button
                class="btn btn-ghost"
                :disabled="!framePreviews.length"
                @click="previewFrameIndex = 0"
              >
                回到第 1 帧
              </button>
            </div>
            <p class="hint">FPS: {{ fps }}</p>
          </div>
        </div>
      </div>

      <div class="panel sprite-column">
        <div class="panel-header">
          <h2>分割确认（网格）</h2>
          <p>确认网格切割是否准确，必要时微调参数。</p>
        </div>
        <div
          class="grid-area"
          :class="{ 'is-interactive': gridPreviewUrl }"
          @click="handleSpriteGridClick"
        >
          <img
            v-if="gridPreviewUrl"
            ref="spriteGridImage"
            :src="gridPreviewUrl"
            alt="网格预览"
          >
          <p v-else class="muted">先在左侧上传精灵图，这里将显示网格与原图叠加效果。</p>
        </div>
        <p class="hint small-text" v-if="gridPreviewUrl">
          点击具体格子可切换丢弃该帧，再点一次即可恢复，同时可直观看到 padding 的有效区域。
        </p>
        <div class="sprite-meta">
          <p><strong>原图尺寸：</strong>{{ imageWidth }} × {{ imageHeight }}</p>
          <p><strong>单帧尺寸：</strong>{{ frameWidth }} × {{ frameHeight }}</p>
          <p>
            <strong>帧总数：</strong>{{ totalFrameCount }}
            <span v-if="discardedFrames.length" class="muted">（可用 {{ frameCount }}）</span>
          </p>
        </div>
        <button
          class="btn btn-primary full-width"
          :disabled="!frames.length || isGenerating"
          @click="generateSpriteGif"
        >
          {{ isGenerating ? "生成中..." : "生成 GIF 动画" }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onBeforeUnmount } from "vue";
import { lazyLoadScript } from "../../utils/lazyLoad.js";
import { useToast } from "../../composables/useToast.js";
import { useDownload } from "../../composables/useDownload.js";
import { useFileReader } from "../../composables/useFileReader.js";

const { showToast } = useToast();
const { downloadBlob } = useDownload();
const { readAsDataUrl, loadImageFromUrl } = useFileReader();

const GIF_JS_URL = "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js";
const GIF_READY = () => typeof window !== "undefined" && typeof window.GIF === "function";
let gifJsReadyPromise = null;

// Refs
const fileInput = ref(null);
const spriteGridImage = ref(null);
const columns = ref(4);
const rows = ref(2);
const fps = ref(8);
const spritePadding = ref(0);
const imageName = ref("");
const imageUrl = ref("");
const originalDataUrl = ref("");
const imageWidth = ref(0);
const imageHeight = ref(0);
const frameWidth = ref(0);
const frameHeight = ref(0);
const totalFrameCount = ref(0);
const frameCount = ref(0);
const frames = ref([]);
const framePreviews = ref([]);
const allFrames = ref([]);
const allFramePreviews = ref([]);
const discardedFrames = ref([]);
const previewFrameIndex = ref(0);
const previewPlaying = ref(true);
const gridPreviewUrl = ref("");
const effectivePadding = ref(0);
const isDragging = ref(false);
const isGenerating = ref(false);
const status = ref("请选择 PNG / JPG 格式的精灵图");
const editPanelOpen = ref(false);
const workerUrl = ref("");
const workerBlobUrl = ref("");
const gifLibReady = ref(false);

const edit = reactive({
  cropX: 0,
  cropY: 0,
  cropWidth: 0,
  cropHeight: 0,
  rotation: 0,
  removeBg: false,
  bgColor: "#ffffff",
  bgTolerance: 30,
});

let spritePreviewTimer = null;

// Methods
function triggerUpload() {
  fileInput.value?.click();
}

async function handleFileSelect(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const file = files[0];
  if (!file.type?.startsWith("image/")) {
    showToast("仅支持 PNG / JPG 图片", "warning");
    return;
  }
  try {
    await loadSpriteFile(file);
  } catch (err) {
    showToast(err?.message || "图片加载失败", "error");
  } finally {
    if (fileInput.value) {
      fileInput.value.value = "";
    }
  }
}

function handleDrop(event) {
  isDragging.value = false;
  if (!event.dataTransfer?.files?.length) return;
  handleFileSelect(event.dataTransfer.files);
}

async function loadSpriteFile(file) {
  const dataUrl = await readAsDataUrl(file);
  imageName.value = file.name;
  originalDataUrl.value = dataUrl;
  imageUrl.value = dataUrl;
  await syncSpriteImageMeta(dataUrl);
}

async function syncSpriteImageMeta(src) {
  try {
    const image = await loadImageFromUrl(src);
    imageWidth.value = image.width;
    imageHeight.value = image.height;
    status.value = `原图尺寸：${image.width} × ${image.height}`;
    initializeSpriteEditBounds(image.width, image.height);
    await updateSpriteFrames();
  } catch (err) {
    showToast(err?.message || "无法读取图片信息", "error");
  }
}

function initializeSpriteEditBounds(width, height) {
  edit.cropX = 0;
  edit.cropY = 0;
  edit.cropWidth = width;
  edit.cropHeight = height;
  edit.rotation = 0;
  edit.removeBg = false;
}

function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computeSpriteGridMetrics(imgWidth, imgHeight, cols, rowCount, paddingValue) {
  const cellWidth = Math.floor(imgWidth / cols);
  const cellHeight = Math.floor(imgHeight / rowCount);
  if (cellWidth <= 0 || cellHeight <= 0) {
    throw new Error("请调整分割数以得到有效的帧尺寸");
  }
  const desiredPadding = Math.max(0, Number(paddingValue) || 0);
  const maxPadding = Math.min(Math.floor(cellWidth / 2) - 1, Math.floor(cellHeight / 2) - 1);
  const effPadding = Math.max(0, isNaN(maxPadding) ? 0 : Math.min(desiredPadding, Math.max(0, maxPadding)));
  const fWidth = Math.max(1, cellWidth - effPadding * 2);
  const fHeight = Math.max(1, cellHeight - effPadding * 2);
  return { cellWidth, cellHeight, effectivePadding: effPadding, frameWidth: fWidth, frameHeight: fHeight };
}

function refreshSpriteFrameUsage() {
  const discardSet = new Set(discardedFrames.value || []);
  const framesList = [];
  const previewsList = [];
  (allFrames.value || []).forEach((canvas, idx) => {
    if (discardSet.has(idx)) return;
    framesList.push(canvas);
    const preview = allFramePreviews.value?.[idx];
    if (preview) {
      previewsList.push(preview);
    } else {
      previewsList.push(canvas.toDataURL("image/png"));
    }
  });
  frames.value = framesList;
  framePreviews.value = previewsList;
  frameCount.value = framesList.length;
  if (!framesList.length) {
    previewFrameIndex.value = 0;
    stopSpritePreviewTimer();
  } else if (previewFrameIndex.value >= framesList.length) {
    previewFrameIndex.value = 0;
  }
  if (previewPlaying.value && framesList.length) {
    startSpritePreviewTimer();
  }
  updateSpriteFrameStatus();
}

function updateSpriteFrameStatus() {
  const total = totalFrameCount.value || 0;
  if (!total) return;
  const fWidth = frameWidth.value || 0;
  const fHeight = frameHeight.value || 0;
  const discarded = discardedFrames.value?.length || 0;
  let statusText = `总帧数 ${total} · 单帧 ${fWidth} × ${fHeight}`;
  if (discarded) {
    statusText += ` · 已丢弃 ${discarded} · 可用 ${Math.max(0, total - discarded)}`;
  }
  status.value = statusText;
}

async function updateSpriteFrames() {
  if (!imageUrl.value) {
    frames.value = [];
    framePreviews.value = [];
    allFrames.value = [];
    allFramePreviews.value = [];
    frameCount.value = 0;
    totalFrameCount.value = 0;
    frameWidth.value = 0;
    frameHeight.value = 0;
    gridPreviewUrl.value = "";
    previewFrameIndex.value = 0;
    discardedFrames.value = [];
    effectivePadding.value = 0;
    stopSpritePreviewTimer();
    status.value = "请选择 PNG / JPG 格式的精灵图";
    return;
  }
  const cols = Math.max(1, Math.floor(Number(columns.value) || 1));
  const rowCount = Math.max(1, Math.floor(Number(rows.value) || 1));
  try {
    const image = await loadImageFromUrl(imageUrl.value);
    const { cellWidth, cellHeight, effectivePadding: effPadding, frameWidth: fWidth, frameHeight: fHeight } = computeSpriteGridMetrics(
      image.width,
      image.height,
      cols,
      rowCount,
      spritePadding.value
    );
    const framesList = [];
    const previewsList = [];
    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const sx = col * cellWidth + effPadding;
        const sy = row * cellHeight + effPadding;
        const frameCanvas = document.createElement("canvas");
        frameCanvas.width = fWidth;
        frameCanvas.height = fHeight;
        const ctx = frameCanvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, fWidth, fHeight);
        ctx.drawImage(image, sx, sy, fWidth, fHeight, 0, 0, fWidth, fHeight);
        framesList.push(frameCanvas);
        previewsList.push(frameCanvas.toDataURL("image/png"));
      }
    }
    allFrames.value = framesList;
    allFramePreviews.value = previewsList;
    totalFrameCount.value = framesList.length;
    frameWidth.value = fWidth;
    frameHeight.value = fHeight;
    effectivePadding.value = effPadding;
    discardedFrames.value = [];
    previewFrameIndex.value = 0;
    refreshSpriteFrameUsage();
    gridPreviewUrl.value = buildSpriteGridPreview(
      image,
      cols,
      rowCount,
      effPadding,
      new Set()
    );
  } catch (err) {
    frames.value = [];
    framePreviews.value = [];
    allFrames.value = [];
    allFramePreviews.value = [];
    frameCount.value = 0;
    totalFrameCount.value = 0;
    frameWidth.value = 0;
    frameHeight.value = 0;
    gridPreviewUrl.value = "";
    previewFrameIndex.value = 0;
    discardedFrames.value = [];
    effectivePadding.value = 0;
    stopSpritePreviewTimer();
    status.value = err?.message || "精灵图解析失败";
    showToast(err?.message || "精灵图解析失败", "error");
  }
}

function buildSpriteGridPreview(image, cols, rowCount, padding, discardedSet) {
  const gridCanvas = document.createElement("canvas");
  gridCanvas.width = image.width;
  gridCanvas.height = image.height;
  const ctx = gridCanvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const colWidth = image.width / cols;
  const rowHeight = image.height / rowCount;
  const discardLookup = discardedSet instanceof Set ? discardedSet : new Set();
  if (discardLookup.size) {
    ctx.save();
    ctx.fillStyle = "rgba(239,68,68,0.18)";
    ctx.strokeStyle = "rgba(239,68,68,0.65)";
    ctx.lineWidth = 2;
    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        if (!discardLookup.has(index)) continue;
        const x = col * colWidth;
        const y = row * rowHeight;
        ctx.fillRect(x, y, colWidth, rowHeight);
        ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(colWidth), Math.round(rowHeight));
      }
    }
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(37,99,235,0.75)";
  ctx.lineWidth = 1;
  for (let i = 1; i < cols; i += 1) {
    const x = Math.round(colWidth * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, image.height);
    ctx.stroke();
  }
  for (let j = 1; j < rowCount; j += 1) {
    const y = Math.round(rowHeight * j) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(image.width, y);
    ctx.stroke();
  }
  if (padding > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(251,191,36,0.9)";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1;
    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = col * colWidth + padding;
        const y = row * rowHeight + padding;
        const width = colWidth - padding * 2;
        const height = rowHeight - padding * 2;
        if (width <= 1 || height <= 1) continue;
        ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(width), Math.round(height));
      }
    }
    ctx.restore();
  }
  return gridCanvas.toDataURL("image/png");
}

async function rebuildSpriteGridPreview() {
  if (!imageUrl.value) {
    gridPreviewUrl.value = "";
    return;
  }
  try {
    const image = await loadImageFromUrl(imageUrl.value);
    const cols = Math.max(1, Math.floor(Number(columns.value) || 1));
    const rowCount = Math.max(1, Math.floor(Number(rows.value) || 1));
    const { effectivePadding: effPadding } = computeSpriteGridMetrics(
      image.width,
      image.height,
      cols,
      rowCount,
      spritePadding.value
    );
    effectivePadding.value = effPadding;
    gridPreviewUrl.value = buildSpriteGridPreview(
      image,
      cols,
      rowCount,
      effPadding,
      new Set(discardedFrames.value || [])
    );
  } catch (err) {
    console.warn("无法更新网格预览", err);
  }
}

function handleSpriteGridClick(event) {
  if (!gridPreviewUrl.value) return;
  const img = spriteGridImage.value;
  if (!img) return;
  const rect = img.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;
  if (clickX < 0 || clickY < 0 || clickX > rect.width || clickY > rect.height) return;
  const cols = Math.max(1, Math.floor(Number(columns.value) || 1));
  const rowCount = Math.max(1, Math.floor(Number(rows.value) || 1));
  const col = Math.min(cols - 1, Math.floor((clickX / rect.width) * cols));
  const row = Math.min(rowCount - 1, Math.floor((clickY / rect.height) * rowCount));
  const frameIndex = row * cols + col;
  toggleSpriteFrameDiscard(frameIndex);
}

function toggleSpriteFrameDiscard(frameIndex) {
  const total = totalFrameCount.value || 0;
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= total) return;
  const discardSet = new Set(discardedFrames.value || []);
  if (discardSet.has(frameIndex)) {
    discardSet.delete(frameIndex);
  } else {
    discardSet.add(frameIndex);
  }
  discardedFrames.value = Array.from(discardSet).sort((a, b) => a - b);
  refreshSpriteFrameUsage();
  rebuildSpriteGridPreview();
}

function startSpritePreviewTimer() {
  stopSpritePreviewTimer();
  if (!previewPlaying.value || !framePreviews.value.length) return;
  const fpsValue = Math.max(1, Number(fps.value) || 1);
  const delay = Math.max(30, Math.round(1000 / fpsValue));
  spritePreviewTimer = setInterval(() => {
    if (!framePreviews.value.length) return;
    previewFrameIndex.value = (previewFrameIndex.value + 1) % framePreviews.value.length;
  }, delay);
}

function stopSpritePreviewTimer() {
  if (spritePreviewTimer) {
    clearInterval(spritePreviewTimer);
    spritePreviewTimer = null;
  }
}

function toggleSpritePreview() {
  if (!framePreviews.value.length) return;
  previewPlaying.value = !previewPlaying.value;
  if (previewPlaying.value) {
    startSpritePreviewTimer();
  } else {
    stopSpritePreviewTimer();
  }
}

async function applySpriteEdits() {
  if (!imageUrl.value) return;
  try {
    const img = await loadImageFromUrl(imageUrl.value);
    const cropX = clampValue(Number(edit.cropX) || 0, 0, img.width - 1);
    const cropY = clampValue(Number(edit.cropY) || 0, 0, img.height - 1);
    const cropWidth = clampValue(
      Number(edit.cropWidth) || img.width,
      1,
      img.width - cropX
    );
    const cropHeight = clampValue(
      Number(edit.cropHeight) || img.height,
      1,
      img.height - cropY
    );
    const workCanvas = document.createElement("canvas");
    workCanvas.width = cropWidth;
    workCanvas.height = cropHeight;
    const ctx = workCanvas.getContext("2d");
    ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    if (edit.removeBg) {
      removeBackgroundFromCanvas(ctx, cropWidth, cropHeight, edit.bgColor, edit.bgTolerance);
    }
    const rotationSteps = ((Math.round(Number(edit.rotation) / 90) % 4) + 4) % 4;
    let outputCanvas = workCanvas;
    if (rotationSteps !== 0) {
      const rotatedCanvas = document.createElement("canvas");
      rotatedCanvas.width = rotationSteps % 2 === 0 ? workCanvas.width : workCanvas.height;
      rotatedCanvas.height = rotationSteps % 2 === 0 ? workCanvas.height : workCanvas.width;
      const rctx = rotatedCanvas.getContext("2d");
      rctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
      rctx.rotate((rotationSteps * 90 * Math.PI) / 180);
      rctx.drawImage(workCanvas, -workCanvas.width / 2, -workCanvas.height / 2);
      outputCanvas = rotatedCanvas;
    }
    const dataUrl = outputCanvas.toDataURL("image/png");
    imageUrl.value = dataUrl;
    imageWidth.value = outputCanvas.width;
    imageHeight.value = outputCanvas.height;
    initializeSpriteEditBounds(outputCanvas.width, outputCanvas.height);
    await updateSpriteFrames();
    showToast("已应用简单编辑", "success");
  } catch (err) {
    showToast(err?.message || "应用编辑失败", "error");
  }
}

function removeBackgroundFromCanvas(ctx, width, height, hexColor, tolerance) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const target = hexToRgb(hexColor);
  if (!target) return;
  const data = imageData.data;
  const tol = Math.max(0, Math.min(100, Number(tolerance) || 0)) * 2.55;
  for (let i = 0; i < data.length; i += 4) {
    const diff =
      Math.abs(data[i] - target.r) + Math.abs(data[i + 1] - target.g) + Math.abs(data[i + 2] - target.b);
    if (diff / 3 <= tol) {
      data[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function hexToRgb(hex) {
  if (!hex) return null;
  const normalized = hex.replace("#", "");
  if (![3, 6].includes(normalized.length)) return null;
  const value = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const num = parseInt(value, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function resetSpriteEdits() {
  if (!originalDataUrl.value) return;
  imageUrl.value = originalDataUrl.value;
  syncSpriteImageMeta(originalDataUrl.value);
  showToast("已还原原图", "info");
}

async function ensureGifJs() {
  if (gifLibReady.value || GIF_READY()) {
    gifLibReady.value = true;
    return true;
  }
  if (!gifJsReadyPromise) {
    gifJsReadyPromise = lazyLoadScript(GIF_JS_URL, GIF_READY, {
      timeout: 15000,
      attrs: { crossorigin: "anonymous" },
    }).catch((err) => {
      gifJsReadyPromise = null;
      throw err;
    });
  }
  try {
    await gifJsReadyPromise;
    gifLibReady.value = true;
    return true;
  } catch (err) {
    console.warn("GIF.js 加载失败", err);
    showToast("GIF 库加载失败，请稍后重试", "error");
    return false;
  }
}

async function generateSpriteGif() {
  if (!frames.value.length) {
    showToast("请先上传并分割精灵图", "warning");
    return;
  }
  isGenerating.value = true;
  try {
    const ready = await ensureGifJs();
    if (!ready) return;
    const GIFConstructor = window.GIF;
    if (!GIFConstructor) {
      showToast("GIF 生成库未加载", "error");
      return;
    }
    const workerScript = await resolveSpriteWorkerUrl();
    const delay = Math.max(20, Math.round(1000 / Math.max(1, Number(fps.value) || 1)));
    const gif = new GIFConstructor({
      workers: 2,
      workerScript,
      width: frameWidth.value,
      height: frameHeight.value,
      quality: 12,
      transparent: 0x000000,
    });
    frames.value.forEach((canvas) => {
      gif.addFrame(canvas, { delay, copy: true });
    });
    const blob = await new Promise((resolve, reject) => {
      gif.on("finished", resolve);
      gif.on("abort", () => reject(new Error("GIF 生成被取消")));
      gif.on("error", (err) => reject(err || new Error("GIF 生成失败")));
      gif.render();
    });
    const filename = (imageName.value?.replace(/\.[^.]+$/, "") || "sprite") + ".gif";
    downloadBlob(filename, blob);
    showToast("GIF 已生成", "success");
  } catch (err) {
    showToast(err?.message || "GIF 生成失败", "error");
  } finally {
    isGenerating.value = false;
  }
}

async function resolveSpriteWorkerUrl() {
  if (workerUrl.value) return workerUrl.value;
  if (typeof window === "undefined") return "./gif.worker.js";
  const base = window.location.href;
  const candidates = ["./gif.worker.js", "./public/gif.worker.js"];
  for (let i = 0; i < candidates.length; i += 1) {
    const url = new URL(candidates[i], base).href;
    const ok = await checkWorkerExists(url);
    if (ok) {
      workerUrl.value = url;
      return url;
    }
  }
  const blobUrl = await fetchWorkerFromCdn();
  if (blobUrl) {
    workerUrl.value = blobUrl;
    workerBlobUrl.value = blobUrl;
    return blobUrl;
  }
  return new URL("./gif.worker.js", base).href;
}

async function checkWorkerExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchWorkerFromCdn() {
  try {
    const resp = await fetch("https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js");
    if (!resp.ok) return null;
    const code = await resp.text();
    const blob = new Blob([code], { type: "application/javascript" });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// Watchers
watch(columns, () => updateSpriteFrames());
watch(rows, () => updateSpriteFrames());
watch(spritePadding, () => updateSpriteFrames());
watch(fps, () => {
  if (previewPlaying.value) {
    startSpritePreviewTimer();
  }
});

onMounted(() => {
  ensureGifJs();
});

onBeforeUnmount(() => {
  stopSpritePreviewTimer();
  if (workerBlobUrl.value) {
    URL.revokeObjectURL(workerBlobUrl.value);
  }
});
</script>
