<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns">
      <div class="panel">
        <h2>原始文本</h2>
        <textarea v-model="input" placeholder="粘贴需要清理的文本..."></textarea>
      </div>
      <div class="panel">
        <h2>清理结果</h2>
        <textarea v-model="output" readonly placeholder="点击开始处理后显示结果"></textarea>
        <div class="option-group">
          <label class="checkbox">
            <input type="checkbox" v-model="removeMarkdown">
            <span>移除 Markdown 标记</span>
          </label>
          <label class="checkbox">
            <input type="checkbox" v-model="removeEmptyLines">
            <span>移除空行</span>
          </label>
        </div>
        <div class="form-row compact">
          <button class="btn btn-primary" @click="runCleanup">开始处理</button>
          <button class="btn btn-secondary" :disabled="!output" @click="copyValue(output)">复制</button>
          <button class="btn btn-outline" :disabled="!output" @click="downloadResult">下载 .txt</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";
import { processCleanup } from "../../tools/cleanup.js";
import { useClipboard } from "../../composables/useClipboard.js";
import { useDownload } from "../../composables/useDownload.js";

const { copyValue } = useClipboard();
const { downloadText } = useDownload();

const input = ref("");
const output = ref("");
const removeMarkdown = ref(true);
const removeEmptyLines = ref(true);

function runCleanup() {
  output.value = processCleanup(input.value, removeMarkdown.value, removeEmptyLines.value);
}

function downloadResult() {
  if (!output.value) return;
  downloadText("cleaned_text.txt", output.value);
}
</script>
