<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns sprite-tool-layout">
      <div class="panel sprite-column">
        <div class="panel-header">
          <h2>表情包上传</h2>
          <p>点击或拖拽 PNG / JPG / GIF，设定行列数即可切割成多张图片。</p>
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
            accept=".png,.jpg,.jpeg,.gif,.webp"
            @change="handleFileSelect($event.target.files)"
          >
          <div v-if="!imageUrl" class="dropzone-hint">
            <strong>点击或拖入表情包图片</strong>
            <span>支持 PNG / JPG / GIF / WebP</span>
          </div>
          <div v-else class="dropzone-preview">
            <img :src="imageUrl" :alt="imageName || '表情包预览'">
            <p class="muted">{{ imageName || '表情包' }}</p>
          </div>
        </div>
        <div class="form-row space-between">
          <p class="hint small-text">{{ status }}</p>
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
            <span class="field-label">内边距 (px)</span>
            <input type="number" min="0" v-model.number="padding">
          </label>
          <label class="field small">
            <span class="field-label">输出格式</span>
            <select v-model="outputFormat">
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="webp">WebP</option>
            </select>
          </label>
        </div>
        <div class="sprite-preview-block" v-if="slicePreviews.length">
          <p class="hint">切片预览（前 12 张）</p>
          <div class="emote-preview-grid">
            <img
              v-for="(src, idx) in slicePreviews.slice(0, 12)"
              :key="idx"
              :src="src"
              :alt="'切片 ' + (idx + 1)"
              class="emote-preview-item"
            >
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
        >
          <img
            v-if="gridPreviewUrl"
            :src="gridPreviewUrl"
            alt="网格预览"
          >
          <p v-else class="muted">先在左侧上传表情包图片，这里将显示网格预览。</p>
        </div>
        <div class="sprite-meta">
          <p><strong>原图尺寸：</strong>{{ imageWidth }} × {{ imageHeight }}</p>
          <p><strong>单图尺寸：</strong>{{ sliceWidth }} × {{ sliceHeight }}</p>
          <p><strong>切片总数：</strong>{{ totalSliceCount }}</p>
        </div>
        <button
          class="btn btn-primary full-width"
          :disabled="!slices.length || isGenerating"
          @click="generateZip"
        >
          {{ isGenerating ? "生成中..." : "下载 ZIP 压缩包" }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, watch } from "vue";
import { lazyLoadScript } from "../../utils/lazyLoad.js";
import { useToast } from "../../composables/useToast.js";
import { useDownload } from "../../composables/useDownload.js";
import { useFileReader } from "../../composables/useFileReader.js";

const { showToast } = useToast();
const { downloadBlob } = useDownload();
const { readAsDataUrl, loadImageFromUrl } = useFileReader();

const JSZIP_URL = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
const JSZIP_READY = () => typeof window !== "undefined" && typeof window.JSZip === "function";
let jsZipReadyPromise = null;
let JSZipRef = null;

// Refs
const fileInput = ref(null);
const columns = ref(3);
const rows = ref(3);
const padding = ref(0);
const outputFormat = ref("png");
const imageName = ref("");
const imageUrl = ref("");
const imageWidth = ref(0);
const imageHeight = ref(0);
const sliceWidth = ref(0);
const sliceHeight = ref(0);
const totalSliceCount = ref(0);
const slices = ref([]);
const slicePreviews = ref([]);
const gridPreviewUrl = ref("");
const isDragging = ref(false);
const isGenerating = ref(false);
const status = ref("请选择要切割的表情包图片");

// Methods
function triggerUpload() {
  fileInput.value?.click();
}

async function handleFileSelect(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const file = files[0];
  if (!file.type?.startsWith("image/")) {
    showToast("仅支持图片文件", "warning");
    return;
  }
  try {
    await loadImageFile(file);
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

async function loadImageFile(file) {
  const dataUrl = await readAsDataUrl(file);
  imageName.value = file.name;
  imageUrl.value = dataUrl;
  await syncImageMeta(dataUrl);
}

async function syncImageMeta(src) {
  try {
    const image = await loadImageFromUrl(src);
    imageWidth.value = image.width;
    imageHeight.value = image.height;
    status.value = `原图尺寸：${image.width} × ${image.height}`;
    await updateSlices();
  } catch (err) {
    showToast(err?.message || "无法读取图片信息", "error");
  }
}

function computeGridMetrics(imgWidth, imgHeight, cols, rowCount, paddingValue) {
  const cellWidth = Math.floor(imgWidth / cols);
  const cellHeight = Math.floor(imgHeight / rowCount);
  if (cellWidth <= 0 || cellHeight <= 0) {
    throw new Error("请调整分割数以得到有效的切片尺寸");
  }
  const desiredPadding = Math.max(0, Number(paddingValue) || 0);
  const maxPadding = Math.min(Math.floor(cellWidth / 2) - 1, Math.floor(cellHeight / 2) - 1);
  const effPadding = Math.max(0, isNaN(maxPadding) ? 0 : Math.min(desiredPadding, Math.max(0, maxPadding)));
  const sWidth = Math.max(1, cellWidth - effPadding * 2);
  const sHeight = Math.max(1, cellHeight - effPadding * 2);
  return { cellWidth, cellHeight, effectivePadding: effPadding, sliceWidth: sWidth, sliceHeight: sHeight };
}

async function updateSlices() {
  if (!imageUrl.value) {
    slices.value = [];
    slicePreviews.value = [];
    totalSliceCount.value = 0;
    sliceWidth.value = 0;
    sliceHeight.value = 0;
    gridPreviewUrl.value = "";
    status.value = "请选择要切割的表情包图片";
    return;
  }
  const cols = Math.max(1, Math.floor(Number(columns.value) || 1));
  const rowCount = Math.max(1, Math.floor(Number(rows.value) || 1));
  try {
    const image = await loadImageFromUrl(imageUrl.value);
    const { cellWidth, cellHeight, effectivePadding: effPadding, sliceWidth: sWidth, sliceHeight: sHeight } = computeGridMetrics(
      image.width,
      image.height,
      cols,
      rowCount,
      padding.value
    );
    const slicesList = [];
    const previewsList = [];
    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const sx = col * cellWidth + effPadding;
        const sy = row * cellHeight + effPadding;
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = sWidth;
        sliceCanvas.height = sHeight;
        const ctx = sliceCanvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, sWidth, sHeight);
        ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
        slicesList.push(sliceCanvas);
        previewsList.push(sliceCanvas.toDataURL("image/png"));
      }
    }
    slices.value = slicesList;
    slicePreviews.value = previewsList;
    totalSliceCount.value = slicesList.length;
    sliceWidth.value = sWidth;
    sliceHeight.value = sHeight;
    gridPreviewUrl.value = buildGridPreview(image, cols, rowCount, effPadding);
    status.value = `总切片数 ${slicesList.length} · 单图 ${sWidth} × ${sHeight}`;
  } catch (err) {
    slices.value = [];
    slicePreviews.value = [];
    totalSliceCount.value = 0;
    sliceWidth.value = 0;
    sliceHeight.value = 0;
    gridPreviewUrl.value = "";
    status.value = err?.message || "图片解析失败";
    showToast(err?.message || "图片解析失败", "error");
  }
}

function buildGridPreview(image, cols, rowCount, effPadding) {
  const gridCanvas = document.createElement("canvas");
  gridCanvas.width = image.width;
  gridCanvas.height = image.height;
  const ctx = gridCanvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const colWidth = image.width / cols;
  const rowHeight = image.height / rowCount;
  // Draw grid lines
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
  // Draw padding indicator
  if (effPadding > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(251,191,36,0.9)";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1;
    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = col * colWidth + effPadding;
        const y = row * rowHeight + effPadding;
        const width = colWidth - effPadding * 2;
        const height = rowHeight - effPadding * 2;
        if (width <= 1 || height <= 1) continue;
        ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(width), Math.round(height));
      }
    }
    ctx.restore();
  }
  return gridCanvas.toDataURL("image/png");
}

async function ensureJSZip() {
  if (JSZipRef && typeof JSZipRef === "function") return true;
  if (JSZIP_READY()) {
    JSZipRef = window.JSZip;
    return true;
  }
  if (!jsZipReadyPromise) {
    jsZipReadyPromise = lazyLoadScript(JSZIP_URL, JSZIP_READY, {
      timeout: 15000,
      attrs: { crossorigin: "anonymous" },
    }).catch((err) => {
      jsZipReadyPromise = null;
      throw err;
    });
  }
  try {
    await jsZipReadyPromise;
    JSZipRef = window.JSZip;
    return true;
  } catch (err) {
    console.warn("JSZip 加载失败", err);
    showToast("压缩库加载失败，请稍后重试", "error");
    return false;
  }
}

function getMimeType(format) {
  const mimeTypes = {
    png: "image/png",
    jpg: "image/jpeg",
    webp: "image/webp",
  };
  return mimeTypes[format] || "image/png";
}

function getExtension(format) {
  return format === "jpg" ? "jpg" : format;
}

async function generateZip() {
  if (!slices.value.length) {
    showToast("请先上传并分割图片", "warning");
    return;
  }
  isGenerating.value = true;
  try {
    const ready = await ensureJSZip();
    if (!ready) return;
    const zip = new JSZipRef();
    const format = outputFormat.value || "png";
    const mimeType = getMimeType(format);
    const ext = getExtension(format);
    const quality = format === "jpg" ? 0.92 : undefined;
    const baseName = (imageName.value?.replace(/\.[^.]+$/, "") || "emote");
    for (let i = 0; i < slices.value.length; i += 1) {
      const canvas = slices.value[i];
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const base64 = dataUrl.split(",")[1];
      const fileName = `${baseName}_${String(i + 1).padStart(3, "0")}.${ext}`;
      zip.file(fileName, base64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const zipName = `${baseName}_切片.zip`;
    downloadBlob(zipName, blob);
    showToast(`已生成 ${slices.value.length} 张切片`, "success");
  } catch (err) {
    showToast(err?.message || "压缩包生成失败", "error");
  } finally {
    isGenerating.value = false;
  }
}

// Watchers
watch(columns, () => updateSlices());
watch(rows, () => updateSlices());
watch(padding, () => updateSlices());
</script>

<style scoped>
.emote-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.emote-preview-item {
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
  background: var(--color-surface-alt, #f5f5f5);
  border-radius: 4px;
  border: 1px solid var(--color-border, #e0e0e0);
}
</style>
