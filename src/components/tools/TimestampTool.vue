<template>
  <section class="tab-panel">
    <div class="panel-grid two-columns">
      <div class="panel">
        <div class="panel-header">
          <h2>日期 → 时间戳</h2>
          <p>输入年月日（可选时间），自动转换为 Unix 时间戳。</p>
        </div>
        <div class="form-row wrap">
          <input type="number" v-model.number="year" placeholder="年" @input="updateTimestampFromDate">
          <input type="number" v-model.number="month" placeholder="月" @input="updateTimestampFromDate">
          <input type="number" v-model.number="day" placeholder="日" @input="updateTimestampFromDate">
        </div>
        <div class="form-row wrap">
          <input type="number" v-model.number="hour" placeholder="小时" @input="updateTimestampFromDate">
          <input type="number" v-model.number="minute" placeholder="分钟" @input="updateTimestampFromDate">
          <input type="number" v-model.number="second" placeholder="秒" @input="updateTimestampFromDate">
        </div>
        <label class="field">
          <span class="field-label">时间戳（秒）</span>
          <input type="text" :value="fromDate" readonly @click="copyValue(fromDate)">
        </label>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h2>时间戳 → 日期</h2>
          <p>输入时间戳，自动生成格式化日期。</p>
        </div>
        <label class="field">
          <span class="field-label">Unix 时间戳</span>
          <input type="number" v-model.number="fromTsInput" @input="updateDateFromTimestamp">
        </label>
        <label class="field">
          <span class="field-label">格式化结果</span>
          <input type="text" :value="fromTsOutput" readonly @click="copyValue(fromTsOutput)">
        </label>
        <div class="current-timestamp">
          <span>当前时间戳：<strong>{{ currentTs }}</strong></span>
          <button class="btn btn-ghost" @click="copyValue(currentTs)">复制</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { getCurrentTimestamp, timestampFromParts, partsFromTimestamp, formatParts } from "../../tools/timestamp.js";
import { useClipboard } from "../../composables/useClipboard.js";

const { copyValue } = useClipboard();

const nowTs = getCurrentTimestamp();
const nowParts = partsFromTimestamp(nowTs) || {
  year: "",
  month: "",
  day: "",
  hour: "",
  minute: "",
  second: "",
};

const year = ref(nowParts.year);
const month = ref(nowParts.month);
const day = ref(nowParts.day);
const hour = ref(nowParts.hour);
const minute = ref(nowParts.minute);
const second = ref(nowParts.second);
const fromDate = ref("");
const fromTsInput = ref(String(nowTs));
const fromTsOutput = ref(formatParts(nowParts));
const currentTs = ref(nowTs);

let timestampTicker = null;

function updateTimestampFromDate() {
  const timestamp = timestampFromParts({
    year: year.value,
    month: month.value,
    day: day.value,
    hour: hour.value,
    minute: minute.value,
    second: second.value,
  });
  if (timestamp == null) {
    fromDate.value = "";
    return;
  }
  fromDate.value = String(timestamp);
  const parts = partsFromTimestamp(timestamp);
  fromTsInput.value = String(timestamp);
  fromTsOutput.value = formatParts(parts);
}

function updateDateFromTimestamp() {
  const ts = Number(fromTsInput.value);
  const parts = partsFromTimestamp(ts);
  if (!parts) {
    fromTsOutput.value = "";
    return;
  }
  year.value = parts.year;
  month.value = parts.month;
  day.value = parts.day;
  hour.value = parts.hour;
  minute.value = parts.minute;
  second.value = parts.second;
  fromTsOutput.value = formatParts(parts);
  fromDate.value = String(ts);
}

function startTimestampTicker() {
  if (timestampTicker) clearInterval(timestampTicker);
  timestampTicker = setInterval(() => {
    currentTs.value = getCurrentTimestamp();
  }, 1000);
}

onMounted(() => {
  updateTimestampFromDate();
  startTimestampTicker();
});

onBeforeUnmount(() => {
  if (timestampTicker) clearInterval(timestampTicker);
});
</script>
