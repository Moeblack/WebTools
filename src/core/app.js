// 核心初始化：为各工具设置一次性懒初始化钩子，首次点击对应 Tab 或交互时再加载模块
// 依赖：由 src/main.js 以 initApp({ basePath }) 调用

import { loadTool } from "../main.js";

const onceFlags = new Map(); // 记录各工具是否已初始化

// 统一的工具 key 与 Tab/Button/容器的对应关系
// key 对应：tab-KEY 与 content-KEY 的 DOM
const TOOL_KEYS = [
  "subtitle",
  "cleanup",
  "joiner",
  "injector",
  "counter",
  "timestamp",
  "duration",
  "base64",
  "escape",
  "converter",
];

function $id(id) {
  return document.getElementById(id);
}

async function ensureToolInit(key) {
  if (onceFlags.get(key)) return;
  try {
    const mod = await loadTool(key);
    if (typeof mod?.init === "function") {
      // 约定每个工具模块导出 init()
      mod.init();
    }
    onceFlags.set(key, true);
  } catch (e) {
    // 不阻断 UI，记录错误即可
    console.warn(`加载工具模块失败: ${key}`, e);
  }
}

// 将懒初始化绑定到 Tab 点击上；并在默认 Tab 激活时也初始化一次
function bindLazyInit() {
  TOOL_KEYS.forEach((key) => {
    const tabEl = $id(`tab-${key}`);
    if (!tabEl) return;
    tabEl.addEventListener(
      "click",
      () => {
        ensureToolInit(key);
      },
      { passive: true }
    );
  });

  // 默认选中的 Tab 元素带有 .tab-active，尝试找出并初始化
  try {
    const activeTab = document.querySelector("nav [id^='tab-'].tab-active");
    if (activeTab && activeTab.id?.startsWith("tab-")) {
      const key = activeTab.id.replace("tab-", "");
      if (TOOL_KEYS.includes(key)) ensureToolInit(key);
    } else {
      // 若没有找到，按约定默认初始化 subtitle
      ensureToolInit("subtitle");
    }
  } catch (_) {
    // 忽略
  }
}

export function initApp({ basePath }) {
  // 目前 basePath 仅用于 SW 等；保留以便后续扩展
  void basePath;

  // 绑定懒加载逻辑
  bindLazyInit();

  // 这里可以添加通用的全局增强：例如全局快捷键、A11y 改进等
  // ...可按需扩展
}