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
  { key: "spriteGif", label: "精灵图转GIF" },
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
      spriteGif: {
        columns: 4,
        rows: 2,
        fps: 8,
        padding: 0,
        imageName: "",
        imageUrl: "",
        originalDataUrl: "",
        imageWidth: 0,
        imageHeight: 0,
        frameWidth: 0,
        frameHeight: 0,
        frameCount: 0,
        frames: [],
        framePreviews: [],
        previewFrameIndex: 0,
        previewPlaying: true,
        gridPreviewUrl: "",
        isDragging: false,
        isGenerating: false,
        status: "请选择 PNG / JPG 格式的精灵图",
        editPanelOpen: false,
        workerUrl: "",
        workerBlobUrl: "",
        edit: {
          cropX: 0,
          cropY: 0,
          cropWidth: 0,
          cropHeight: 0,
          rotation: 0,
          removeBg: false,
          bgColor: "#ffffff",
          bgTolerance: 30,
        },
      },
      spritePreviewTimer: null,
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
    triggerSpriteFileSelect() {
      const input = this.$refs?.spriteFileInput;
      if (input) input.click();
    },
    async handleSpriteFileSelect(fileList) {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      const file = files[0];
      if (!file.type?.startsWith("image/")) {
        this.showToast("仅支持 PNG / JPG 图片", "warning");
        return;
      }
      try {
        await this.loadSpriteFile(file);
      } catch (err) {
        this.showToast(err?.message || "图片加载失败", "error");
      } finally {
        if (this.$refs?.spriteFileInput) {
          this.$refs.spriteFileInput.value = "";
        }
      }
    },
    handleSpriteDrop(event) {
      this.spriteGif.isDragging = false;
      if (!event.dataTransfer?.files?.length) return;
      this.handleSpriteFileSelect(event.dataTransfer.files);
    },
    async loadSpriteFile(file) {
      const dataUrl = await this.readFileAsDataUrl(file);
      this.spriteGif.imageName = file.name;
      this.spriteGif.originalDataUrl = dataUrl;
      this.spriteGif.imageUrl = dataUrl;
      await this.syncSpriteImageMeta(dataUrl);
    },
    readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("读取文件失败"));
        reader.readAsDataURL(file);
      });
    },
    loadImageFromUrl(src) {
      return new Promise((resolve, reject) => {
        if (!src) {
          reject(new Error("图片地址无效"));
          return;
        }
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("图片无法加载"));
        img.crossOrigin = "anonymous";
        img.src = src;
      });
    },
    async syncSpriteImageMeta(src) {
      try {
        const image = await this.loadImageFromUrl(src);
        this.spriteGif.imageWidth = image.width;
        this.spriteGif.imageHeight = image.height;
        this.spriteGif.status = `原图尺寸：${image.width} × ${image.height}`;
        this.initializeSpriteEditBounds(image.width, image.height);
        await this.updateSpriteFrames();
      } catch (err) {
        this.showToast(err?.message || "无法读取图片信息", "error");
      }
    },
    initializeSpriteEditBounds(width, height) {
      this.spriteGif.edit.cropX = 0;
      this.spriteGif.edit.cropY = 0;
      this.spriteGif.edit.cropWidth = width;
      this.spriteGif.edit.cropHeight = height;
      this.spriteGif.edit.rotation = 0;
      this.spriteGif.edit.removeBg = false;
    },
    clampSpriteValue(value, min, max) {
      return Math.min(Math.max(value, min), max);
    },
    async updateSpriteFrames() {
      if (!this.spriteGif.imageUrl) {
        this.spriteGif.frames = [];
        this.spriteGif.framePreviews = [];
        this.spriteGif.frameCount = 0;
        this.spriteGif.frameWidth = 0;
        this.spriteGif.frameHeight = 0;
        this.spriteGif.gridPreviewUrl = "";
        this.spriteGif.previewFrameIndex = 0;
        this.stopSpritePreviewTimer();
        this.spriteGif.status = "请选择 PNG / JPG 格式的精灵图";
        return;
      }
      const columns = Math.max(1, Math.floor(Number(this.spriteGif.columns) || 1));
      const rows = Math.max(1, Math.floor(Number(this.spriteGif.rows) || 1));
      try {
        const image = await this.loadImageFromUrl(this.spriteGif.imageUrl);
        const cellWidth = Math.floor(image.width / columns);
        const cellHeight = Math.floor(image.height / rows);
        if (cellWidth <= 0 || cellHeight <= 0) {
          throw new Error("请调整分割数以得到有效的帧尺寸");
        }
        const padding = Math.max(0, Number(this.spriteGif.padding) || 0);
        const maxPadding = Math.min(Math.floor(cellWidth / 2) - 1, Math.floor(cellHeight / 2) - 1);
        const effectivePadding = Math.max(0, isNaN(maxPadding) ? 0 : Math.min(padding, Math.max(0, maxPadding)));
        const frameWidth = Math.max(1, cellWidth - effectivePadding * 2);
        const frameHeight = Math.max(1, cellHeight - effectivePadding * 2);
        const frames = [];
        const previews = [];
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < columns; col += 1) {
            const sx = col * cellWidth + effectivePadding;
            const sy = row * cellHeight + effectivePadding;
            const frameCanvas = document.createElement("canvas");
            frameCanvas.width = frameWidth;
            frameCanvas.height = frameHeight;
            const ctx = frameCanvas.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, frameWidth, frameHeight);
            ctx.drawImage(image, sx, sy, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
            frames.push(frameCanvas);
            previews.push(frameCanvas.toDataURL("image/png"));
          }
        }
        this.spriteGif.frames = frames;
        this.spriteGif.framePreviews = previews;
        this.spriteGif.frameWidth = frameWidth;
        this.spriteGif.frameHeight = frameHeight;
        this.spriteGif.frameCount = frames.length;
        this.spriteGif.status = `总帧数 ${frames.length} · 单帧 ${frameWidth} × ${frameHeight}`;
        this.spriteGif.gridPreviewUrl = this.buildSpriteGridPreview(image, columns, rows);
        this.spriteGif.previewFrameIndex = 0;
        if (this.spriteGif.previewPlaying) {
          this.startSpritePreviewTimer();
        }
      } catch (err) {
        this.spriteGif.frames = [];
        this.spriteGif.framePreviews = [];
        this.spriteGif.frameCount = 0;
        this.spriteGif.gridPreviewUrl = "";
        this.stopSpritePreviewTimer();
        this.spriteGif.status = err?.message || "精灵图解析失败";
        this.showToast(err?.message || "精灵图解析失败", "error");
      }
    },
    buildSpriteGridPreview(image, columns, rows) {
      const gridCanvas = document.createElement("canvas");
      gridCanvas.width = image.width;
      gridCanvas.height = image.height;
      const ctx = gridCanvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      ctx.strokeStyle = "rgba(37,99,235,0.75)";
      ctx.lineWidth = 1;
      const colWidth = image.width / columns;
      const rowHeight = image.height / rows;
      for (let i = 1; i < columns; i += 1) {
        const x = Math.round(colWidth * i) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, image.height);
        ctx.stroke();
      }
      for (let j = 1; j < rows; j += 1) {
        const y = Math.round(rowHeight * j) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(image.width, y);
        ctx.stroke();
      }
      return gridCanvas.toDataURL("image/png");
    },
    startSpritePreviewTimer() {
      this.stopSpritePreviewTimer();
      if (!this.spriteGif.previewPlaying || !this.spriteGif.framePreviews.length) return;
      const fps = Math.max(1, Number(this.spriteGif.fps) || 1);
      const delay = Math.max(30, Math.round(1000 / fps));
      this.spritePreviewTimer = setInterval(() => {
        if (!this.spriteGif.framePreviews.length) return;
        this.spriteGif.previewFrameIndex = (this.spriteGif.previewFrameIndex + 1) % this.spriteGif.framePreviews.length;
      }, delay);
    },
    stopSpritePreviewTimer() {
      if (this.spritePreviewTimer) {
        clearInterval(this.spritePreviewTimer);
        this.spritePreviewTimer = null;
      }
    },
    toggleSpritePreview() {
      if (!this.spriteGif.framePreviews.length) return;
      this.spriteGif.previewPlaying = !this.spriteGif.previewPlaying;
      if (this.spriteGif.previewPlaying) {
        this.startSpritePreviewTimer();
      } else {
        this.stopSpritePreviewTimer();
      }
    },
    async applySpriteEdits() {
      if (!this.spriteGif.imageUrl) return;
      try {
        const img = await this.loadImageFromUrl(this.spriteGif.imageUrl);
        const cropX = this.clampSpriteValue(Number(this.spriteGif.edit.cropX) || 0, 0, img.width - 1);
        const cropY = this.clampSpriteValue(Number(this.spriteGif.edit.cropY) || 0, 0, img.height - 1);
        const cropWidth = this.clampSpriteValue(
          Number(this.spriteGif.edit.cropWidth) || img.width,
          1,
          img.width - cropX
        );
        const cropHeight = this.clampSpriteValue(
          Number(this.spriteGif.edit.cropHeight) || img.height,
          1,
          img.height - cropY
        );
        const workCanvas = document.createElement("canvas");
        workCanvas.width = cropWidth;
        workCanvas.height = cropHeight;
        const ctx = workCanvas.getContext("2d");
        ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        if (this.spriteGif.edit.removeBg) {
          this.removeBackgroundFromCanvas(ctx, cropWidth, cropHeight, this.spriteGif.edit.bgColor, this.spriteGif.edit.bgTolerance);
        }
        const rotationSteps = ((Math.round(Number(this.spriteGif.edit.rotation) / 90) % 4) + 4) % 4;
        let outputCanvas = workCanvas;
        if (rotationSteps !== 0) {
          const rotatedCanvas = document.createElement("canvas");
          rotatedCanvas.width = rotationSteps % 2 === 0 ? workCanvas.width : workCanvas.height;
          rotatedCanvas.height = rotationSteps % 2 === 0 ? workCanvas.height : workCanvas.width;
          const rctx = rotatedCanvas.getContext("2d");
          rctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
          rctx.rotate((rotationSteps * 90 * Math.PI) / 180);
          rctx.drawImage(workCanvas, -workCanvas.width / 2, -workCanvas.height / 2);
          outputCanvas = rotatedCanvas;
        }
        const dataUrl = outputCanvas.toDataURL("image/png");
        this.spriteGif.imageUrl = dataUrl;
        this.spriteGif.imageWidth = outputCanvas.width;
        this.spriteGif.imageHeight = outputCanvas.height;
        this.initializeSpriteEditBounds(outputCanvas.width, outputCanvas.height);
        await this.updateSpriteFrames();
        this.showToast("已应用简单编辑", "success");
      } catch (err) {
        this.showToast(err?.message || "应用编辑失败", "error");
      }
    },
    removeBackgroundFromCanvas(ctx, width, height, hexColor, tolerance) {
      const imageData = ctx.getImageData(0, 0, width, height);
      const target = this.hexToRgb(hexColor);
      if (!target) return;
      const data = imageData.data;
      const tol = Math.max(0, Math.min(100, Number(tolerance) || 0)) * 2.55;
      for (let i = 0; i < data.length; i += 4) {
        const diff =
          Math.abs(data[i] - target.r) + Math.abs(data[i + 1] - target.g) + Math.abs(data[i + 2] - target.b);
        if (diff / 3 <= tol) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    },
    hexToRgb(hex) {
      if (!hex) return null;
      const normalized = hex.replace("#", "");
      if (![3, 6].includes(normalized.length)) return null;
      const value = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
      const num = parseInt(value, 16);
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
      };
    },
    resetSpriteEdits() {
      if (!this.spriteGif.originalDataUrl) return;
      this.spriteGif.imageUrl = this.spriteGif.originalDataUrl;
      this.syncSpriteImageMeta(this.spriteGif.originalDataUrl);
      this.showToast("已还原原图", "info");
    },
    async generateSpriteGif() {
      if (!this.spriteGif.frames.length) {
        this.showToast("请先上传并分割精灵图", "warning");
        return;
      }
      const GIFConstructor = window.GIF;
      if (!GIFConstructor) {
        this.showToast("GIF 生成库未加载", "error");
        return;
      }
      this.spriteGif.isGenerating = true;
      try {
        const workerScript = await this.resolveSpriteWorkerUrl();
        const delay = Math.max(20, Math.round(1000 / Math.max(1, Number(this.spriteGif.fps) || 1)));
        const gif = new GIFConstructor({
          workers: 2,
          workerScript,
          width: this.spriteGif.frameWidth,
          height: this.spriteGif.frameHeight,
          quality: 12,
          transparent: 0x000000,
        });
        this.spriteGif.frames.forEach((canvas) => {
          gif.addFrame(canvas, { delay, copy: true });
        });
        const blob = await new Promise((resolve, reject) => {
          gif.on("finished", resolve);
          gif.on("abort", () => reject(new Error("GIF 生成被取消")));
          gif.on("error", (err) => reject(err || new Error("GIF 生成失败")));
          gif.render();
        });
        const filename = (this.spriteGif.imageName?.replace(/\.[^.]+$/, "") || "sprite") + ".gif";
        downloadBlob(filename, blob);
        this.showToast("GIF 已生成", "success");
      } catch (err) {
        this.showToast(err?.message || "GIF 生成失败", "error");
      } finally {
        this.spriteGif.isGenerating = false;
      }
    },
    async resolveSpriteWorkerUrl() {
      if (this.spriteGif.workerUrl) return this.spriteGif.workerUrl;
      if (typeof window === "undefined") return "./gif.worker.js";
      const base = window.location.href;
      const candidates = ["./gif.worker.js", "./public/gif.worker.js"];
      for (let i = 0; i < candidates.length; i += 1) {
        const url = new URL(candidates[i], base).href;
        const ok = await this.checkWorkerExists(url);
        if (ok) {
          this.spriteGif.workerUrl = url;
          return url;
        }
      }
      const blobUrl = await this.fetchWorkerFromCdn();
      if (blobUrl) {
        this.spriteGif.workerUrl = blobUrl;
        this.spriteGif.workerBlobUrl = blobUrl;
        return blobUrl;
      }
      return new URL("./gif.worker.js", base).href;
    },
    async checkWorkerExists(url) {
      try {
        const res = await fetch(url, { method: "HEAD", cache: "no-store" });
        return res.ok;
      } catch {
        return false;
      }
    },
    async fetchWorkerFromCdn() {
      try {
        const resp = await fetch("https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js");
        if (!resp.ok) return null;
        const code = await resp.text();
        const blob = new Blob([code], { type: "application/javascript" });
        return URL.createObjectURL(blob);
      } catch {
        return null;
      }
    },
  },
  watch: {
    "spriteGif.columns"() {
      this.updateSpriteFrames();
    },
    "spriteGif.rows"() {
      this.updateSpriteFrames();
    },
    "spriteGif.padding"() {
      this.updateSpriteFrames();
    },
    "spriteGif.fps"() {
      if (this.spriteGif.previewPlaying) {
        this.startSpritePreviewTimer();
      }
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
    this.stopSpritePreviewTimer();
    if (this.spriteGif.workerBlobUrl) {
      URL.revokeObjectURL(this.spriteGif.workerBlobUrl);
    }
  },
});

app.mount("#app");
