export function useFileReader() {
  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("读取文件失败"));
      reader.readAsDataURL(file);
    });
  }

  function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("读取文件失败"));
      reader.readAsArrayBuffer(file);
    });
  }

  function loadImageFromUrl(src) {
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
  }

  return {
    readAsDataUrl,
    readAsArrayBuffer,
    loadImageFromUrl,
  };
}
