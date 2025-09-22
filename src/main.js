/* 入口模块：挂载事件、注册 Service Worker、初始化 Tab 与各工具的懒加载入口
   统一使用相对路径，兼容本地 HTTP/HTTPS 与 GitHub Pages 子路径；file:// 下跳过 SW */
const IS_FILE = typeof location !== "undefined" && location.protocol === "file:";

// 注册 Service Worker（作用域必须与仓库路径一致）
async function registerServiceWorker() {
  // file:// 协议不支持 Service Worker，直接跳过
  if (IS_FILE) return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register(`./sw.js`, { scope: "./" });
    // 可选：监听更新
    if (reg && reg.addEventListener) {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          // 这里可扩展：提示用户刷新以应用新版本
        });
      });
    }
  } catch (err) {
    // 仅记录，不打断主流程
    console.warn("ServiceWorker 注册失败：", err);
  }
}

// 安全选择器
function $(selector) {
  return document.querySelector(selector);
}

// 初始化 Tab 与页面
async function bootstrap() {
  // 引入 Tabs 控制与应用初始化（后续文件将逐步落地）
  try {
    const [{ initTabs }, { initApp }] = await Promise.all([
      import("./ui/tabs.js").catch(() => ({ initTabs: () => {} })),
      import("./core/app.js").catch(() => ({ initApp: () => {} })),
    ]);

    initTabs?.();
    // 统一传递相对路径，兼容本地/Pages
    initApp?.({
      basePath: "./",
    });
  } catch (e) {
    console.warn("初始化模块失败：", e);
  }

  // 懒注册 SW（不阻塞首屏）
  registerServiceWorker();

  // 绑定 favicon 和 manifest（若 index.html 已写入则此步无感，容错处理）
  try {
    let linkManifest = $('link[rel="manifest"]');
    if (!linkManifest) {
      linkManifest = document.createElement("link");
      linkManifest.rel = "manifest";
      linkManifest.href = `./manifest.webmanifest`;
      document.head.appendChild(linkManifest);
    }
  } catch (_) {
    // ignore
  }
}

// 暴露工具懒加载入口，供按钮回调时按需加载模块
export async function loadTool(name) {
  switch (name) {
    case "subtitle":
      return import("./tools/subtitle.js");
    case "cleanup":
      return import("./tools/cleanup.js");
    case "joiner":
      return import("./tools/joiner.js");
    case "injector":
      return import("./tools/injector.js");
    case "counter":
      return import("./tools/counter.js");
    case "timestamp":
      return import("./tools/timestamp.js");
    case "duration":
      return import("./tools/duration.js");
    case "base64":
      return import("./tools/base64.js");
    case "escape":
      return import("./tools/escape.js");
    case "converter":
      return import("./tools/converter.js");
    default:
      throw new Error("未知工具: " + String(name));
  }
}

// DOM Ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}