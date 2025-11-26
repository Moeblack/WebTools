import { copyText } from "../utils/clipboard.js";
import { useToast } from "./useToast.js";

export function useClipboard() {
  const { showToast } = useToast();

  async function copyValue(value) {
    if (value === undefined || value === null || value === "") {
      showToast("没有可复制的内容", "warning");
      return false;
    }
    const ok = await copyText(value);
    showToast(ok ? "已复制到剪贴板" : "复制失败，请允许剪贴板权限", ok ? "success" : "error");
    return ok;
  }

  return {
    copyValue,
  };
}
