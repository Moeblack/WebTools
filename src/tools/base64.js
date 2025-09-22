// Base64 编解码工具模块
// 页面依赖的 DOM id：base64-input, base64-output, base64-encode-btn, base64-decode-btn, base64-copy-btn, base64-copy-tooltip
import { copyWithTooltip } from "../utils/clipboard.js";

// 兼容原实现：使用 btoa/atob，并处理 UTF-8
function base64Encode(text) {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch (e) {
    return "编码失败：无效的输入字符。";
  }
}
function base64Decode(text) {
  try {
    return decodeURIComponent(escape(atob(text)));
  } catch (e) {
    return "解码失败：无效的 Base64 字符串。";
  }
}

export function init() {
  const input = document.getElementById("base64-input");
  const output = document.getElementById("base64-output");
  const encodeBtn = document.getElementById("base64-encode-btn");
  const decodeBtn = document.getElementById("base64-decode-btn");
  const copyBtn = document.getElementById("base64-copy-btn");
  const tooltip = document.getElementById("base64-copy-tooltip");

  if (!input || !output || !encodeBtn || !decodeBtn || !copyBtn) {
    console.warn("Base64 tool DOM 未就绪，跳过初始化");
    return;
  }

  encodeBtn.addEventListener(
    "click",
    () => {
      output.value = base64Encode(input.value ?? "");
    },
    { passive: true }
  );

  decodeBtn.addEventListener(
    "click",
    () => {
      output.value = base64Decode(input.value ?? "");
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
}