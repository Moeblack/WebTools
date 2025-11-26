<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns">
      <div class="panel">
        <div class="panel-header">
          <h2>图片上传</h2>
          <p>上传 PNG / JPG 图片，自动提取主要颜色生成调色盘。</p>
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
            accept=".png,.jpg,.jpeg,.webp"
            @change="handleFileSelect($event.target.files)"
          >
          <div v-if="!imageUrl" class="dropzone-hint">
            <strong>点击或拖入图片</strong>
            <span>支持 PNG / JPG / WebP</span>
          </div>
          <div v-else class="dropzone-preview">
            <img :src="imageUrl" :alt="imageName || '原始图片'">
            <p class="muted">{{ imageName || '已加载图片' }}</p>
          </div>
        </div>
        <p class="hint small-text">{{ status }}</p>

        <div class="panel-header secondary">
          <h3>调色盘设置</h3>
        </div>
        <div class="sprite-settings-grid">
          <label class="field small">
            <span class="field-label">最大颜色数</span>
            <select v-model.number="maxColors">
              <option :value="16">16 色</option>
              <option :value="32">32 色</option>
              <option :value="64">64 色</option>
              <option :value="128">128 色</option>
              <option :value="256">256 色</option>
            </select>
          </label>
          <label class="field small">
            <span class="field-label">颜色格式</span>
            <select v-model="format">
              <option value="rgb565">RGB565（高质量）</option>
              <option value="rgb444">RGB444（较快）</option>
              <option value="rgba4444">RGBA4444（带透明）</option>
            </select>
          </label>
          <label class="field small">
            <span class="field-label">排序方式</span>
            <select v-model="sortMode" @change="resortPalette">
              <option value="none">默认</option>
              <option value="luminance">按亮度</option>
              <option value="hue">按色相</option>
            </select>
          </label>
        </div>

        <div class="form-row compact">
          <button
            class="btn btn-primary"
            :disabled="!imageUrl || isProcessing"
            @click="generatePaletteColors"
          >
            {{ isProcessing ? "处理中..." : "生成调色盘" }}
          </button>
          <button class="btn btn-ghost" :disabled="!imageUrl" @click="clearPalette">
            清空
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2>调色盘预览</h2>
          <p>生成的颜色列表，可导出为 CSS 变量或 JSON。</p>
        </div>

        <div class="palette-grid" v-if="colors.length">
          <div
            class="palette-color"
            v-for="color in colors"
            :key="color.index"
            :style="{ backgroundColor: color.hex }"
            :title="color.hex"
            @click="copyValue(color.hex)"
          >
            <span class="palette-color-label">{{ color.hex }}</span>
          </div>
        </div>
        <p v-else class="muted">生成调色盘后将在此显示颜色列表</p>

        <div class="palette-stats" v-if="colors.length">
          <p><strong>颜色数量：</strong>{{ colors.length }}</p>
        </div>

        <div class="form-row compact" v-if="colors.length">
          <button class="btn btn-secondary" @click="copyPaletteAsCSS">复制 CSS 变量</button>
          <button class="btn btn-outline" @click="copyPaletteAsJSON">复制 JSON</button>
        </div>

        <div class="panel-header secondary" v-if="quantizedUrl">
          <h3>量化效果预览</h3>
          <p>应用调色盘后的图片效果（点击可下载）</p>
        </div>
        <div class="palette-preview" v-if="quantizedUrl" @click="downloadQuantizedImage">
          <img :src="quantizedUrl" alt="量化后的图片">
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from "vue";
import {
  ensureGifenc,
  generatePalette,
  getCanvasPixels,
  quantizeCanvas,
  paletteToDisplayColors,
  sortPaletteByLuminance,
  sortPaletteByHue,
} from "../../tools/palette.js";
import { useClipboard } from "../../composables/useClipboard.js";
import { useToast } from "../../composables/useToast.js";
import { useDownload } from "../../composables/useDownload.js";
import { useFileReader } from "../../composables/useFileReader.js";

const { copyValue } = useClipboard();
const { showToast } = useToast();
const { downloadBlob } = useDownload();
const { readAsDataUrl, loadImageFromUrl } = useFileReader();

// Refs
const fileInput = ref(null);
const isDragging = ref(false);
const isProcessing = ref(false);
const status = ref("请上传 PNG / JPG 图片");
const imageName = ref("");
const imageUrl = ref("");
const maxColors = ref(256);
const format = ref("rgb565");
const sortMode = ref("none");
const colors = ref([]);
const rawPalette = ref([]);
const quantizedUrl = ref("");
const libReady = ref(false);

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
    await loadPaletteImage(file);
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

async function loadPaletteImage(file) {
  const dataUrl = await readAsDataUrl(file);
  imageName.value = file.name;
  imageUrl.value = dataUrl;

  const img = await loadImageFromUrl(dataUrl);
  status.value = `已加载：${img.width} × ${img.height}`;

  colors.value = [];
  rawPalette.value = [];
  quantizedUrl.value = "";

  showToast("图片已加载，点击「生成调色盘」开始处理", "success");
}

async function ensurePaletteLib() {
  if (libReady.value) return true;

  status.value = "正在加载调色盘库...";
  try {
    const ok = await ensureGifenc();
    libReady.value = ok;
    status.value = ok ? "请上传 PNG / JPG 图片" : "调色盘库加载失败";
    return ok;
  } catch (err) {
    status.value = "调色盘库加载失败";
    showToast("调色盘库加载失败", "error");
    return false;
  }
}

async function generatePaletteColors() {
  if (!imageUrl.value) {
    showToast("请先上传图片", "warning");
    return;
  }

  const ready = await ensurePaletteLib();
  if (!ready) return;

  isProcessing.value = true;
  status.value = "正在生成调色盘...";

  try {
    const img = await loadImageFromUrl(imageUrl.value);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const { data } = getCanvasPixels(canvas);
    const maxColorsValue = Math.min(256, Math.max(2, maxColors.value));
    const palette = generatePalette(data, maxColorsValue, { format: format.value });

    rawPalette.value = palette;

    let sortedPalette = palette;
    if (sortMode.value === "luminance") {
      sortedPalette = sortPaletteByLuminance(palette);
    } else if (sortMode.value === "hue") {
      sortedPalette = sortPaletteByHue(palette);
    }

    colors.value = paletteToDisplayColors(sortedPalette);

    const quantizedCanvas = quantizeCanvas(canvas, palette, format.value);
    quantizedUrl.value = quantizedCanvas.toDataURL("image/png");

    status.value = `已生成 ${palette.length} 色调色盘`;
    showToast(`已生成 ${palette.length} 色调色盘`, "success");
  } catch (err) {
    status.value = "生成失败：" + (err?.message || "未知错误");
    showToast(err?.message || "调色盘生成失败", "error");
  } finally {
    isProcessing.value = false;
  }
}

function resortPalette() {
  if (!rawPalette.value?.length) return;

  let sortedPalette = rawPalette.value;
  if (sortMode.value === "luminance") {
    sortedPalette = sortPaletteByLuminance(rawPalette.value);
  } else if (sortMode.value === "hue") {
    sortedPalette = sortPaletteByHue(rawPalette.value);
  }

  colors.value = paletteToDisplayColors(sortedPalette);
}

function downloadQuantizedImage() {
  if (!quantizedUrl.value) {
    showToast("请先生成调色盘", "warning");
    return;
  }

  const filename = (imageName.value?.replace(/\.[^.]+$/, "") || "image") +
    `_${colors.value.length}colors.png`;

  fetch(quantizedUrl.value)
    .then((res) => res.blob())
    .then((blob) => downloadBlob(filename, blob))
    .then(() => showToast("图片已下载", "success"))
    .catch(() => showToast("下载失败", "error"));
}

function copyPaletteAsCSS() {
  if (!colors.value?.length) {
    showToast("请先生成调色盘", "warning");
    return;
  }

  const css = colors.value
    .map((c, i) => `  --color-${i}: ${c.hex};`)
    .join("\n");
  const result = `:root {\n${css}\n}`;

  copyValue(result);
}

function copyPaletteAsJSON() {
  if (!colors.value?.length) {
    showToast("请先生成调色盘", "warning");
    return;
  }

  const json = JSON.stringify(
    colors.value.map((c) => c.hex),
    null,
    2
  );
  copyValue(json);
}

function clearPalette() {
  imageName.value = "";
  imageUrl.value = "";
  colors.value = [];
  rawPalette.value = [];
  quantizedUrl.value = "";
  status.value = "请上传 PNG / JPG 图片";
}

onMounted(() => {
  ensurePaletteLib();
});
</script>
