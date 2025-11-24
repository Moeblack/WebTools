// 字幕处理逻辑：提供纯函数供 Vue 组件复用，并按需懒加载 JSZip
// CDN: https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js

import { lazyLoadScript } from "../utils/lazyLoad.js";

const HTML_TAG_REGEX = /<[^>]*>/g;
const ASS_TAG_REGEX = /{[^}]*}/g;
const ASS_LINEBREAK_REGEX = /\\[Nn]/g;
const TIME_RANGE_REGEX = /^\s*(?:\d{2}:){1,2}\d{2}[,.]\d{2,3}\s*-->\s*(?:\d{2}:){1,2}\d{2}[,.]\d{2,3}.*$/gm;
const SRT_INDEX_REGEX = /^\s*\d+\s*$/gm;
const VTT_BLOCK_REGEX = /^\s*(NOTE|STYLE|REGION)[^\n]*[\s\S]*?(?=\n{2,}|\s*$)/gim;
const LRC_METADATA_REGEX = /^\s*\[[a-z]{2,}:[^\]]*]\s*$/gim;
const LRC_TIMESTAMP_REGEX = /\[(?:\d{1,2}:){1,2}\d{2}(?:[.,]\d{2,3})?]/gi;

function normalizeInput(text) {
  return text.replace(/\uFEFF/g, "").replace(/\r\n?/g, "\n");
}

function stripHtml(text) {
  return text.replace(HTML_TAG_REGEX, "");
}

function finalizeOutput(text) {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function genericSubtitleCleanup(text) {
  if (!text) return "";
  const normalized = normalizeInput(text);
  const withoutMeta = normalized
    .replace(SRT_INDEX_REGEX, "")
    .replace(TIME_RANGE_REGEX, "")
    .replace(VTT_BLOCK_REGEX, "")
    .replace(LRC_METADATA_REGEX, "")
    .replace(LRC_TIMESTAMP_REGEX, "");
  return finalizeOutput(stripHtml(withoutMeta));
}

function processSrt(text) {
  if (!text) return "";
  const normalized = normalizeInput(text);
  const blocks = normalized.split(/\n{2,}/);
  const cleaned = blocks
    .map((block) => {
      const trimmed = block.replace(SRT_INDEX_REGEX, "").replace(TIME_RANGE_REGEX, "");
      return finalizeOutput(stripHtml(trimmed));
    })
    .filter(Boolean);
  return cleaned.join("\n\n");
}

function processVtt(text) {
  if (!text) return "";
  const normalized = normalizeInput(text).replace(/^WEBVTT[^\n]*\n?/, "");
  const withoutMeta = normalized.replace(VTT_BLOCK_REGEX, "");
  const blocks = withoutMeta.split(/\n{2,}/);
  const cleaned = blocks
    .map((block) => {
      const trimmed = block.replace(TIME_RANGE_REGEX, "");
      return finalizeOutput(stripHtml(trimmed));
    })
    .filter(Boolean);
  return cleaned.join("\n\n");
}

function processLrc(text) {
  if (!text) return "";
  const normalized = normalizeInput(text);
  return finalizeOutput(
    normalized
      .replace(LRC_METADATA_REGEX, "")
      .split("\n")
      .map((line) => line.replace(LRC_TIMESTAMP_REGEX, "").trim())
      .filter(Boolean)
      .join("\n")
  );
}

function processAss(text) {
  if (!text) return "";
  const dialogueRegex = /^Dialogue:\s*[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,([\s\S]*)/i;
  const lines = normalizeInput(text)
    .split("\n")
    .map((line) => {
      const match = line.match(dialogueRegex);
      if (!match || !match[1]) return null;
      return match[1].replace(ASS_TAG_REGEX, "").replace(ASS_LINEBREAK_REGEX, "\n");
    })
    .filter(Boolean);
  return finalizeOutput(lines.join("\n"));
}

export function detectSubtitleFormat(text) {
  if (!text) return "unknown";
  const normalized = normalizeInput(text);
  if (/^WEBVTT(?:\s|$)/i.test(normalized)) return "vtt";
  if (/^\s*\d+\s*\n\s*(?:\d{2}:){1,2}\d{2}[,.]\d{2,3}\s*-->/m.test(normalized)) return "srt";
  if (/^\s*Dialogue:/im.test(normalized)) return "ass";
  if (/\[(?:\d{1,2}:){1,2}\d{2}(?:[.,]\d{2,3})?]/.test(normalized)) return "lrc";
  return "unknown";
}

export function processSubtitle(text, format) {
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
      return genericSubtitleCleanup(text);
  }
}

export function processSubtitleText(text) {
  const format = detectSubtitleFormat(text);
  return {
    format,
    output: processSubtitle(text, format),
  };
}

let JSZipRef = null;
export async function ensureJSZip() {
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

export function processSubtitleFile(file) {
  return new Promise((resolve) => {
    const extension = file.name.split(".").pop().toLowerCase();
    if (!["srt", "lrc", "ass", "ssa", "vtt"].includes(extension)) {
      resolve({ originalName: file.name, error: "不支持的文件类型" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = String(e.target.result || "");
        const detectedFormat = detectSubtitleFormat(content);
        const format =
          detectedFormat !== "unknown" ? detectedFormat : extension === "vtt" ? "vtt" : extension.startsWith("ss") ? "ass" : extension;
        const processedContent = processSubtitle(content, format);
        if (!processedContent) {
          resolve({ originalName: file.name, error: "未识别到有效的字幕文本", format });
          return;
        }
        resolve({
          originalName: file.name,
          newName: file.name.replace(/\.[^/.]+$/, "") + "_cleaned.txt",
          content: processedContent,
          format,
        });
      } catch (err) {
        resolve({ originalName: file.name, error: "处理失败，请稍后重试" });
      }
    };
    reader.onerror = () => resolve({ originalName: file.name, error: "文件读取失败" });
    reader.readAsText(file, "UTF-8");
  });
}

export async function generateZipFromResults(results) {
  if (!Array.isArray(results) || !results.length) {
    throw new Error("没有可压缩的结果");
  }
  const ok = await ensureJSZip();
  if (!ok) throw new Error("压缩库未就绪");
  const zip = new JSZipRef();
  results.forEach((item, idx) => {
    const name = item?.newName || `result-${idx + 1}.txt`;
    zip.file(name, item?.content ?? "");
  });
  return zip.generateAsync({ type: "blob" });
}
