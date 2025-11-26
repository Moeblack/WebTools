<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns sprite-tool-layout">
      <div class="panel sprite-column">
        <div class="panel-header">
          <h2>GIF 上传与预览</h2>
          <p>拖拽或选择 GIF，自动拆帧并实时预览动画。</p>
        </div>
        <div
          class="sprite-dropzone"
          :class="{ dragging: isDragging, 'has-image': totalFrames }"
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
            accept=".gif"
            @change="handleFileSelect($event.target.files)"
          >
          <div v-if="!totalFrames" class="dropzone-hint">
            <strong>点击或拖入 GIF 动画</strong>
            <span>将自动解析并展示每一帧</span>
          </div>
          <div v-else class="dropzone-preview">
            <p class="muted">{{ fileName || '已载入 GIF' }}</p>
          </div>
        </div>
        <p class="hint small-text">
          {{ isProcessing ? '正在解析 GIF...' : status }}
        </p>
        <div class="sprite-preview-block">
          <div class="preview-canvas">
            <img
              v-if="activeFrames.length"
              :src="activeFrames[previewFrameIndex]?.previewUrl"
              alt="GIF 预览"
            >
            <p v-else class="muted">上传 GIF 后将在此处预览原动画。</p>
          </div>
          <div class="form-row space-between">
            <div class="form-row compact">
              <button
                class="btn btn-secondary"
                :disabled="!activeFrames.length"
                @click="togglePreview"
              >
                {{ previewPlaying ? "暂停预览" : "继续预览" }}
              </button>
              <button
                class="btn btn-ghost"
                :disabled="!activeFrames.length"
                @click="previewFrameIndex = 0"
              >
                回到第 1 帧
              </button>
            </div>
            <p class="hint small-text">
              帧序：{{ activeFrames.length ? (previewFrameIndex + 1) + ' / ' + activeFrames.length : '--' }}
            </p>
          </div>
        </div>
        <div class="panel-header secondary">
          <h3>输出设置</h3>
          <p>控制精灵图列数、间距与背景。</p>
        </div>
        <div class="sprite-settings-grid">
          <label class="field small">
            <span class="field-label">列数限制</span>
            <input type="number" min="1" v-model.number="columns">
          </label>
          <label class="field small">
            <span class="field-label">间距 (Padding)</span>
            <input type="number" min="0" v-model.number="padding">
          </label>
        </div>
        <div class="option-group wrap">
          <label class="radio">
            <input type="radio" value="transparent" v-model="backgroundMode">
            <span>透明背景</span>
          </label>
          <label class="radio">
            <input type="radio" value="color" v-model="backgroundMode">
            <span>纯色背景</span>
          </label>
          <input
            v-if="backgroundMode === 'color'"
            type="color"
            v-model="backgroundColor"
          >
        </div>
        <div class="gif-output-note">
          <p><strong>预计尺寸：</strong>{{ estimatedText }}</p>
          <p><strong>列上限：</strong>{{ columns }}</p>
        </div>
        <div class="sprite-meta">
          <p>
            <strong>原 GIF：</strong>
            <template v-if="gifWidth && gifHeight">
              {{ gifWidth }} × {{ gifHeight }}
            </template>
            <template v-else>--</template>
          </p>
          <p><strong>帧总数：</strong>{{ totalFrames || '--' }}</p>
          <p><strong>可用帧：</strong>{{ activeFrames.length || 0 }}</p>
        </div>
      </div>
      <div class="panel sprite-column">
        <div class="panel-header">
          <h2>精灵图预览</h2>
          <p>实时查看排版效果，可点击帧直接剔除并预览 padding。</p>
        </div>
        <div
          class="grid-area"
          :class="{ 'is-interactive': spritePreviewUrl }"
          @click="handlePreviewClick"
        >
          <img
            v-if="spritePreviewUrl"
            ref="previewImage"
            :src="spritePreviewUrl"
            alt="Sprite 预览"
          >
          <p v-else class="muted">生成后的精灵图将在此展示，包含网格与 padding 辅助线。</p>
        </div>
        <p class="hint small-text" v-if="spritePreviewUrl">
          点击预览中的任意帧即可删除，再次点击恢复。下方列表也可快速撤销。
        </p>
        <div class="discarded-frame-list" v-if="discardedFrames.length">
          <p class="hint small-text">已丢弃帧（点击恢复）</p>
          <div class="discarded-grid">
            <button
              class="discarded-item"
              v-for="idx in discardedFrames"
              :key="idx"
              @click="restoreFrame(idx)"
            >
              <img :src="getDiscardPreview(idx)" :alt="'Frame ' + (idx + 1)">
              <span>#{{ idx + 1 }}</span>
            </button>
          </div>
          <button class="btn btn-ghost" @click="restoreAllFrames">恢复全部帧</button>
        </div>
        <div class="sprite-meta">
          <p>
            <strong>排版：</strong>
            <template v-if="currentRows && currentColumns">
              {{ currentRows }} 行 × {{ currentColumns }} 列
            </template>
            <template v-else>--</template>
          </p>
          <p>
            <strong>输出尺寸：</strong>
            <template v-if="spriteWidth && spriteHeight">
              {{ spriteWidth }} × {{ spriteHeight }}
            </template>
            <template v-else>--</template>
          </p>
          <p><strong>有效帧：</strong>{{ activeFrames.length || 0 }}</p>
        </div>
        <button
          class="btn btn-primary full-width"
          :disabled="!spriteUrl"
          @click="downloadSpriteSheet"
        >
          下载精灵图
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from "vue";
import { useToast } from "../../composables/useToast.js";
import { useDownload } from "../../composables/useDownload.js";
import { useFileReader } from "../../composables/useFileReader.js";

const { showToast } = useToast();
const { downloadBlob } = useDownload();
const { readAsArrayBuffer } = useFileReader();

// Refs
const fileInput = ref(null);
const previewImage = ref(null);
const isDragging = ref(false);
const isProcessing = ref(false);
const status = ref("请上传 GIF 动画");
const fileName = ref("");
const gifWidth = ref(0);
const gifHeight = ref(0);
const totalFrames = ref(0);
const frames = ref([]);
const activeFrames = ref([]);
const activeCellPositions = ref([]);
const discardedFrames = ref([]);
const columns = ref(8);
const padding = ref(0);
const backgroundMode = ref("transparent");
const backgroundColor = ref("#000000");
const spriteUrl = ref("");
const spritePreviewUrl = ref("");
const spriteWidth = ref(0);
const spriteHeight = ref(0);
const previewFrameIndex = ref(0);
const previewPlaying = ref(true);
const estimatedText = ref("--");
const currentColumns = ref(0);
const currentRows = ref(0);
const decoderModule = ref(null);

let previewTimer = null;

// Methods
function triggerUpload() {
  fileInput.value?.click();
}

async function handleFileSelect(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const file = files[0];
  if (!file.type?.includes("gif")) {
    showToast("仅支持 GIF 动画", "warning");
    return;
  }
  try {
    await loadGifFile(file);
  } catch (err) {
    showToast(err?.message || "GIF 解析失败", "error");
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

async function loadGifFile(file) {
  isProcessing.value = true;
  status.value = "正在解析 GIF...";
  stopPreviewTimer();
  try {
    const buffer = await readAsArrayBuffer(file);
    const { frames: decodedFrames, width, height } = await decodeGifArrayBuffer(buffer);
    if (!decodedFrames.length) {
      throw new Error("未能在 GIF 中检测到有效帧");
    }
    fileName.value = file.name;
    frames.value = decodedFrames;
    gifWidth.value = width;
    gifHeight.value = height;
    totalFrames.value = decodedFrames.length;
    discardedFrames.value = [];
    previewFrameIndex.value = 0;
    previewPlaying.value = true;
    status.value = `已载入 ${decodedFrames.length} 帧 · 单帧 ${width} × ${height}`;
    refreshFrames();
    showToast("GIF 解析完成", "success");
  } finally {
    isProcessing.value = false;
  }
}

async function decodeGifArrayBuffer(arrayBuffer) {
  const module = await ensureGifuctModule();
  const { parseGIF, decompressFrames } = module;
  if (!parseGIF || !decompressFrames) {
    throw new Error("GIF 解码器加载失败");
  }
  const gif = parseGIF(arrayBuffer);
  const rawFrames = decompressFrames(gif, true) || [];
  const width = gif?.lsd?.width || 0;
  const height = gif?.lsd?.height || 0;
  if (!width || !height) {
    throw new Error("GIF 尺寸无效");
  }
  const workCanvas = document.createElement("canvas");
  workCanvas.width = width;
  workCanvas.height = height;
  const workCtx = workCanvas.getContext("2d");
  workCtx.clearRect(0, 0, width, height);
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  const normalized = [];
  let previousImageData = null;
  rawFrames.forEach((frame, index) => {
    const dims = frame?.dims || {};
    if (!dims.width || !dims.height) return;
    if (frame.disposalType === 3) {
      previousImageData = workCtx.getImageData(0, 0, width, height);
    }
    tempCanvas.width = dims.width;
    tempCanvas.height = dims.height;
    const imageData = tempCtx.createImageData(dims.width, dims.height);
    const patch = frame.patch instanceof Uint8ClampedArray ? frame.patch : new Uint8ClampedArray(frame.patch);
    imageData.data.set(patch);
    tempCtx.putImageData(imageData, 0, 0);
    workCtx.drawImage(tempCanvas, dims.left, dims.top);
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = width;
    frameCanvas.height = height;
    const frameCtx = frameCanvas.getContext("2d");
    frameCtx.drawImage(workCanvas, 0, 0);
    normalized.push({
      canvas: frameCanvas,
      previewUrl: frameCanvas.toDataURL("image/png"),
      delay: Math.max(20, frame.delay || 80),
      sourceIndex: index,
    });
    if (frame.disposalType === 2) {
      workCtx.clearRect(dims.left || 0, dims.top || 0, dims.width, dims.height);
    } else if (frame.disposalType === 3 && previousImageData) {
      workCtx.putImageData(previousImageData, 0, 0);
      previousImageData = null;
    }
  });
  return { frames: normalized, width, height };
}

async function ensureGifuctModule() {
  if (decoderModule.value) return decoderModule.value;
  const module = await import("https://esm.sh/gifuct-js@2.1.2");
  decoderModule.value = module;
  return module;
}

function refreshFrames() {
  const discardSet = new Set(discardedFrames.value || []);
  const active = (frames.value || []).filter((frame) => !discardSet.has(frame.sourceIndex));
  activeFrames.value = active;
  if (!active.length) {
    previewFrameIndex.value = 0;
    stopPreviewTimer();
  } else if (previewFrameIndex.value >= active.length) {
    previewFrameIndex.value = 0;
  }
  if (previewPlaying.value && active.length) {
    startPreviewTimer();
  }
  rebuildSpriteSheet();
  if (totalFrames.value) {
    const discarded = discardSet.size;
    const available = Math.max(0, totalFrames.value - discarded);
    const base = `原 GIF：${gifWidth.value} × ${gifHeight.value} · 帧 ${totalFrames.value}`;
    status.value = discarded ? `${base} · 可用 ${available}` : base;
  }
}

function rebuildSpriteSheet() {
  const frameList = activeFrames.value || [];
  if (!frameList.length) {
    spriteUrl.value = "";
    spritePreviewUrl.value = "";
    spriteWidth.value = 0;
    spriteHeight.value = 0;
    estimatedText.value = "--";
    currentColumns.value = 0;
    currentRows.value = 0;
    activeCellPositions.value = [];
    return;
  }
  const cols = Math.max(1, Math.floor(Number(columns.value) || 1));
  const pad = Math.max(0, Math.floor(Number(padding.value) || 0));
  const frameWidth = gifWidth.value || frameList[0]?.canvas?.width || 0;
  const frameHeight = gifHeight.value || frameList[0]?.canvas?.height || 0;
  const rows = Math.max(1, Math.ceil(frameList.length / cols));
  const width = cols * frameWidth + pad * Math.max(0, cols - 1);
  const height = rows * frameHeight + pad * Math.max(0, rows - 1);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (backgroundMode.value === "color") {
    ctx.fillStyle = backgroundColor.value || "#000000";
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = false;
  const positions = [];
  frameList.forEach((frame, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * (frameWidth + pad);
    const y = row * (frameHeight + pad);
    ctx.drawImage(frame.canvas, x, y);
    positions.push({
      sourceIndex: frame.sourceIndex,
      x,
      y,
      width: frameWidth,
      height: frameHeight,
    });
  });
  spriteUrl.value = canvas.toDataURL("image/png");
  spritePreviewUrl.value = buildPreview(canvas, positions, cols, frameWidth, frameHeight, pad);
  spriteWidth.value = width;
  spriteHeight.value = height;
  estimatedText.value = `${width} × ${height}`;
  currentColumns.value = cols;
  currentRows.value = rows;
  activeCellPositions.value = positions;
}

function buildPreview(spriteCanvas, positions, cols, frameWidth, frameHeight, pad) {
  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = spriteCanvas.width;
  previewCanvas.height = spriteCanvas.height;
  const ctx = previewCanvas.getContext("2d");
  ctx.drawImage(spriteCanvas, 0, 0);
  const totalRows = Math.max(1, Math.ceil(positions.length / cols));
  ctx.save();
  ctx.strokeStyle = "rgba(37,99,235,0.75)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  positions.forEach((cell) => {
    ctx.strokeRect(Math.round(cell.x) + 0.5, Math.round(cell.y) + 0.5, cell.width, cell.height);
  });
  ctx.restore();
  if (pad > 0) {
    ctx.save();
    ctx.fillStyle = "rgba(251,191,36,0.18)";
    positions.forEach((cell, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const nextIndex = idx + 1;
      if (col !== cols - 1 && nextIndex <= positions.length - 1) {
        ctx.fillRect(cell.x + cell.width, cell.y, pad, cell.height);
      }
      if (row < totalRows - 1) {
        ctx.fillRect(cell.x, cell.y + cell.height, cell.width, pad);
      }
    });
    ctx.restore();
  }
  return previewCanvas.toDataURL("image/png");
}

function handlePreviewClick(event) {
  if (!spritePreviewUrl.value) return;
  const img = previewImage.value;
  if (!img) return;
  const rect = img.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;
  if (clickX < 0 || clickY < 0) return;
  const scaleX = (spriteWidth.value || rect.width) / rect.width;
  const scaleY = (spriteHeight.value || rect.height) / rect.height;
  const realX = clickX * scaleX;
  const realY = clickY * scaleY;
  const targetCell = activeCellPositions.value.find(
    (cell) => realX >= cell.x && realX <= cell.x + cell.width && realY >= cell.y && realY <= cell.y + cell.height
  );
  if (targetCell) {
    toggleFrame(targetCell.sourceIndex);
  }
}

function toggleFrame(frameIndex) {
  if (!Number.isInteger(frameIndex) || frameIndex < 0) return;
  const discardSet = new Set(discardedFrames.value || []);
  if (discardSet.has(frameIndex)) {
    discardSet.delete(frameIndex);
  } else {
    discardSet.add(frameIndex);
  }
  discardedFrames.value = Array.from(discardSet).sort((a, b) => a - b);
  refreshFrames();
}

function restoreFrame(frameIndex) {
  if (!Number.isInteger(frameIndex)) return;
  if (!discardedFrames.value.length) return;
  discardedFrames.value = discardedFrames.value.filter((idx) => idx !== frameIndex);
  refreshFrames();
}

function restoreAllFrames() {
  if (!discardedFrames.value.length) return;
  discardedFrames.value = [];
  refreshFrames();
}

function startPreviewTimer() {
  stopPreviewTimer();
  if (!previewPlaying.value || !activeFrames.value.length) return;
  schedulePreviewTick();
}

function schedulePreviewTick() {
  if (!previewPlaying.value || !activeFrames.value.length) return;
  const currentFrame = activeFrames.value[previewFrameIndex.value];
  const delay = Math.max(30, currentFrame?.delay || 80);
  previewTimer = setTimeout(() => {
    if (!previewPlaying.value || !activeFrames.value.length) return;
    previewFrameIndex.value = (previewFrameIndex.value + 1) % activeFrames.value.length;
    schedulePreviewTick();
  }, delay);
}

function stopPreviewTimer() {
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
}

function togglePreview() {
  if (!activeFrames.value.length) return;
  previewPlaying.value = !previewPlaying.value;
  if (previewPlaying.value) {
    startPreviewTimer();
  } else {
    stopPreviewTimer();
  }
}

async function downloadSpriteSheet() {
  if (!spriteUrl.value) {
    showToast("请先生成精灵图", "warning");
    return;
  }
  try {
    const res = await fetch(spriteUrl.value);
    const blob = await res.blob();
    const filename = (fileName.value?.replace(/\.[^.]+$/, "") || "gif_sprite") + "_sheet.png";
    downloadBlob(filename, blob);
    showToast("精灵图已下载", "success");
  } catch (err) {
    showToast(err?.message || "下载失败", "error");
  }
}

function getDiscardPreview(frameIndex) {
  const frame = (frames.value || []).find((item) => item.sourceIndex === frameIndex);
  return frame?.previewUrl || "";
}

// Watchers
watch(columns, () => rebuildSpriteSheet());
watch(padding, () => rebuildSpriteSheet());
watch(backgroundMode, () => rebuildSpriteSheet());
watch(backgroundColor, () => {
  if (backgroundMode.value === "color") {
    rebuildSpriteSheet();
  }
});

onBeforeUnmount(() => {
  stopPreviewTimer();
});
</script>
