// Base64 编解码逻辑

export function base64Encode(text) {
  try {
    return btoa(unescape(encodeURIComponent(text ?? "")));
  } catch (e) {
    return "编码失败：无效的输入字符。";
  }
}

export function base64Decode(text) {
  try {
    return decodeURIComponent(escape(atob(text ?? "")));
  } catch (e) {
    return "解码失败：无效的 Base64 字符串。";
  }
}
