// 文本清理逻辑：移除 Markdown 标记与空行

export function processCleanup(text, removeMarkdown, removeEmptyLines) {
  if (!text) return "";
  let lines = text.split(/\r?\n/);

  if (removeMarkdown) {
    lines = lines.map((line) =>
      line
        .replace(/^[#*>\-`]+\s*/, "")
        .replace(/(\*\*|__)(.*?)\1/g, "$2")
        .replace(/(\*|_)(.*?)\1/g, "$2")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    );
  }

  if (removeEmptyLines) {
    return lines.filter((line) => line.trim() !== "").join("\n");
  }
  return lines.join("\n");
}
