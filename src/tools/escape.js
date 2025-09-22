// 文本转义工具模块：字符串 ⇄ 十六进制转义序列
// 页面依赖 DOM：
// escape-input, escape-output, escape-error
// escape-copy-btn, escape-download-btn, escape-copy-tooltip
// escape-convert-btn
// escape-source-text, escape-source-bytes
// escape-encoding [utf8, latin1]
// escape-out-python, escape-out-plain
// escape-hexcase [lower, upper]
// escape-outmode-group, escape-hexcase-group
//
// 功能要点：
// - 源类型自动检测：字符串 或 字节字面量/转义（b'..' 或 \x.. 连续）
// - 编码：UTF-8 与 Latin-1
// - 输出模式：Python 字节字面量 b'\x..' 或连续 \x..
// - 复制与下载
//
// 注意：该实现移植并简化了旧版本的逻辑，保持行为一致

import { copyWithTooltip } from "../utils/clipboard.js";

// --- 编码/解码工具 ---

function encodeUtf8(str) {
  return new Uint8Array(new TextEncoder().encode(str));
}
function decodeUtf8(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (e) {
    throw new Error("UTF-8 解码失败：字节序列无效");
  }
}
function encodeLatin1(str) {
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code > 0xff) {
      throw new Error("Latin-1 编码失败：存在超出 0xFF 的字符");
    }
    arr[i] = code & 0xff;
  }
  return arr;
}
function decodeLatin1(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

// --- 字节序列 ⇄ \xNN ---

function bytesToHexEscapes(bytes, hexCase = "lower") {
  const hex = [];
  const toHex = (n) => n.toString(16).padStart(2, "0");
  for (let i = 0; i < bytes.length; i++) {
    const h = toHex(bytes[i]);
    hex.push("\\x" + (hexCase === "upper" ? h.toUpperCase() : h));
  }
  return hex.join("");
}

function wrapAsPythonBytesLiteral(escapes) {
  return "b'" + escapes.replace(/'/g, "\\'") + "'";
}

// 解析 b'..' 或 \x.. 为字节数组，支持常见转义
function parseByteLiteralOrHexEscapes(input) {
  let s = String(input || "").trim();

  // 可选的 Python bytes 字面量封装
  if ((s.startsWith("b'") || s.startsWith("B'")) && s.endsWith("'")) {
    s = s.slice(2, -1);
  } else if ((s.startsWith('b"') || s.startsWith('B"')) && s.endsWith('"')) {
    s = s.slice(2, -1);
  } else {
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
      s = s.slice(1, -1);
    }
  }

  const out = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "\\") {
      const code = s.charCodeAt(i);
      if (code <= 0x7f) {
        out.push(code);
      } else {
        // 容错：非 ASCII 截断至 0xFF
        out.push(code & 0xff);
      }
      continue;
    }
    i++;
    if (i >= s.length) throw new Error("转义序列不完整：末尾出现单独的反斜杠");
    const e = s[i];
    switch (e) {
      case "n":
        out.push(0x0a);
        break;
      case "r":
        out.push(0x0d);
        break;
      case "t":
        out.push(0x09);
        break;
      case "\\":
        out.push(0x5c);
        break;
      case "'":
        out.push(0x27);
        break;
      case '"':
        out.push(0x22);
        break;
      case "0":
        out.push(0x00);
        break;
      case "x": {
        if (i + 2 >= s.length) throw new Error("十六进制转义不完整：\\x 后需两位十六进制");
        const h1 = s[i + 1],
          h2 = s[i + 2];
        const hex = h1 + h2;
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
          throw new Error("无效的十六进制转义：\\x" + hex);
        }
        out.push(parseInt(hex, 16));
        i += 2;
        break;
      }
      default:
        // 未知转义，按字面字符处理
        out.push(e.charCodeAt(0));
        break;
    }
  }
  return new Uint8Array(out);
}

// 源类型检测：字符串 vs 字节字面量/转义
function detectSourceMode(text) {
  if (!text) return "text";
  const s = String(text).trim();
  const isBytesLiteral =
    ((s.startsWith("b'") || s.startsWith("B'")) && s.endsWith("'")) ||
    ((s.startsWith('b"') || s.startsWith('B"')) && s.endsWith('"'));
  const hasHexEsc = /\\x[0-9a-fA-F]{2}/.test(s);
  const compact = s.replace(/\s+/g, "");
  const mostlyHex = /^\\x[0-9a-fA-F]{2}(\\x[0-9a-fA-F]{2})+$/i.test(compact);
  return isBytesLiteral || hasHexEsc || mostlyHex ? "bytes" : "text";
}

// UI 辅助：根据源模式调整可用控件
function refreshUiState({ sourceText, sourceBytes, outmodeGroup, hexcaseGroup }) {
  const isText = sourceText && sourceText.checked;
  [outmodeGroup, hexcaseGroup].forEach((el) => {
    if (!el) return;
    if (isText) el.classList.remove("opacity-50");
    else el.classList.add("opacity-50");
  });
}

// 主转换逻辑
function convert({ inputEl, outputEl, errorEl, sourceText, sourceBytes, encodingEl, outPython, outPlain, hexCaseEl }) {
  const setErr = (msg) => {
    if (!errorEl) return;
    if (!msg) {
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
    } else {
      errorEl.classList.remove("hidden");
      errorEl.textContent = msg;
    }
  };

  setErr("");
  const sourceIsText = sourceText && sourceText.checked;
  const enc = (encodingEl && encodingEl.value) || "utf8";
  const hexCase = hexCaseEl ? hexCaseEl.value : "lower";

  try {
    if (sourceIsText) {
      const input = inputEl.value || "";
      let bytes;
      if (enc === "utf8") bytes = encodeUtf8(input);
      else bytes = encodeLatin1(input);

      const escapes = bytesToHexEscapes(bytes, hexCase);
      const out = outPython && outPython.checked ? wrapAsPythonBytesLiteral(escapes) : escapes;
      outputEl.value = out;
    } else {
      const input = inputEl.value || "";
      const bytes = parseByteLiteralOrHexEscapes(input);
      let text;
      if (enc === "utf8") text = decodeUtf8(bytes);
      else text = decodeLatin1(bytes);
      outputEl.value = text;
    }
  } catch (e) {
    setErr(e.message || String(e));
    outputEl.value = "";
  }
}

export function init() {
  const inputEl = document.getElementById("escape-input");
  const outputEl = document.getElementById("escape-output");
  const errorEl = document.getElementById("escape-error");

  const copyBtn = document.getElementById("escape-copy-btn");
  const downloadBtn = document.getElementById("escape-download-btn");
  const tooltip = document.getElementById("escape-copy-tooltip");

  const convertBtn = document.getElementById("escape-convert-btn");

  const sourceText = document.getElementById("escape-source-text");
  const sourceBytes = document.getElementById("escape-source-bytes");
  const encodingEl = document.getElementById("escape-encoding");
  const outPython = document.getElementById("escape-out-python");
  const outPlain = document.getElementById("escape-out-plain");
  const hexCaseEl = document.getElementById("escape-hexcase");
  const outmodeGroup = document.getElementById("escape-outmode-group");
  const hexcaseGroup = document.getElementById("escape-hexcase-group");

  if (!inputEl || !outputEl || !convertBtn || !copyBtn || !downloadBtn) {
    console.warn("Escape tool DOM 未就绪，跳过初始化");
    return;
  }

  // 初次根据文本自动检测源模式
  const autoDetect = () => {
    try {
      const mode = detectSourceMode(inputEl.value || "");
      if (sourceText && sourceBytes) {
        if (mode === "bytes") {
          sourceBytes.checked = true;
          sourceText.checked = false;
        } else {
          sourceText.checked = true;
          sourceBytes.checked = false;
        }
      }
      // 清除错误并刷新 UI
      if (errorEl) {
        errorEl.classList.add("hidden");
        errorEl.textContent = "";
      }
      refreshUiState({ sourceText, sourceBytes, outmodeGroup, hexcaseGroup });
    } catch (_) {}
  };

  inputEl.addEventListener("input", autoDetect, { passive: true });
  autoDetect();

  // 源模式切换时刷新 UI
  if (sourceText && sourceBytes) {
    sourceText.addEventListener("change", () => refreshUiState({ sourceText, sourceBytes, outmodeGroup, hexcaseGroup }), { passive: true });
    sourceBytes.addEventListener("change", () => refreshUiState({ sourceText, sourceBytes, outmodeGroup, hexcaseGroup }), { passive: true });
    refreshUiState({ sourceText, sourceBytes, outmodeGroup, hexcaseGroup });
  }

  // 点击转换
  convertBtn.addEventListener(
    "click",
    () =>
      convert({
        inputEl,
        outputEl,
        errorEl,
        sourceText,
        sourceBytes,
        encodingEl,
        outPython,
        outPlain,
        hexCaseEl,
      }),
    { passive: true }
  );

  // 复制输出
  copyBtn.addEventListener("click", () => copyWithTooltip(outputEl.value, tooltip), { passive: true });

  // 下载输出
  downloadBtn.addEventListener(
    "click",
    () => {
      const val = outputEl.value || "";
      if (!val) return;
      const blob = new Blob([val], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = "escaped_text.txt";
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    { passive: true }
  );
}