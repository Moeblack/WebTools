// 动态脚本加载工具：支持 UMD 脚本懒加载与就绪检测，带缓存与幂等保证
// 用法：
//   import { lazyLoadScript, waitForGlobal } from "../utils/lazyLoad.js";
//   await lazyLoadScript("https://cdn.example.com/lib.min.js", () => !!window.Lib);
//   // 或仅等待全局对象：
//   await waitForGlobal(() => !!window.Lib, 4000);

/** 已加载 URL 集合，避免重复注入 */
const loadedScripts = new Set();

/**
 * 注入外部脚本并等待就绪
 * @param {string} url 外部脚本 URL
 * @param {() => boolean} isReady 检测脚本是否就绪的函数，返回 true 表示可用
 * @param {{timeout?: number, attrs?: Record<string,string>}} options 选项：超时毫秒数与 script 属性
 * @returns {Promise<void>}
 */
export async function lazyLoadScript(url, isReady, options = {}) {
  const timeout = Number(options.timeout ?? 10000);
  const attrs = options.attrs ?? {};

  if (typeof isReady === "function") {
    // 若已就绪，无需加载
    try {
      if (isReady()) return;
    } catch (_) {
      // 继续加载
    }
  }

  if (loadedScripts.has(url)) {
    // 已注入过，等待就绪
    await waitForGlobal(isReady, timeout);
    return;
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    Object.entries(attrs).forEach(([k, v]) => {
      try {
        script.setAttribute(k, v);
      } catch (_) {}
    });

    script.onload = () => {
      loadedScripts.add(url);
      resolve();
    };
    script.onerror = (e) => {
      reject(new Error(`脚本加载失败: ${url}`));
    };
    document.head.appendChild(script);
  });

  await waitForGlobal(isReady, timeout);
}

/**
 * 轮询等待某个全局条件就绪
 * @param {() => boolean} check 函数，返回 true 表示就绪
 * @param {number} timeoutMs 超时时间，默认 8000ms
 * @returns {Promise<void>}
 */
export function waitForGlobal(check, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function tick() {
      try {
        if (typeof check === "function" && check()) {
          resolve();
          return;
        }
      } catch (_) {
        // ignore
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("等待全局对象就绪超时"));
        return;
      }
      setTimeout(tick, 200);
    }
    tick();
  });
}

/**
 * 简单的全局检测器：从多个可能的命名空间中寻找构造器
 * @param {string[]} chain 例如 ["OpenCC", "Converter"] 表示 window.OpenCC.Converter
 * @returns {() => boolean}
 */
export function globalChainReady(chain) {
  return () => {
    try {
      let curr = window;
      for (const key of chain) {
        curr = curr?.[key];
        if (!curr) return false;
      }
      // 若最后是函数或对象即认为就绪
      return typeof curr === "function" || typeof curr === "object";
    } catch {
      return false;
    }
  };
}