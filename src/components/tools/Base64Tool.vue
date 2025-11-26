<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns">
      <div class="panel">
        <h2>输入</h2>
        <textarea v-model="input" placeholder="输入原始文本或 Base64 字符串..."></textarea>
        <div class="form-row compact">
          <button class="btn btn-primary" @click="encodeBase64">Base64 编码</button>
          <button class="btn btn-outline" @click="decodeBase64">Base64 解码</button>
        </div>
      </div>
      <div class="panel">
        <h2>输出</h2>
        <textarea v-model="output" readonly placeholder="结果将显示在这里"></textarea>
        <div class="form-row compact">
          <button class="btn btn-secondary" :disabled="!output" @click="copyValue(output)">复制</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";
import { base64Encode, base64Decode } from "../../tools/base64.js";
import { useClipboard } from "../../composables/useClipboard.js";

const { copyValue } = useClipboard();

const input = ref("");
const output = ref("");

function encodeBase64() {
  output.value = base64Encode(input.value);
}

function decodeBase64() {
  output.value = base64Decode(input.value);
}
</script>
