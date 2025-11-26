<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns">
      <div class="panel">
        <h2>源文本</h2>
        <textarea
          v-model="input"
          placeholder="输入普通字符串或包含 \xAA 的字节序列..."
          @input="autoDetectEscapeMode"
        ></textarea>
        <div class="option-group wrap">
          <label class="radio">
            <input type="radio" value="text" v-model="sourceMode">
            <span>字符串 → 转义</span>
          </label>
          <label class="radio">
            <input type="radio" value="bytes" v-model="sourceMode">
            <span>转义 → 字符串</span>
          </label>
        </div>
        <div class="option-group wrap">
          <label class="field small">
            <span class="field-label">编码</span>
            <select v-model="encoding">
              <option value="utf8">UTF-8</option>
              <option value="latin1">Latin-1</option>
            </select>
          </label>
          <label class="field small">
            <span class="field-label">输出模式</span>
            <select v-model="outputMode">
              <option value="python">Python 字节字面量</option>
              <option value="plain">纯 \xXX 序列</option>
            </select>
          </label>
          <label class="field small">
            <span class="field-label">Hex 大小写</span>
            <select v-model="hexCase">
              <option value="lower">小写</option>
              <option value="upper">大写</option>
            </select>
          </label>
        </div>
        <button class="btn btn-primary" @click="runEscapeConversion">开始转换</button>
      </div>
      <div class="panel">
        <h2>结果</h2>
        <textarea v-model="output" readonly placeholder="转换结果会显示在这里"></textarea>
        <p class="error-banner" v-if="error">{{ error }}</p>
        <div class="form-row compact">
          <button class="btn btn-secondary" :disabled="!output" @click="copyValue(output)">复制</button>
          <button class="btn btn-outline" :disabled="!output" @click="downloadResult">下载 .txt</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";
import { convertEscapes, detectSourceMode } from "../../tools/escape.js";
import { useClipboard } from "../../composables/useClipboard.js";
import { useDownload } from "../../composables/useDownload.js";

const { copyValue } = useClipboard();
const { downloadText } = useDownload();

const input = ref("");
const output = ref("");
const sourceMode = ref("text");
const encoding = ref("utf8");
const outputMode = ref("python");
const hexCase = ref("lower");
const error = ref("");

function autoDetectEscapeMode() {
  sourceMode.value = detectSourceMode(input.value);
}

function runEscapeConversion() {
  const result = convertEscapes({
    input: input.value,
    sourceMode: sourceMode.value,
    encoding: encoding.value,
    outputMode: outputMode.value,
    hexCase: hexCase.value,
  });
  output.value = result.result;
  error.value = result.error;
}

function downloadResult() {
  if (!output.value) return;
  downloadText("escaped_text.txt", output.value);
}
</script>
