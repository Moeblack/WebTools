<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns">
      <div class="panel">
        <div class="panel-header">
          <h2>图片上传</h2>
          <p>上传图片并转换为点阵盲文画。</p>
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
            accept="image/*"
            @change="handleFileSelect($event.target.files)"
          >
          <div v-if="!imageUrl" class="dropzone-hint">
            <strong>点击或拖入图片</strong>
            <span>支持常用图片格式</span>
          </div>
          <div v-else class="dropzone-preview">
            <img :src="imageUrl" :alt="imageName || '原始图片'">
            <p class="muted">{{ imageName || '已加载图片' }}</p>
          </div>
        </div>
        <p class="hint small-text">{{ status }}</p>

        <div class="panel-header secondary">
          <h3>转换设置</h3>
        </div>
        
        <div class="sprite-settings-grid">
          <label class="field">
            <span class="field-label">输出宽度 (字符数): {{ targetWidth }}</span>
            <input 
              type="range" 
              v-model.number="targetWidth" 
              min="10" 
              max="200" 
              step="5"
              @change="generateBraille"
            >
          </label>
          
          <label class="field">
            <span class="field-label">亮度阈值: {{ threshold }}</span>
            <input 
              type="range" 
              v-model.number="threshold" 
              min="0" 
              max="255" 
              step="1"
              @change="generateBraille"
            >
          </label>

          <div class="field checkbox-field">
            <label class="checkbox-label">
              <input type="checkbox" v-model="invert" @change="generateBraille">
              <span>反转黑白</span>
            </label>
          </div>
        </div>

        <div class="form-row compact">
          <button
            class="btn btn-primary"
            :disabled="!imageUrl || isProcessing"
            @click="generateBraille"
          >
            {{ isProcessing ? "处理中..." : "生成点阵画" }}
          </button>
          <button class="btn btn-ghost" :disabled="!imageUrl" @click="clearAll">
            清空
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header flex-header">
          <h2>预览与导出</h2>
          <div class="panel-actions">
<button 
              class="btn btn-secondary btn-sm" 
              :disabled="!brailleResult"
              @click="copyResult"
            >
              复制结果
            </button>
          </div>
        </div>

        <div class="braille-output-container" v-if="brailleResult">
          <pre class="braille-output" :style="{ 
            fontSize: previewFontSize + 'px',
            lineHeight: previewLineHeight,
            letterSpacing: previewLetterSpacing + 'px'
          }">{{ brailleResult }}</pre>
          
          <div class="preview-controls">
            <button class="btn btn-icon" @click="previewFontSize = Math.max(2, previewFontSize - 1)" title="缩小">-</button>
            <span class="size-label">{{ previewFontSize }}px</span>
            <button class="btn btn-icon" @click="previewFontSize = Math.min(48, previewFontSize + 1)" title="放大">+</button>
            <div class="divider"></div>
            <button class="btn btn-icon" @click="previewLineHeight = Math.max(0.5, Math.round((previewLineHeight - 0.05) * 100) / 100)" title="减小行高">↕-</button>
            <button class="btn btn-icon" @click="previewLineHeight = Math.min(1.5, Math.round((previewLineHeight + 0.05) * 100) / 100)" title="增大行高">↕+</button>
          </div>
        </div>
        <div v-else class="empty-state">
          <p class="muted">生成点阵画后将在此显示预览</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";
import { imageDataToBraille, resizeImageForBraille } from "../../tools/braille.js";
import { useClipboard } from "../../composables/useClipboard.js";
import { useToast } from "../../composables/useToast.js";
import { useFileReader } from "../../composables/useFileReader.js";

const { copyValue } = useClipboard();
const { showToast } = useToast();
const { readAsDataUrl, loadImageFromUrl } = useFileReader();

// Refs
const fileInput = ref(null);
const isDragging = ref(false);
const isProcessing = ref(false);
const status = ref("请上传图片");
const imageName = ref("");
const imageUrl = ref("");
const brailleResult = ref("");

// Settings
const targetWidth = ref(80);
const threshold = ref(128);
const invert = ref(false);
const previewFontSize = ref(10);
const previewLineHeight = ref(0.85); // 默认稍小一些以消除垂直缝隙
const previewLetterSpacing = ref(0);

// Methods
function triggerUpload() {
  fileInput.value?.click();
}

async function handleFileSelect(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const file = files[0];
  if (!file.type?.startsWith("image/")) {
    showToast("请上传图片文件", "warning");
    return;
  }

  try {
    imageName.value = file.name;
    imageUrl.value = await readAsDataUrl(file);
    const img = await loadImageFromUrl(imageUrl.value);
    status.value = `已加载：${img.width} × ${img.height}`;
    generateBraille();
  } catch (err) {
    showToast("图片加载失败", "error");
  } finally {
    if (fileInput.value) fileInput.value.value = "";
  }
}

function handleDrop(event) {
  isDragging.value = false;
  if (event.dataTransfer?.files?.length) {
    handleFileSelect(event.dataTransfer.files);
  }
}

async function generateBraille() {
  if (!imageUrl.value) return;

  isProcessing.value = true;
  try {
    const img = await loadImageFromUrl(imageUrl.value);
    const resizedCanvas = resizeImageForBraille(img, targetWidth.value);
    const ctx = resizedCanvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, resizedCanvas.width, resizedCanvas.height);
    
    brailleResult.value = imageDataToBraille(imageData, {
      threshold: threshold.value,
      invert: invert.value
    });
    
    showToast("转换成功", "success");
  } catch (err) {
    console.error(err);
    showToast("转换失败", "error");
  } finally {
    isProcessing.value = false;
  }
}

function copyResult() {
  if (brailleResult.value) {
    copyValue(brailleResult.value);
    showToast("已复制到剪贴板", "success");
  }
}

function clearAll() {
  imageUrl.value = "";
  imageName.value = "";
  brailleResult.value = "";
  status.value = "请上传图片";
}
</script>

<style scoped>
.braille-output-container {
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: #1e1e1e; /* Dark background often looks better for Braille art */
  overflow: auto;
  display: flex;
  flex-direction: column;
  min-height: 400px;
  max-height: 600px;
}

.braille-output {
  margin: 0;
  padding: 1rem;
  overflow: auto;
  flex: 1;
  color: #eee;
  /* 优化字体栈，确保盲文点阵对齐 */
  font-family: "Braille", "Consolas", "Monaco", "DejaVu Sans Mono", monospace;
  white-space: pre;
  font-variant-ligatures: none;
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  justify-content: flex-end;
}

.divider {
  width: 1px;
  height: 16px;
  background: var(--border-color);
  margin: 0 4px;
}

.flex-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.size-label {
  font-size: 12px;
  min-width: 40px;
  text-align: center;
}

.checkbox-field {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
}

.panel-actions {
  margin-left: auto;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-icon {
  width: 24px;
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}
</style>
