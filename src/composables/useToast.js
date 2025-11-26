import { ref } from "vue";

const toast = ref({
  visible: false,
  message: "",
  type: "info",
});

let toastTimer = null;

export function useToast() {
  function showToast(message, type = "info") {
    toast.value.message = message;
    toast.value.type = type;
    toast.value.visible = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.value.visible = false;
    }, 2400);
  }

  return {
    toast,
    showToast,
  };
}
