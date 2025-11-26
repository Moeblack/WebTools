<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns">
      <div class="panel">
        <div class="panel-header">
          <h2>批量字幕处理</h2>
          <p>支持 SRT / VTT / LRC / ASS，多文件与文件夹上传。</p>
        </div>
        <div class="file-actions">
          <label class="btn btn-outline">
            上传字幕文件
            <input
              class="sr-only"
              type="file"
              :key="fileInputKey"
              multiple
              accept=".srt,.lrc,.ass,.ssa,.vtt"
              @change="handleSubtitleFiles($event.target.files)"
            >
          </label>
          <label class="btn btn-outline">
            选择文件夹
            <input
              class="sr-only"
              type="file"
              :key="'folder-' + fileInputKey"
              webkitdirectory
              directory
              multiple
              accept=".srt,.lrc,.ass,.ssa,.vtt"
              @change="handleSubtitleFiles($event.target.files)"
            >
          </label>
        </div>
        <p class="hint">{{ status }}</p>
        <div class="results-list">
          <p v-if="!batchResults.length" class="muted">请选择字幕文件开始批量处理，支持整个文件夹拖入。</p>
          <div
            class="result-item"
            v-for="(item, idx) in batchResults"
            :key="idx"
            :class="{ 'has-error': item.error }"
          >
            <div>
              <p class="filename">{{ item.originalName }}</p>
              <p class="result-note" v-if="item.error">{{ item.error }}</p>
              <p class="result-note" v-else>
                {{ item.newName }}
                <small v-if="item.format" class="tag">{{ item.format.toUpperCase() }}</small>
              </p>
            </div>
            <div class="result-actions">
              <span class="badge danger" v-if="item.error">失败</span>
              <template v-else>
                <span class="badge success">成功</span>
                <button class="btn btn-ghost" @click="downloadSubtitleItem(item)">下载</button>
              </template>
            </div>
          </div>
        </div>
        <div class="form-row compact">
          <button class="btn btn-ghost" @click="clearSubtitleBatch">清空列表</button>
          <button
            class="btn btn-primary"
            :disabled="!hasResults || downloadInProgress"
            @click="downloadSubtitleZip"
          >
            {{ downloadInProgress ? "正在打包..." : "下载全部 ZIP" }}
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2>单个文本处理</h2>
          <p>自动识别字幕格式，一键清理时间轴与标签。</p>
        </div>
        <label class="field">
          <span class="field-label">粘贴字幕内容</span>
          <textarea
            v-model="pasteInput"
            placeholder="在此粘贴字幕文本..."
            @input="processSubtitlePaste"
          ></textarea>
        </label>
        <label class="field">
          <span class="field-label">
            清理后的纯文本
            <small v-if="pasteFormat" class="tag">{{ pasteFormat === 'unknown' ? '未知格式' : pasteFormat.toUpperCase() }}</small>
          </span>
          <textarea v-model="pasteOutput" readonly></textarea>
        </label>
        <div class="form-row compact">
          <button class="btn btn-primary" @click="processSubtitlePaste">开始处理</button>
          <button class="btn btn-secondary" :disabled="!pasteOutput" @click="copyValue(pasteOutput)">
            复制结果
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from "vue";
import { processSubtitleText, processSubtitleFile, generateZipFromResults } from "../../tools/subtitle.js";
import { useClipboard } from "../../composables/useClipboard.js";
import { useToast } from "../../composables/useToast.js";
import { useDownload } from "../../composables/useDownload.js";

const { copyValue } = useClipboard();
const { showToast } = useToast();
const { downloadText, downloadBlob } = useDownload();

// State
const pasteInput = ref("");
const pasteOutput = ref("");
const pasteFormat = ref("");
const batchResults = ref([]);
const status = ref("请上传文件或文件夹...");
const isProcessing = ref(false);
const downloadInProgress = ref(false);
const fileInputKey = ref(Date.now());

// Computed
const hasResults = computed(() => batchResults.value.some((item) => !item.error));

// Methods
function processSubtitlePaste() {
  if (!pasteInput.value) {
    pasteOutput.value = "";
    pasteFormat.value = "";
    return;
  }
  const { output, format } = processSubtitleText(pasteInput.value);
  pasteOutput.value = output;
  pasteFormat.value = format;
}

async function handleSubtitleFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  isProcessing.value = true;
  status.value = `正在处理 ${files.length} 个文件...`;
  batchResults.value = [];
  downloadInProgress.value = false;

  const results = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    status.value = `正在处理 ${i + 1} / ${files.length}：${file.name}`;
    try {
      const res = await processSubtitleFile(file);
      results.push(res);
    } catch (err) {
      results.push({ originalName: file.name, error: err?.message || "处理失败" });
    }
  }

  batchResults.value = results;
  const successCount = results.filter((item) => !item.error).length;
  const failedCount = results.length - successCount;
  status.value = `已处理 ${successCount} / ${files.length} 个文件`;
  if (failedCount > 0) {
    showToast(`${failedCount} 个文件处理失败`, "warning");
  }
  isProcessing.value = false;
  fileInputKey.value = Date.now();
}

function downloadSubtitleItem(item) {
  if (item.error) return;
  downloadText(item.newName, item.content || "");
}

async function downloadSubtitleZip() {
  const success = batchResults.value.filter((item) => !item.error);
  if (!success.length) {
    showToast("暂无可打包内容", "warning");
    return;
  }
  downloadInProgress.value = true;
  try {
    const blob = await generateZipFromResults(success);
    downloadBlob("subtitle_results.zip", blob);
    showToast("ZIP 已生成", "success");
  } catch (e) {
    showToast(e.message || "打包失败", "error");
  } finally {
    downloadInProgress.value = false;
  }
}

function clearSubtitleBatch() {
  batchResults.value = [];
  status.value = "请上传文件或文件夹...";
  fileInputKey.value = Date.now();
}
</script>
