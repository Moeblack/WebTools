// 文本拼接工具模块
// 页面依赖 DOM：joiner-input, joiner-output, joiner-separator,
// joiner-process-btn, joiner-copy-btn, joiner-download-btn, joiner-copy-tooltip
import { copyWithTooltip } from "../utils/clipboard.js";

let lastResult = "";

/**
 * 将多行文本按分隔符拼接为单行
 * - 支持 \n 与 \t 作为转义序列
 * - 过滤空行
 */
function processJoiner(text, separator) {
  if (!text) return "";
  const actualSeparator = String(separator ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
  const lines = text.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim() !== "");
  return nonEmptyLines.join(actualSeparator);
}

export function init() {
  const input = document.getElementById("joiner-input");
  const output = document.getElementById("joiner-output");
  const separator = document.getElementById("joiner-separator");
  const processBtn = document.getElementById("joiner-process-btn");
  const copyBtn = document.getElementById("joiner-copy-btn");
  const downloadBtn = document.getElementById("joiner-download-btn");
  const tooltip = document.getElementById("joiner-copy-tooltip");

  if (!input || !output || !separator || !processBtn || !copyBtn || !downloadBtn) {
    console.warn("Joiner tool DOM 未就绪，跳过初始化");
    return;
  }

  processBtn.addEventListener(
    "click",
    () => {
      lastResult = processJoiner(input.value ?? "", separator.value ?? "\\n");
      // 显示时将换行与制表符转义回可读形式
      const display = lastResult.replace(/\n/g, "\\n").replace(/\t/g, "\\t");
      output.textContent = display;
    },
    { passive: true }
  );

  copyBtn.addEventListener(
    "click",
    () => {
      copyWithTooltip(lastResult, tooltip);
    },
    { passive: true }
  );

  downloadBtn.addEventListener(
    "click",
    () => {
      if (!lastResult) return;
      const blob = new Blob([lastResult], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = "joined_text.txt";
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    { passive: true }
  );
}