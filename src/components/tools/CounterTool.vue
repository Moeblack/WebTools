<template>
  <section class="tab-panel">
    <div class="panel">
      <div class="panel-header">
        <h2>实时字数统计</h2>
        <p>统计汉字、英文单词、标点符号以及字符总数。</p>
      </div>
      <textarea v-model="input" placeholder="输入或粘贴文本，右侧实时统计..."></textarea>
      <div class="stats-grid">
        <div class="stat-card">
          <p class="stat-label">汉字/日文</p>
          <p class="stat-value">{{ stats.hanzi }}</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">英文单词</p>
          <p class="stat-value">{{ stats.words }}</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">标点符号</p>
          <p class="stat-value">{{ stats.punctuation }}</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">字符总数</p>
          <p class="stat-value">{{ stats.totalChars }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from "vue";
import { analyzeText } from "../../tools/counter.js";

const input = ref("");

const stats = computed(() => analyzeText(input.value));
</script>
