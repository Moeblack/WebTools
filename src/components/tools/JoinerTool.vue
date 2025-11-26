<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns">
      <div class="panel">
        <h2>多行输入</h2>
        <textarea v-model="input" placeholder="在此输入或粘贴多行文本..."></textarea>
      </div>
      <div class="panel">
        <h2>拼接配置</h2>
        <label class="field">
          <span class="field-label">分隔符（支持 \n、\t）</span>
          <input type="text" v-model="separator">
        </label>
        <label class="field">
          <span class="field-label">输出预览</span>
          <textarea v-model="displayOutput" readonly class="mono"></textarea>
        </label>
        <div class="form-row compact">
          <button class="btn btn-primary" @click="runJoiner">开始拼接</button>
          <button class="btn btn-secondary" :disabled="!lastResult" @click="copyValue(lastResult)">复制</button>
          <button class="btn btn-outline" :disabled="!lastResult" @click="downloadResult">下载 .txt</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { processJoiner } from "../../tools/joiner.js";
import { useClipboard } from "../../composables/useClipboard.js";
import { useDownload } from "../../composables/useDownload.js";

const { copyValue } = useClipboard();
const { downloadText } = useDownload();

const input = ref("");
const separator = ref("\\n");
const displayOutput = ref("");
const lastResult = ref("");

function runJoiner() {
  lastResult.value = processJoiner(input.value, separator.value);
  displayOutput.value = (lastResult.value || "").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
}

function downloadResult() {
  if (!lastResult.value) return;
  downloadText("joined_text.txt", lastResult.value);
}

onMounted(() => {
  runJoiner();
});
</script>
