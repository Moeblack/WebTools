// 简繁转换逻辑（懒加载 opencc-js UMD）

import { lazyLoadScript } from "../utils/lazyLoad.js";

const OPENCC_URL = "https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/full.js";

const OPENCC_READY = () => {
  try {
    const g = window || {};
    if (g.OpenCC && typeof g.OpenCC.Converter === "function") return true;
    if (g.opencc && typeof g.opencc.Converter === "function") return true;
    if (g.OpenCCJS && typeof g.OpenCCJS.Converter === "function") return true;
    if (g.OpenCC && g.OpenCC.default && typeof g.OpenCC.default.Converter === "function") return true;
  } catch (_) {}
  return false;
};

function getOpenCC() {
  const g = window || {};
  if (g.OpenCC && typeof g.OpenCC.Converter === "function") return g.OpenCC;
  if (g.opencc && typeof g.opencc.Converter === "function") return g.opencc;
  if (g.OpenCCJS && typeof g.OpenCCJS.Converter === "function") return g.OpenCCJS;
  if (g.OpenCC && g.OpenCC.default && typeof g.OpenCC.default.Converter === "function") return g.OpenCC.default;
  return null;
}

let t2sConverter = null;
let s2tConverter = null;

export async function ensureConverters() {
  if (t2sConverter && s2tConverter) return true;
  await lazyLoadScript(OPENCC_URL, OPENCC_READY, { timeout: 12000, attrs: { crossorigin: "anonymous" } });
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

export function convertQuotes(text) {
  return String(text ?? "").replace(/『/g, "【").replace(/』/g, "】");
}

export async function convertText(direction, text) {
  const ready = await ensureConverters();
  if (!ready) {
    throw new Error("简繁词库仍在加载，请稍后重试");
  }
  if (direction === "t2s") {
    return t2sConverter ? t2sConverter(text ?? "") : text ?? "";
  }
  return s2tConverter ? s2tConverter(text ?? "") : text ?? "";
}
