<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns">
      <div class="panel">
        <h2>输入文本</h2>
        <textarea v-model="input" placeholder="输入需要转换的简体或繁体文本"></textarea>
        <div class="option-group">
          <label class="checkbox">
            <input type="checkbox" v-model="quotes">
            <span>同时将『』替换为【】</span>
          </label>
        </div>
        <div class="form-row compact">
          <button class="btn btn-primary" :disabled="converting" @click="runConverter('t2s')">
            {{ converting ? "转换中..." : "繁体 → 简体" }}
          </button>
          <button class="btn btn-outline" :disabled="converting" @click="runConverter('s2t')">
            {{ converting ? "转换中..." : "简体 → 繁体" }}
          </button>
        </div>
        <p class="hint" v-if="!ready">词库加载中，首次转换可能稍有延迟...</p>
      </div>
      <div class="panel">
        <h2>转换结果</h2>
        <textarea v-model="output" readonly placeholder="转换完成后结果显示在此"></textarea>
        <button class="btn btn-secondary" :disabled="!output" @click="copyValue(output)">复制结果</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { ensureConverters, convertText as convertOpenCC, convertQuotes } from "../../tools/converter.js";
import { useClipboard } from "../../composables/useClipboard.js";
import { useToast } from "../../composables/useToast.js";

const { copyValue } = useClipboard();
const { showToast } = useToast();

const input = ref("");
const output = ref("");
const quotes = ref(true);
const converting = ref(false);
const ready = ref(false);
const prefetching = ref(false);

async function prefetchConverters() {
  if (prefetching.value || ready.value) return;
  prefetching.value = true;
  try {
    const ok = await ensureConverters();
    ready.value = ok;
  } catch {
    ready.value = false;
  } finally {
    prefetching.value = false;
  }
}

async function runConverter(direction) {
  if (!input.value) {
    output.value = "";
    return;
  }
  converting.value = true;
  try {
    const text = await convertOpenCC(direction, input.value);
    const result = quotes.value ? convertQuotes(text) : text;
    output.value = result;
    ready.value = true;
    showToast("转换完成", "success");
  } catch (e) {
    showToast(e.message || "转换失败，请稍后重试", "error");
  } finally {
    converting.value = false;
  }
}

onMounted(() => {
  prefetchConverters();
});
</script>
