// 文本加料逻辑

export function processInjector(text, injectionString = "\u200b") {
  if (!text) return "";
  const inj = injectionString != null && injectionString.length > 0 ? String(injectionString) : "\u200b";
  return Array.from(text).join(inj);
}
