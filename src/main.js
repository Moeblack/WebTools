import { createApp } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { processSubtitleText, processSubtitleFile, generateZipFromResults } from "./tools/subtitle.js";
import { processCleanup } from "./tools/cleanup.js";
import { processJoiner } from "./tools/joiner.js";
import { processInjector } from "./tools/injector.js";
import { analyzeText } from "./tools/counter.js";
import { getCurrentTimestamp, timestampFromParts, partsFromTimestamp, formatParts } from "./tools/timestamp.js";
import { toTotalSeconds, fromTotalSeconds } from "./tools/duration.js";
import { base64Encode, base64Decode } from "./tools/base64.js";
import { convertEscapes, detectSourceMode } from "./tools/escape.js";
import { ensureConverters, convertText as convertOpenCC, convertQuotes } from "./tools/converter.js";
import { copyText } from "./utils/clipboard.js";

const TABS = [
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
];

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

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadText(filename, content) {
  const blob = new Blob([content || ""], { type: "text/plain;charset=utf-8" });
  downloadBlob(filename, blob);
}

const nowTs = getCurrentTimestamp();
const nowParts = partsFromTimestamp(nowTs) || {
  year: "",
  month: "",
  day: "",
  hour: "",
  minute: "",
  second: "",
};

const app = createApp({
  data() {
    return {
      tabs: TABS,
      activeTab: "subtitle",
      toast: { visible: false, message: "", type: "info" },
      toastTimer: null,
      subtitle: {
        pasteInput: "",
        pasteOutput: "",
        pasteFormat: "",
        batchResults: [],
        status: "请上传文件或文件夹...",
        isProcessing: false,
        downloadInProgress: false,
        fileInputKey: Date.now(),
      },
      cleanup: {
        input: "",
        output: "",
        removeMarkdown: true,
        removeEmptyLines: true,
      },
      joiner: {
        input: "",
        separator: "\\n",
        displayOutput: "",
        lastResult: "",
      },
      injector: {
        input: "",
        string: "",
        output: "",
      },
      counter: {
        input: "",
      },
      timestamp: {
        year: nowParts.year,
        month: nowParts.month,
        day: nowParts.day,
        hour: nowParts.hour,
        minute: nowParts.minute,
        second: nowParts.second,
        fromDate: "",
        fromTsInput: String(nowTs),
        fromTsOutput: formatParts(nowParts),
        current: nowTs,
      },
      timestampTicker: null,
      duration: {
        days: "0",
        hours: "0",
        minutes: "0",
        seconds: "0",
        totalSeconds: "0",
        outputs: { days: "0", hours: "0", minutes: "0", seconds: "0" },
      },
      base64: {
        input: "",
        output: "",
      },
      escape: {
        input: "",
        output: "",
        sourceMode: "text",
        encoding: "utf8",
        outputMode: "python",
        hexCase: "lower",
        error: "",
      },
      converter: {
        input: "",
        output: "",
        quotes: true,
        converting: false,
        ready: false,
      },
    };
  },
  computed: {
    counterStats() {
      return analyzeText(this.counter.input);
    },
    subtitleHasResults() {
      return this.subtitle.batchResults.some((item) => !item.error);
    },
  },
  methods: {
    async copyValue(value) {
      if (value === undefined || value === null || value === "") {
        this.showToast("没有可复制的内容", "warning");
        return;
      }
      const ok = await copyText(value);
      this.showToast(ok ? "已复制到剪贴板" : "复制失败，请允许剪贴板权限", ok ? "success" : "error");
    },
    showToast(message, type = "info") {
      this.toast.message = message;
      this.toast.type = type;
      this.toast.visible = true;
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.toast.visible = false;
      }, 2400);
    },
    processSubtitlePaste() {
      if (!this.subtitle.pasteInput) {
        this.subtitle.pasteOutput = "";
        this.subtitle.pasteFormat = "";
        return;
      }
      const { output, format } = processSubtitleText(this.subtitle.pasteInput);
      this.subtitle.pasteOutput = output;
      this.subtitle.pasteFormat = format;
    },
    async handleSubtitleFiles(fileList) {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      this.subtitle.isProcessing = true;
      this.subtitle.status = `正在处理 ${files.length} 个文件...`;
      this.subtitle.batchResults = [];
      this.subtitle.downloadInProgress = false;

      const results = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        this.subtitle.status = `正在处理 ${i + 1} / ${files.length}：${file.name}`;
        try {
          const res = await processSubtitleFile(file);
          results.push(res);
        } catch (err) {
          results.push({ originalName: file.name, error: err?.message || "处理失败" });
        }
      }

      this.subtitle.batchResults = results;
      const successCount = results.filter((item) => !item.error).length;
      const failedCount = results.length - successCount;
      this.subtitle.status = `已处理 ${successCount} / ${files.length} 个文件`;
      if (failedCount > 0) {
        this.showToast(`${failedCount} 个文件处理失败`, "warning");
      }
      this.subtitle.isProcessing = false;
      this.subtitle.fileInputKey = Date.now();
    },
    downloadSubtitleItem(item) {
      if (item.error) return;
      downloadText(item.newName, item.content || "");
    },
    async downloadSubtitleZip() {
      const success = this.subtitle.batchResults.filter((item) => !item.error);
      if (!success.length) {
        this.showToast("暂无可打包内容", "warning");
        return;
      }
      this.subtitle.downloadInProgress = true;
      try {
        const blob = await generateZipFromResults(success);
        downloadBlob("subtitle_results.zip", blob);
        this.showToast("ZIP 已生成", "success");
      } catch (e) {
        this.showToast(e.message || "打包失败", "error");
      } finally {
        this.subtitle.downloadInProgress = false;
      }
    },
    clearSubtitleBatch() {
      this.subtitle.batchResults = [];
      this.subtitle.status = "请上传文件或文件夹...";
      this.subtitle.fileInputKey = Date.now();
    },
    runCleanup() {
      this.cleanup.output = processCleanup(this.cleanup.input, this.cleanup.removeMarkdown, this.cleanup.removeEmptyLines);
    },
    copyCleanup() {
      this.copyValue(this.cleanup.output);
    },
    downloadCleanup() {
      if (!this.cleanup.output) return;
      downloadText("cleaned_text.txt", this.cleanup.output);
    },
    runJoiner() {
      this.joiner.lastResult = processJoiner(this.joiner.input, this.joiner.separator);
      this.joiner.displayOutput = (this.joiner.lastResult || "").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
    },
    copyJoiner() {
      this.copyValue(this.joiner.lastResult);
    },
    downloadJoiner() {
      if (!this.joiner.lastResult) return;
      downloadText("joined_text.txt", this.joiner.lastResult);
    },
    updateInjected() {
      this.injector.output = processInjector(this.injector.input, this.injector.string || "\u200b");
    },
    useZeroWidth() {
      this.injector.string = "\u200b";
      this.updateInjected();
    },
    copyInjector() {
      this.copyValue(this.injector.output);
    },
    downloadInjector() {
      if (!this.injector.output) return;
      downloadText("injected_text.txt", this.injector.output);
    },
    updateTimestampFromDate() {
      const timestamp = timestampFromParts({
        year: this.timestamp.year,
        month: this.timestamp.month,
        day: this.timestamp.day,
        hour: this.timestamp.hour,
        minute: this.timestamp.minute,
        second: this.timestamp.second,
      });
      if (timestamp == null) {
        this.timestamp.fromDate = "";
        return;
      }
      this.timestamp.fromDate = String(timestamp);
      const parts = partsFromTimestamp(timestamp);
      this.timestamp.fromTsInput = String(timestamp);
      this.timestamp.fromTsOutput = formatParts(parts);
    },
    updateDateFromTimestamp() {
      const ts = Number(this.timestamp.fromTsInput);
      const parts = partsFromTimestamp(ts);
      if (!parts) {
        this.timestamp.fromTsOutput = "";
        return;
      }
      this.timestamp.year = parts.year;
      this.timestamp.month = parts.month;
      this.timestamp.day = parts.day;
      this.timestamp.hour = parts.hour;
      this.timestamp.minute = parts.minute;
      this.timestamp.second = parts.second;
      this.timestamp.fromTsOutput = formatParts(parts);
      this.timestamp.fromDate = String(ts);
    },
    copyTimestamp(value) {
      this.copyValue(value);
    },
    startTimestampTicker() {
      if (this.timestampTicker) clearInterval(this.timestampTicker);
      this.timestampTicker = setInterval(() => {
        this.timestamp.current = getCurrentTimestamp();
      }, 1000);
    },
    updateSecondsFromDuration() {
      const total = toTotalSeconds(this.duration.days, this.duration.hours, this.duration.minutes, this.duration.seconds);
      this.duration.totalSeconds = String(total);
      const parts = fromTotalSeconds(total);
      this.duration.outputs = {
        days: String(parts.days),
        hours: String(parts.hours),
        minutes: String(parts.minutes),
        seconds: String(parts.seconds),
      };
    },
    updateDurationFromSeconds() {
      const parts = fromTotalSeconds(this.duration.totalSeconds);
      this.duration.days = String(parts.days);
      this.duration.hours = String(parts.hours);
      this.duration.minutes = String(parts.minutes);
      this.duration.seconds = String(parts.seconds);
      this.duration.outputs = {
        days: String(parts.days),
        hours: String(parts.hours),
        minutes: String(parts.minutes),
        seconds: String(parts.seconds),
      };
    },
    applyQuickDuration(days, hours) {
      this.duration.days = String(days);
      this.duration.hours = String(hours);
      this.duration.minutes = "0";
      this.duration.seconds = "0";
      this.updateSecondsFromDuration();
    },
    encodeBase64() {
      this.base64.output = base64Encode(this.base64.input);
    },
    decodeBase64() {
      this.base64.output = base64Decode(this.base64.input);
    },
    copyBase64() {
      this.copyValue(this.base64.output);
    },
    autoDetectEscapeMode() {
      this.escape.sourceMode = detectSourceMode(this.escape.input);
    },
    runEscapeConversion() {
      const { result, error } = convertEscapes({
        input: this.escape.input,
        sourceMode: this.escape.sourceMode,
        encoding: this.escape.encoding,
        outputMode: this.escape.outputMode,
        hexCase: this.escape.hexCase,
      });
      this.escape.output = result;
      this.escape.error = error;
    },
    copyEscape() {
      this.copyValue(this.escape.output);
    },
    downloadEscape() {
      if (!this.escape.output) return;
      downloadText("escaped_text.txt", this.escape.output);
    },
    async prefetchConverters() {
      try {
        const ok = await ensureConverters();
        this.converter.ready = ok;
      } catch {
        this.converter.ready = false;
      }
      setTimeout(() => (this.converter.ready = true), 4000);
    },
    async runConverter(direction) {
      if (!this.converter.input) {
        this.converter.output = "";
        return;
      }
      this.converter.converting = true;
      try {
        const text = await convertOpenCC(direction, this.converter.input);
        const result = this.converter.quotes ? convertQuotes(text) : text;
        this.converter.output = result;
        this.showToast("转换完成", "success");
      } catch (e) {
        this.showToast(e.message || "转换失败，请稍后重试", "error");
      } finally {
        this.converter.converting = false;
      }
    },
    copyConverter() {
      this.copyValue(this.converter.output);
    },
  },
  mounted() {
    this.runJoiner();
    this.updateInjected();
    this.updateTimestampFromDate();
    this.updateDurationFromSeconds();
    this.startTimestampTicker();
    this.prefetchConverters();
    registerServiceWorker();
  },
  beforeUnmount() {
    if (this.timestampTicker) clearInterval(this.timestampTicker);
  },
});

app.mount("#app");
