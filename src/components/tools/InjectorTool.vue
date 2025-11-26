<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns">
      <div class="panel">
        <h2>原始文本</h2>
        <textarea v-model="input" @input="updateInjected" placeholder="输入需要加料的文本..."></textarea>
      </div>
      <div class="panel">
        <h2>设置与结果</h2>
        <label class="field">
          <span class="field-label">插入字符串（默认零宽空格）</span>
          <input type="text" v-model="injectString" @input="updateInjected" placeholder="例如 · 或任意自定义字符串">
        </label>
        <button class="btn btn-ghost" @click="useZeroWidth">使用零宽空格</button>
        <textarea v-model="output" readonly placeholder="结果会实时显示在这里"></textarea>
        <div class="form-row compact">
          <button class="btn btn-secondary" :disabled="!output" @click="copyValue(output)">复制</button>
          <button class="btn btn-outline" :disabled="!output" @click="downloadResult">下载 .txt</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { processInjector } from "../../tools/injector.js";
import { useClipboard } from "../../composables/useClipboard.js";
import { useDownload } from "../../composables/useDownload.js";

const { copyValue } = useClipboard();
const { downloadText } = useDownload();

const input = ref("");
const injectString = ref("");
const output = ref("");

function updateInjected() {
  output.value = processInjector(input.value, injectString.value || "\u200b");
}

function useZeroWidth() {
  injectString.value = "\u200b";
  updateInjected();
}

function downloadResult() {
  if (!output.value) return;
  downloadText("injected_text.txt", output.value);
}

onMounted(() => {
  updateInjected();
});
</script>
