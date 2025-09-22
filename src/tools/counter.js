// 实时文本分析工具模块
// 页面依赖 DOM：counter-input, counter-hanzi-count, counter-word-count, counter-punc-count, counter-char-count

/**
 * 统计文本：
 * - words: [a-zA-Z0-9_'] 连续片段计为 1 个单词
 * - hanzi: 中日字符范围计数
 * - punctuation: 剩余的非空白字符视为标点及其他符号
 * - totalChars: 原始字符总数
 */
function analyzeText(text) {
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

export function init() {
  const input = document.getElementById("counter-input");
  const hanziCount = document.getElementById("counter-hanzi-count");
  const wordCount = document.getElementById("counter-word-count");
  const puncCount = document.getElementById("counter-punc-count");
  const charCount = document.getElementById("counter-char-count");

  if (!input || !hanziCount || !wordCount || !puncCount || !charCount) {
    console.warn("Counter tool DOM 未就绪，跳过初始化");
    return;
  }

  // 初始化清零
  const zero = analyzeText("");
  hanziCount.textContent = String(zero.hanzi);
  wordCount.textContent = String(zero.words);
  puncCount.textContent = String(zero.punctuation);
  charCount.textContent = String(zero.totalChars);

  input.addEventListener(
    "input",
    () => {
      const stats = analyzeText(input.value ?? "");
      hanziCount.textContent = String(stats.hanzi);
      wordCount.textContent = String(stats.words);
      puncCount.textContent = String(stats.punctuation);
      charCount.textContent = String(stats.totalChars);
    },
    { passive: true }
  );
}