export function useDownload() {
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

  return {
    downloadBlob,
    downloadText,
  };
}
