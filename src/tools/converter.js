// 简繁转换工具模块（懒加载 OpenCC UMD）
// 页面依赖 DOM：converter-input, converter-output, converter-t2s-btn, converter-s2t-btn,
// converter-copy-btn, converter-convert-quotes, converter-copy-tooltip
//
// 说明：使用 opencc-js UMD 版本的完整构建，通过懒加载降低首屏体积。
// CDN: https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/full.js

import { copyWithTooltip } from "../utils/clipboard.js";
import { lazyLoadScript, globalChainReady } from "../utils/lazyLoad.js";

// OpenCC UMD 就绪检测：多种可能的命名空间
const OPENCC_READY = () => {
  try {
    const g = window || {};
    // 常见导出形态
    if (g.OpenCC && typeof g.OpenCC.Converter === "function") return true;
    if (g.opencc && typeof g.opencc.Converter === "function") return true;
    if (g.OpenCCJS && typeof g.OpenCCJS.Converter === "function") return true;
    if (g.OpenCC && g.OpenCC.default && typeof g.OpenCC.default.Converter === "function") return true;
  } catch (_) {}
  return false;
};

function getOpenCC() {
  try {
    const g = window || {};
    if (g.OpenCC && typeof g.OpenCC.Converter === "function") return g.OpenCC;
    if (g.opencc && typeof g.opencc.Converter === "function") return g.opencc;
    if (g.OpenCCJS && typeof g.OpenCCJS.Converter === "function") return g.OpenCCJS;
    if (g.OpenCC && g.OpenCC.default && typeof g.OpenCC.default.Converter === "function") return g.OpenCC.default;
  } catch (_) {}
  return null;
}

// 引号转换：『』 -> 【】
function convertQuotes(text) {
  return String(text ?? "").replace(/『/g, "【").replace(/』/g, "】");
}

// 懒加载并获取转换器
let t2sConverter = null; // 繁 -> 简
let s2tConverter = null; // 简 -> 繁

async function ensureConverters() {
  if (t2sConverter && s2tConverter) return true;

  // 懒加载 UMD
  await lazyLoadScript(
    "https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/full.js",
    OPENCC_READY,
    { timeout: 12000, attrs: { crossorigin: "anonymous" } }
  );

  const OC = getOpenCC();
  if (!OC) return false;

  try {
    if (!t2sConverter) t2sConverter = OC.Converter({ from: "tw", to: "cn" });
    if (!s2tConverter) s2tConverter = OC.Converter({ from: "cn", to: "tw" });
    return true;
  } catch (e) {
    console.warn("创建 OpenCC 转换器失败：", e);
    return false;
  }
}

export function init() {
  const input = document.getElementById("converter-input");
  const output = document.getElementById("converter-output");
  const t2sBtn = document.getElementById("converter-t2s-btn");
  const s2tBtn = document.getElementById("converter-s2t-btn");
  const copyBtn = document.getElementById("converter-copy-btn");
  const quotesCheckbox = document.getElementById("converter-convert-quotes");
  const tooltip = document.getElementById("converter-copy-tooltip");

  if (!input || !output || !t2sBtn || !s2tBtn || !copyBtn) {
    console.warn("Converter tool DOM 未就绪，跳过初始化");
    return;
  }

  // 初始禁用，点击时再启用或提示加载
  const setEnabled = (enabled) => {
    try {
      t2sBtn.disabled = !enabled;
      s2tBtn.disabled = !enabled;
      t2sBtn.textContent = enabled ? "繁体 → 简体" : "繁体 → 简体 (加载中)";
      s2tBtn.textContent = enabled ? "简体 → 繁体" : "简体 → 繁体 (加载中)";
    } catch (_) {}
  };
  setEnabled(false);

  async function convertHandler(direction) {
    const text = input.value ?? "";
    const ready = await ensureConverters();
    if (!ready) {
      alert("简繁词库未就绪，请检查网络或稍后重试");
      return;
    }
    let result =
      direction === "t2s" ? t2sConverter(text) : s2tConverter(text);
    if (quotesCheckbox && quotesCheckbox.checked) {
      result = convertQuotes(result);
    }
    output.value = result;
  }

  t2sBtn.addEventListener("click", () => convertHandler("t2s"), { passive: true });
  s2tBtn.addEventListener("click", () => convertHandler("s2t"), { passive: true });

  copyBtn.addEventListener("click", () => copyWithTooltip(output.value, tooltip), { passive: true });

  // 后台探测并启用按钮
  (async () => {
    try {
      const ok = await ensureConverters();
      setEnabled(ok);
    } catch {
      // 失败时仍延迟启用，让用户点击时再加载
      setEnabled(true);
    }
    // Fail-open：若网络慢，数秒后仍未就绪，也启用按钮，点击时再进行加载
    setTimeout(() => setEnabled(true), 4000);
  })();
}