<template>
  <div class="app-shell">
    <AppHeader />

    <main class="workspace section-card">
      <AppTabs :tabs="tabs" v-model="activeTab" />

      <SubtitleTool v-show="activeTab === 'subtitle'" />
      <CleanupTool v-show="activeTab === 'cleanup'" />
      <JoinerTool v-show="activeTab === 'joiner'" />
      <InjectorTool v-show="activeTab === 'injector'" />
      <CounterTool v-show="activeTab === 'counter'" />
      <TimestampTool v-show="activeTab === 'timestamp'" />
      <DurationTool v-show="activeTab === 'duration'" />
      <Base64Tool v-show="activeTab === 'base64'" />
      <EscapeTool v-show="activeTab === 'escape'" />
      <ConverterTool v-show="activeTab === 'converter'" />
      <PaletteTool v-show="activeTab === 'palette'" />
      <GifSpriteTool v-show="activeTab === 'gifSprite'" />
      <SpriteGifTool v-show="activeTab === 'spriteGif'" />
    </main>

    <AppFooter />
    <AppToast />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from "vue";

// Common components
import AppHeader from "./components/common/AppHeader.vue";
import AppFooter from "./components/common/AppFooter.vue";
import AppTabs from "./components/common/AppTabs.vue";
import AppToast from "./components/common/AppToast.vue";

// Tool components
import SubtitleTool from "./components/tools/SubtitleTool.vue";
import CleanupTool from "./components/tools/CleanupTool.vue";
import JoinerTool from "./components/tools/JoinerTool.vue";
import InjectorTool from "./components/tools/InjectorTool.vue";
import CounterTool from "./components/tools/CounterTool.vue";
import TimestampTool from "./components/tools/TimestampTool.vue";
import DurationTool from "./components/tools/DurationTool.vue";
import Base64Tool from "./components/tools/Base64Tool.vue";
import EscapeTool from "./components/tools/EscapeTool.vue";
import ConverterTool from "./components/tools/ConverterTool.vue";
import PaletteTool from "./components/tools/PaletteTool.vue";
import GifSpriteTool from "./components/tools/GifSpriteTool.vue";
import SpriteGifTool from "./components/tools/SpriteGifTool.vue";

const tabs = [
  { key: "subtitle", label: "字幕工具" },
  { key: "cleanup", label: "文本清理" },
  { key: "joiner", label: "文本拼接" },
  { key: "injector", label: "文本加料" },
  { key: "counter", label: "字数统计" },
  { key: "timestamp", label: "时间戳转换" },
  { key: "duration", label: "时间段转换" },
  { key: "base64", label: "Base64" },
  { key: "escape", label: "文本转义" },
  { key: "converter", label: "简繁转换" },
  { key: "palette", label: "调色盘" },
  { key: "gifSprite", label: "GIF 转精灵图" },
  { key: "spriteGif", label: "精灵图转GIF" },
];

const activeTab = ref("subtitle");

// Service Worker registration
const IS_FILE = typeof location !== "undefined" && location.protocol === "file:";

async function registerServiceWorker() {
  if (IS_FILE) return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register(`./sw.js`, { scope: "./" });
    if (reg && reg.addEventListener) {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {});
      });
    }
  } catch (err) {
    console.warn("ServiceWorker 注册失败：", err);
  }
}

onMounted(() => {
  registerServiceWorker();
});
</script>
