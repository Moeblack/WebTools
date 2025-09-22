// 文本清理工具模块
// 绑定页面元素并实现：移除 Markdown 标记、移除空行、复制与下载
// 页面依赖的 DOM id：cleanup-input, cleanup-output, cleanup-remove-markdown, cleanup-remove-empty-lines,
// cleanup-process-btn, cleanup-copy-btn, cleanup-download-btn, cleanup-copy-tooltip

import { copyWithTooltip } from "../utils/clipboard.js";

/**
 * 处理文本清理
 * @param {string} text
 * @param {boolean} removeMarkdown
 * @param {boolean} removeEmptyLines
 * @returns {string}
 */
function processCleanup(text, removeMarkdown, removeEmptyLines) {
  if (!text) return "";
  let lines = text.split(/\r?\n/);

  if (removeMarkdown) {
    lines = lines.map((line) =>
      line
        // 开头标记
        .replace(/^[#*>\-`]+\s*/, "")
        // 加粗/斜体
        .replace(/(\*\*|__)(.*?)\1/g, "$2")
        .replace(/(\*|_)(.*?)\1/g, "$2")
        // 行内代码
        .replace(/`([^`]+)`/g, "$1")
        // 图片
        .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
        // 链接
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    );
  }

  if (removeEmptyLines) {
    return lines.filter((line) => line.trim() !== "").join("\n");
  }
  return lines.join("\n");
}

export function init() {
  const input = document.getElementById("cleanup-input");
  const output = document.getElementById("cleanup-output");
  const removeMarkdown = document.getElementById("cleanup-remove-markdown");
  const removeEmptyLines = document.getElementById("cleanup-remove-empty-lines");

  const processBtn = document.getElementById("cleanup-process-btn");
  const copyBtn = document.getElementById("cleanup-copy-btn");
  const downloadBtn = document.getElementById("cleanup-download-btn");
  const tooltip = document.getElementById("cleanup-copy-tooltip");

  if (!input || !output || !processBtn || !copyBtn || !downloadBtn) {
    console.warn("Cleanup tool DOM 未就绪，跳过初始化");
    return;
  }

  processBtn.addEventListener(
    "click",
    () => {
      const result = processCleanup(
        input.value,
        !!(removeMarkdown && removeMarkdown.checked),
        !!(removeEmptyLines && removeEmptyLines.checked)
      );
      output.value = result;
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
      a.download = "cleaned_text.txt";
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    { passive: true }
  );
}