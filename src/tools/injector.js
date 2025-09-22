// 文本加料工具模块
// 页面依赖 DOM：injector-input, injector-output, injector-string, injector-zws-btn,
// injector-copy-btn, injector-download-btn, injector-copy-tooltip
import { copyWithTooltip } from "../utils/clipboard.js";

/**
 * 在每个字符之间插入字符串
 * 默认使用零宽空格 \u200b
 */
function processInjector(text, injectionString) {
  if (!text) return "";
  const inj = injectionString != null ? String(injectionString) : "\u200b";
  // 使用 Array.from 以更好地兼容代理项和多字节字符
  return Array.from(text).join(inj);
}

export function init() {
  const input = document.getElementById("injector-input");
  const output = document.getElementById("injector-output");
  const stringInput = document.getElementById("injector-string");
  const zwsBtn = document.getElementById("injector-zws-btn");
  const copyBtn = document.getElementById("injector-copy-btn");
  const downloadBtn = document.getElementById("injector-download-btn");
  const tooltip = document.getElementById("injector-copy-tooltip");

  if (!input || !output || !stringInput || !zwsBtn || !copyBtn || !downloadBtn) {
    console.warn("Injector tool DOM 未就绪，跳过初始化");
    return;
  }

  const run = () => {
    const inj = stringInput.value && stringInput.value.length > 0 ? stringInput.value : "\u200b";
    output.value = processInjector(input.value ?? "", inj);
  };

  input.addEventListener("input", run, { passive: true });
  stringInput.addEventListener("input", run, { passive: true });

  zwsBtn.addEventListener(
    "click",
    () => {
      stringInput.value = "\u200b";
      run();
    },
    { passive: true }
  );

  copyBtn.addEventListener(
    "click",
    () => {
      copyWithTooltip(output.value, tooltip);
    },
    { passive: true }
  );

  downloadBtn.addEventListener(
    "click",
    () => {
      const val = output.value || "";
      if (!val) return;
      const blob = new Blob([val], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = "injected_text.txt";
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    { passive: true }
  );
}