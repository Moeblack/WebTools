<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns">
      <div class="panel">
        <div class="panel-header">
          <h2>复合时间 → 秒</h2>
          <p>输入天/时/分/秒，计算对应的总秒数。</p>
        </div>
        <div class="form-row wrap">
          <input type="number" min="0" v-model="days" placeholder="天" @input="updateSecondsFromDuration">
          <input type="number" min="0" v-model="hours" placeholder="小时" @input="updateSecondsFromDuration">
          <input type="number" min="0" v-model="minutes" placeholder="分钟" @input="updateSecondsFromDuration">
          <input type="number" min="0" v-model="seconds" placeholder="秒" @input="updateSecondsFromDuration">
        </div>
        <label class="field">
          <span class="field-label">总秒数</span>
          <input type="text" :value="totalSeconds" readonly @click="copyValue(totalSeconds)">
        </label>
        <div class="quick-buttons">
          <button class="quick-btn" @click="applyQuickDuration(0, 1)">1 小时</button>
          <button class="quick-btn" @click="applyQuickDuration(0, 2)">2 小时</button>
          <button class="quick-btn" @click="applyQuickDuration(0, 6)">6 小时</button>
          <button class="quick-btn" @click="applyQuickDuration(1, 0)">1 天</button>
          <button class="quick-btn" @click="applyQuickDuration(7, 0)">7 天</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h2>秒 → 复合时间</h2>
          <p>输入总秒数，立即拆分为天 / 时 / 分 / 秒。</p>
        </div>
        <label class="field">
          <span class="field-label">输入总秒数</span>
          <input type="number" min="0" v-model="totalSeconds" @input="updateDurationFromSeconds">
        </label>
        <div class="form-row wrap">
          <input type="text" readonly :value="outputs.days + ' 天'">
          <input type="text" readonly :value="outputs.hours + ' 小时'">
          <input type="text" readonly :value="outputs.minutes + ' 分钟'">
          <input type="text" readonly :value="outputs.seconds + ' 秒'">
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { toTotalSeconds, fromTotalSeconds } from "../../tools/duration.js";
import { useClipboard } from "../../composables/useClipboard.js";

const { copyValue } = useClipboard();

const days = ref("0");
const hours = ref("0");
const minutes = ref("0");
const seconds = ref("0");
const totalSeconds = ref("0");
const outputs = reactive({ days: "0", hours: "0", minutes: "0", seconds: "0" });

function updateSecondsFromDuration() {
  const total = toTotalSeconds(days.value, hours.value, minutes.value, seconds.value);
  totalSeconds.value = String(total);
  const parts = fromTotalSeconds(total);
  outputs.days = String(parts.days);
  outputs.hours = String(parts.hours);
  outputs.minutes = String(parts.minutes);
  outputs.seconds = String(parts.seconds);
}

function updateDurationFromSeconds() {
  const parts = fromTotalSeconds(totalSeconds.value);
  days.value = String(parts.days);
  hours.value = String(parts.hours);
  minutes.value = String(parts.minutes);
  seconds.value = String(parts.seconds);
  outputs.days = String(parts.days);
  outputs.hours = String(parts.hours);
  outputs.minutes = String(parts.minutes);
  outputs.seconds = String(parts.seconds);
}

function applyQuickDuration(d, h) {
  days.value = String(d);
  hours.value = String(h);
  minutes.value = "0";
  seconds.value = "0";
  updateSecondsFromDuration();
}

onMounted(() => {
  updateDurationFromSeconds();
});
</script>
