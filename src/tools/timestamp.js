// 时间戳双向转换工具模块
// 页面依赖 DOM：
// ts-year, ts-month, ts-day, ts-hour, ts-minute, ts-second
// ts-output-from-date, ts-copy-tooltip-from-date
// ts-input-from-ts, ts-output-from-ts, ts-copy-tooltip-from-ts
// current-timestamp
//
// 说明：实现 日期 -> 时间戳 与 时间戳 -> 日期 的双向更新；点击结果可复制

import { copyWithTooltip } from "../utils/clipboard.js";

let isUpdating = false;

/** 每秒更新当前时间戳显示 */
function initCurrentTimestamp(currentDisplay) {
  if (!currentDisplay) return;
  const update = () => {
    try {
      currentDisplay.textContent = Math.floor(Date.now() / 1000);
    } catch (_) {}
  };
  update();
  // 不使用过于频繁的轮询，维持每秒一次
  setInterval(update, 1000);
}

function updateTimestampFromDate(fields) {
  if (isUpdating) return;
  isUpdating = true;

  const year = parseInt(fields.year.value);
  const month = parseInt(fields.month.value);
  const day = parseInt(fields.day.value);
  const hour = parseInt(fields.hour.value) || 0;
  const minute = parseInt(fields.minute.value) || 0;
  const second = parseInt(fields.second.value) || 0;

  if (year && month && day) {
    const date = new Date(year, (month - 1), day, hour, minute, second);
    fields.outputFromDate.value = Math.floor(date.getTime() / 1000);
  } else {
    fields.outputFromDate.value = "";
  }

  isUpdating = false;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function updateDateFromTimestamp(fields) {
  if (isUpdating) return;
  isUpdating = true;

  const ts = parseInt(fields.inputFromTs.value);
  if (ts && ts > 0) {
    const date = new Date(ts * 1000);
    fields.year.value = date.getFullYear();
    fields.month.value = date.getMonth() + 1;
    fields.day.value = date.getDate();
    fields.hour.value = date.getHours();
    fields.minute.value = date.getMinutes();
    fields.second.value = date.getSeconds();

    fields.outputFromTs.value =
      `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
      `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
  } else {
    fields.outputFromTs.value = "";
    ["year", "month", "day", "hour", "minute", "second"].forEach((k) => (fields[k].value = ""));
  }

  isUpdating = false;
}

export function init() {
  const year = document.getElementById("ts-year");
  const month = document.getElementById("ts-month");
  const day = document.getElementById("ts-day");
  const hour = document.getElementById("ts-hour");
  const minute = document.getElementById("ts-minute");
  const second = document.getElementById("ts-second");

  const outputFromDate = document.getElementById("ts-output-from-date");
  const tooltipFromDate = document.getElementById("ts-copy-tooltip-from-date");

  const inputFromTs = document.getElementById("ts-input-from-ts");
  const outputFromTs = document.getElementById("ts-output-from-ts");
  const tooltipFromTs = document.getElementById("ts-copy-tooltip-from-ts");

  const currentDisplay = document.getElementById("current-timestamp");

  if (!year || !month || !day || !hour || !minute || !second || !outputFromDate || !inputFromTs || !outputFromTs) {
    console.warn("Timestamp tool DOM 未就绪，跳过初始化");
    return;
  }

  const fields = {
    year, month, day, hour, minute, second,
    outputFromDate,
    inputFromTs, outputFromTs,
  };

  // 初始化当前时间与日期字段
  try {
    initCurrentTimestamp(currentDisplay);
    const now = new Date();
    year.value = now.getFullYear();
    month.value = now.getMonth() + 1;
    day.value = now.getDate();
    hour.value = now.getHours();
    minute.value = now.getMinutes();
    second.value = now.getSeconds();
    updateTimestampFromDate(fields);
  } catch (_) {}

  // 绑定事件（双向联动）
  const dateInputs = [year, month, day, hour, minute, second];
  dateInputs.forEach((input) => input.addEventListener("input", () => updateTimestampFromDate(fields), { passive: true }));
  inputFromTs.addEventListener("input", () => updateDateFromTimestamp(fields), { passive: true });

  // 点击复制
  outputFromDate.addEventListener("click", () => copyWithTooltip(outputFromDate.value, tooltipFromDate), { passive: true });
  outputFromTs.addEventListener("click", () => copyWithTooltip(outputFromTs.value, tooltipFromTs), { passive: true });
}