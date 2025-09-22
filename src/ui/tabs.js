// 简单 Tab 控制模块：切换激活样式与内容可见性
// 依赖：页面中存在 id=tab-*, id=content-* 成对元素
const tabs = {
  subtitle: document.getElementById("tab-subtitle"),
  cleanup: document.getElementById("tab-cleanup"),
  joiner: document.getElementById("tab-joiner"),
  injector: document.getElementById("tab-injector"),
  counter: document.getElementById("tab-counter"),
  timestamp: document.getElementById("tab-timestamp"),
  duration: document.getElementById("tab-duration"),
  base64: document.getElementById("tab-base64"),
  escape: document.getElementById("tab-escape"),
  converter: document.getElementById("tab-converter"),
};

const contents = {
  subtitle: document.getElementById("content-subtitle"),
  cleanup: document.getElementById("content-cleanup"),
  joiner: document.getElementById("content-joiner"),
  injector: document.getElementById("content-injector"),
  counter: document.getElementById("content-counter"),
  timestamp: document.getElementById("content-timestamp"),
  duration: document.getElementById("content-duration"),
  base64: document.getElementById("content-base64"),
  escape: document.getElementById("content-escape"),
  converter: document.getElementById("content-converter"),
};

function switchTab(activeKey) {
  try {
    console.debug("[tabs] switchTab ->", activeKey);
    Object.keys(tabs).forEach((key) => {
      const tabEl = tabs[key];
      const contentEl = contents[key];

      if (!tabEl || !contentEl) {
        console.warn("[tabs] 缺少元素：", { key, hasTab: !!tabEl, hasContent: !!contentEl });
        return;
      }

      const isActive = key === activeKey;
      // 按样式切换
      tabEl.classList.toggle("tab-active", isActive);
      tabEl.classList.toggle("text-gray-500", !isActive);
      tabEl.classList.toggle("border-gray-200", !isActive);

      // 可见性切换
      contentEl.classList.toggle("hidden", !isActive);

      // A11y
      if (isActive && tabEl?.setAttribute) {
        tabEl.setAttribute("aria-selected", "true");
      } else if (tabEl?.removeAttribute) {
        tabEl.removeAttribute("aria-selected");
      }
    });
  } catch (e) {
    console.warn("切换 Tab 失败：", e);
  }
}

export function initTabs(defaultKey = "subtitle") {
  try {
    Object.keys(tabs).forEach((key) => {
      const tabEl = tabs[key];
      if (!tabEl) return;
      tabEl.addEventListener("click", () => switchTab(key), { passive: true });
    });
    // 默认选中
    switchTab(defaultKey);
  } catch (e) {
    console.warn("初始化 Tabs 失败：", e);
  }
}