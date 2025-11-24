// 文本统计逻辑

export function analyzeText(text) {
  if (!text) return { hanzi: 0, words: 0, punctuation: 0, totalChars: 0 };
  const wordRegex = /[a-zA-Z0-9_']+/g;
  const hanziRegex = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/g;

  const words = (text.match(wordRegex) || []).length;

  let remainingText = text.replace(wordRegex, "");
  const hanzi = (remainingText.match(hanziRegex) || []).length;

  remainingText = remainingText.replace(hanziRegex, "").replace(/\s/g, "");
  const punctuation = remainingText.length;

  return { hanzi, words, punctuation, totalChars: text.length };
}
