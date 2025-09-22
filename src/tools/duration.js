// 时间段双向转换工具模块
// 页面依赖 DOM：
// dr-days, dr-hours, dr-minutes, dr-seconds, dr-output-total-seconds, dr-copy-tooltip-from-duration
// dr-input-total-seconds, dr-output-days, dr-output-hours, dr-output-minutes, dr-output-seconds
// .quick-duration-btn 若干
//
// 说明：实现 复合时间 ↔ 总秒数 双向联动；提供快捷按钮；点击总秒数可复制

import { copyWithTooltip } from "../utils/clipboard.js";

let isUpdating = false;

function toTotalSeconds(days, hours, minutes, seconds) {
  const d = Number(days) || 0;
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  const s = Number(seconds) || 0;
  return d * 86400 + h * 3600 + m * 60 + s;
}

function fromTotalSeconds(total) {
  let t = Number(total) || 0;
  if (t < 0) t = 0;
  const days = Math.floor(t / 86400);
  let remainder = t % 86400;
  const hours = Math.floor(remainder / 3600);
  remainder %= 3600;
  const minutes = Math.floor(remainder / 60);
  const seconds = remainder % 60;
  return { days, hours, minutes, seconds };
}

export function init() {
  const days = document.getElementById("dr-days");
  const hours = document.getElementById("dr-hours");
  const minutes = document.getElementById("dr-minutes");
  const seconds = document.getElementById("dr-seconds");

  const outputTotalSeconds = document.getElementById("dr-output-total-seconds");
  const tooltipFromDuration = document.getElementById("dr-copy-tooltip-from-duration");

  const inputTotalSeconds = document.getElementById("dr-input-total-seconds");

  const outputDays = document.getElementById("dr-output-days");
  const outputHours = document.getElementById("dr-output-hours");
  const outputMinutes = document.getElementById("dr-output-minutes");
  const outputSeconds = document.getElementById("dr-output-seconds");

  const quickBtns = document.querySelectorAll(".quick-duration-btn");

  if (
    !days || !hours || !minutes || !seconds ||
    !outputTotalSeconds || !inputTotalSeconds ||
    !outputDays || !outputHours || !outputMinutes || !outputSeconds
  ) {
    console.warn("Duration tool DOM 未就绪，跳过初始化");
    return;
  }

  function updateSecondsFromDuration() {
    if (isUpdating) return;
    isUpdating = true;

    const total = toTotalSeconds(days.value, hours.value, minutes.value, seconds.value);
    outputTotalSeconds.value = String(total);
    inputTotalSeconds.value = String(total);

    // 同步只读输出
    const parts = fromTotalSeconds(total);
    outputDays.value = String(parts.days);
    outputHours.value = String(parts.hours);
    outputMinutes.value = String(parts.minutes);
    outputSeconds.value = String(parts.seconds);

    isUpdating = false;
  }

  function updateDurationFromSeconds() {
    if (isUpdating) return;
    isUpdating = true;

    const total = Number(inputTotalSeconds.value) || 0;
    const parts = fromTotalSeconds(total);

    days.value = String(parts.days);
    hours.value = String(parts.hours);
    minutes.value = String(parts.minutes);
    seconds.value = String(parts.seconds);

    outputDays.value = String(parts.days);
    outputHours.value = String(parts.hours);
    outputMinutes.value = String(parts.minutes);
    outputSeconds.value = String(parts.seconds);

    outputTotalSeconds.value = String(total);

    isUpdating = false;
  }

  // 绑定事件
  [days, hours, minutes, seconds].forEach((el) =>
    el.addEventListener(
      "input",
      () => {
        updateSecondsFromDuration();
        updateDurationFromSeconds(); // 同步只读输出
      },
      { passive: true }
    )
  );

  inputTotalSeconds.addEventListener(
    "input",
    () => {
      updateDurationFromSeconds();
      updateSecondsFromDuration(); // 同步另一侧总秒数框
    },
    { passive: true }
  );

  // 快捷按钮
  quickBtns.forEach((btn) => {
    btn.addEventListener(
      "click",
      () => {
        const d = Number(btn.dataset.days) || 0;
        const h = Number(btn.dataset.hours) || 0;
        days.value = String(d);
        hours.value = String(h);
        minutes.value = "0";
        seconds.value = "0";
        updateSecondsFromDuration();
        updateDurationFromSeconds();
      },
      { passive: true }
    );
  });

  // 复制总秒数
  outputTotalSeconds.addEventListener(
    "click",
    () => copyWithTooltip(outputTotalSeconds.value, tooltipFromDuration),
    { passive: true }
  );

  // 初始化一次
  updateSecondsFromDuration();
  updateDurationFromSeconds();
}