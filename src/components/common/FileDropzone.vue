<template>
  <div
    class="sprite-dropzone"
    :class="{ dragging: isDragging, 'has-image': hasContent }"
    @click="triggerUpload"
    @dragenter.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @dragover.prevent
    @drop.prevent="handleDrop"
  >
    <input
      ref="fileInput"
      class="sr-only"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :webkitdirectory="directory"
      :directory="directory"
      @change="handleFileSelect"
    >
    <slot>
      <div v-if="!hasContent" class="dropzone-hint">
        <strong>{{ placeholder }}</strong>
        <span>{{ hint }}</span>
      </div>
    </slot>
  </div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  accept: {
    type: String,
    default: "*",
  },
  multiple: {
    type: Boolean,
    default: false,
  },
  directory: {
    type: Boolean,
    default: false,
  },
  hasContent: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: "点击或拖入文件",
  },
  hint: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["files"]);

const fileInput = ref(null);
const isDragging = ref(false);

function triggerUpload() {
  fileInput.value?.click();
}

function handleFileSelect(event) {
  const files = Array.from(event.target?.files || []);
  if (files.length) {
    emit("files", files);
  }
  if (fileInput.value) {
    fileInput.value.value = "";
  }
}

function handleDrop(event) {
  isDragging.value = false;
  const files = Array.from(event.dataTransfer?.files || []);
  if (files.length) {
    emit("files", files);
  }
}

defineExpose({
  triggerUpload,
});
</script>
