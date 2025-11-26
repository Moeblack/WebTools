<template>
  <div class="toast" v-if="toast.visible" :class="toast.type">
    {{ toast.message }}
  </div>
</template>

<script setup>
import { useToast } from "../../composables/useToast.js";

const { toast } = useToast();
</script>
