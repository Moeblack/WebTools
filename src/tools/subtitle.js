// 字幕批量处理工具模块（懒加载 JSZip UMD）
// 页面依赖 DOM：
//  - 单文本：subtitle-paste-input, subtitle-paste-output, subtitle-paste-process-btn, subtitle-paste-copy-btn, subtitle-paste-tooltip
//  - 批量：subtitle-files-input, subtitle-folder-input, subtitle-results-container, subtitle-results-status,
//          subtitle-download-zip-btn, subtitle-clear-btn
//
// 说明：按需加载 JSZip（UMD）以生成 ZIP 文件。
// CDN: https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js

import { copyWithTooltip } from "../utils/clipboard.js";
import { lazyLoadScript } from "../utils/lazyLoad.js";

// --- 字幕格式处理逻辑（移植并精简自旧实现） ---

function processSrt(text) {
  if (!text) return "";
  const timeArrowPattern = new RegExp(String.raw`\\d{2}:\\d{2}:\\d{2}[,.]\\d{3}\\s*-->\\s*\\d{2}:\\d{2}:\\d{2}[,.]\\d{3}[\\r\\n]+`, "gm");
  const htmlTagPattern = new RegExp("<[^>]*>", "g");
  return text
    .replace(/^\d+[\r\n]+/gm, "")
    .replace(timeArrowPattern, "")
    .replace(htmlTagPattern, "")
    .replace(/^\s*[\r\n]/gm, "")
    .trim();
}

function processVtt(text) {
  if (!text) return "";
  const timeArrowLinePattern = new RegExp(String.raw`\\d{2}:\\d{2}:\\d{2}[,.]\\d{3}\\s*-->\\s*\\d{2}:\\d{2}:\\d{2}[,.]\\d{3}.*[\\r\\n]+`, "gm");
  const htmlTagPattern = new RegExp("<[^>]*>", "g");
  return text
    .replace(/^WEBVTT[\r\n\s]*/, "")
    .replace(/^\d+[\r\n]+/gm, "")
    .replace(/NOTE[\s\S]*?(\r?\n){2,}/gm, "")
    .replace(timeArrowLinePattern, "")
    .replace(htmlTagPattern, "")
    .replace(/^\s*[\r\n]/gm, "")
    .trim();
}

function processLrc(text) {
  if (!text) return "";
  return text.replace(/\[\d{2}:\d{2}[,.]\d{2,3}\]|\[[a-z]{2,}:.*?\]/g, "").replace(/^\s*[\r\n]/gm, "").trim();
}

function processAss(text) {
  if (!text) return "";
  const dialogueRegex = /^Dialogue:\s*[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,([\s\S]*)/i;
  return text
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(dialogueRegex);
      return match && match[1] ? match[1].replace(/{[^}]*}/g, "") : null;
    })
    .filter(Boolean)
    .join("\n");
}

function detectSubtitleFormat(text) {
  if (!text) return "unknown";
  const head = text.substring(0, 200);
  if (text.trim().startsWith("WEBVTT")) return "vtt";
  if (text.includes("-->") && /^\d+[\r\n\s]*\d{2}:\d{2}:\d{2}/.test(head)) return "srt";
  if (/\[\d{2}:\d{2}[,.]\d{2,3}\]/.test(head)) return "lrc";
  if (text.toLowerCase().includes("dialogue:")) return "ass";
  return "unknown";
}

function processSubtitle(text, format) {
  switch (format) {
    case "vtt":
      return processVtt(text);
    case "srt":
      return processSrt(text);
    case "lrc":
      return processLrc(text);
    case "ass":
      return processAss(text);
    default:
      return "未知或不支持的格式";
  }
}

// --- 懒加载 JSZip ---
let JSZipRef = null;
async function ensureJSZip() {
  if (JSZipRef && typeof JSZipRef === "function") return true;
  await lazyLoadScript(
    "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
    () => {
      try {
        return !!window.JSZip;
      } catch {
        return false;
      }
    },
    { timeout: 12000, attrs: { crossorigin: "anonymous" } }
  );
  JSZipRef = window.JSZip;
  return !!JSZipRef;
}

// --- 批量处理状态 ---
let batchFiles = []; // [{ originalName, newName, content }]

// --- UI 绑定 ---
export function init() {
  // 单文本
  const pasteInput = document.getElementById("subtitle-paste-input");
  const pasteOutput = document.getElementById("subtitle-paste-output");
  const pasteProcessBtn = document.getElementById("subtitle-paste-process-btn");
  const pasteCopyBtn = document.getElementById("subtitle-paste-copy-btn");
  const pasteTooltip = document.getElementById("subtitle-paste-tooltip");

  // 批量
  const filesInput = document.getElementById("subtitle-files-input");
  const folderInput = document.getElementById("subtitle-folder-input");
  const resultsContainer = document.getElementById("subtitle-results-container");
  const resultsStatus = document.getElementById("subtitle-results-status");
  const downloadZipBtn = document.getElementById("subtitle-download-zip-btn");
  const clearBtn = document.getElementById("subtitle-clear-btn");

  // 防御
  if (!resultsContainer || !resultsStatus || !downloadZipBtn || !clearBtn) {
    console.warn("Subtitle tool DOM 未就绪，跳过初始化");
    return;
  }

  // 单文本处理
  if (pasteProcessBtn && pasteInput && pasteOutput) {
    pasteProcessBtn.addEventListener(
      "click",
      () => {
        const text = pasteInput.value ?? "";
        const fmt = detectSubtitleFormat(text);
        pasteOutput.value = processSubtitle(text, fmt);
      },
      { passive: true }
    );
  }
  if (pasteCopyBtn && pasteOutput && pasteTooltip) {
    pasteCopyBtn.addEventListener(
      "click",
      () => copyWithTooltip(pasteOutput.value, pasteTooltip),
      { passive: true }
    );
  }

  // 批量文件处理
  async function handleFiles(fileList) {
    if (!fileList || !fileList.length) return;
    batchFiles = [];
    resultsContainer.innerHTML = "";
    resultsStatus.textContent = `正在处理 ${fileList.length} 个文件...`;
    downloadZipBtn.disabled = true;

    const promises = Array.from(fileList).map((file) => {
      return new Promise((resolve) => {
        const extension = file.name.split(".").pop().toLowerCase();
        if (!["srt", "lrc", "ass", "ssa", "vtt"].includes(extension)) {
          resolve({ originalName: file.name, error: "不支持的文件类型" });
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = String(e.target.result);
          const format = extension === "vtt" ? "vtt" : extension.startsWith("ss") ? "ass" : extension;
          const processedContent = processSubtitle(content, format);
          resolve({
            originalName: file.name,
            newName: file.name.replace(/\.[^/.]+$/, "") + "_cleaned.txt",
            content: processedContent,
          });
        };
        reader.onerror = () => resolve({ originalName: file.name, error: "文件读取失败" });
        reader.readAsText(file, "UTF-8");
      });
    });

    const results = await Promise.all(promises);
    batchFiles = results.filter((r) => !r.error);

    resultsStatus.textContent = `已处理 ${results.length} / ${fileList.length} 个文件。`;
    resultsContainer.innerHTML = "";

    results.forEach((result) => {
      const row = document.createElement("div");
      row.className = "flex justify-between items-center p-2 rounded text-sm";

      const nameEl = document.createElement("span");
      nameEl.className = "truncate pr-4";
      nameEl.textContent = result.originalName;
      row.appendChild(nameEl);

      const status = document.createElement("div");
      status.className = "flex items-center gap-2 flex-shrink-0";

      if (result.error) {
        row.classList.add("bg-red-100", "text-red-700");
        const errorEl = document.createElement("span");
        errorEl.className = "font-medium";
        errorEl.textContent = result.error;
        status.appendChild(errorEl);
      } else {
        row.classList.add("bg-green-100", "text-green-700");
        const okEl = document.createElement("span");
        okEl.className = "font-medium";
        okEl.textContent = "成功";
        status.appendChild(okEl);

        const downloadBtn = document.createElement("button");
        downloadBtn.className = "p-1 rounded-full hover:bg-green-200 transition-colors";
        downloadBtn.title = `下载 ${result.newName}`;
        downloadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        downloadBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const blob = new Blob([result.content], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.download = result.newName;
          a.href = url;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
        status.appendChild(downloadBtn);
      }

      row.appendChild(status);
      resultsContainer.appendChild(row);
    });

    if (batchFiles.length > 0) {
      downloadZipBtn.disabled = false;
    }
  }

  if (filesInput) {
    filesInput.addEventListener("change", (e) => handleFiles(e.target.files), { passive: true });
  }
  if (folderInput) {
    folderInput.addEventListener("change", (e) => handleFiles(e.target.files), { passive: true });
  }

  // 下载 ZIP
  downloadZipBtn.addEventListener(
    "click",
    async () => {
      if (!batchFiles.length) return;
      const ok = await ensureJSZip();
      if (!ok) {
        alert("压缩库未就绪，请检查网络或稍后重试");
        return;
      }
      const zip = new JSZipRef();
      batchFiles.forEach((f) => zip.file(f.newName, f.content));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = "subtitles_cleaned.zip";
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    { passive: true }
  );

  // 清空列表
  clearBtn.addEventListener(
    "click",
    () => {
      batchFiles = [];
      resultsContainer.innerHTML = '<p class="text-gray-400 text-center pt-8">请上传文件或文件夹...</p>';
      resultsStatus.textContent = "处理结果";
      downloadZipBtn.disabled = true;
      if (filesInput) filesInput.value = "";
      if (folderInput) folderInput.value = "";
    },
    { passive: true }
  );
}