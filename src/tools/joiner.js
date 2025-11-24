// 文本拼接逻辑

export function processJoiner(text, separator) {
  if (!text) return "";
  const actualSeparator = String(separator ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
  const lines = text.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim() !== "");
  return nonEmptyLines.join(actualSeparator);
}
