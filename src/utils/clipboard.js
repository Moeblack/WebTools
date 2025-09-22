// 通用剪贴板工具：优先 Clipboard API，失败时回退 execCommand('copy')
// 用法：
//   import { copyText, copyWithTooltip } from "./utils/clipboard.js";
//   const ok = await copyText("hello");
//   copyWithTooltip("text", document.getElementById("some-tooltip-span"));
//
// 兼容性：支持现代浏览器与 GitHub Pages 部署环境

/**
 * 复制文本到系统剪贴板
 * @param {string} text
 * @returns {Promise<boolean>} 是否复制成功
 */
export async function copyText(text) {
  if (text === undefined || text === null) return false;
  const val = String(text);

  // 优先 Clipboard API
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(val);
      return true;
    }
  } catch (e) {
    // 降级到 execCommand
  }

  // 回退：使用隐藏 textarea + execCommand
  try {
    const textArea = document.createElement("textarea");
    textArea.value = val;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textArea);
    return !!ok;
  } catch (e) {
    return false;
  }
}

/**
 * 附带 tooltip 的复制体验（与页面 .tooltip 结构配合）
 * @param {string} text 要复制的文本
 * @param {HTMLElement} tooltipEl 显示提示文字的 span.tooltiptext 元素
 * @param {{success?: string, fail?: string, idle?: string}} messages 可选自定义消息
 */
export async function copyWithTooltip(text, tooltipEl, messages = {}) {
  if (!tooltipEl || !(tooltipEl instanceof Element)) {
    // 若没有 tooltip，退化为纯复制
    await copyText(text);
    return;
  }
  const parent = tooltipEl.parentElement;
  const msgOk = messages.success ?? "已复制!";
  const msgFail = messages.fail ?? "复制失败!";
  const msgIdle = messages.idle ?? "复制到剪贴板";

  const ok = await copyText(text);
  tooltipEl.textContent = ok ? msgOk : msgFail;

  if (parent && parent.classList) {
    parent.classList.add("show");
    setTimeout(() => {
      parent.classList.remove("show");
      tooltipEl.textContent = msgIdle;
    }, 2000);
  }
}