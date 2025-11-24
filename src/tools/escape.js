// 文本转义逻辑

function encodeUtf8(str) {
  return new Uint8Array(new TextEncoder().encode(str));
}
function decodeUtf8(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (e) {
    throw new Error("UTF-8 解码失败：字节序列无效");
  }
}
function encodeLatin1(str) {
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code > 0xff) {
      throw new Error("Latin-1 编码失败：存在超出 0xFF 的字符");
    }
    arr[i] = code & 0xff;
  }
  return arr;
}
function decodeLatin1(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function bytesToHexEscapes(bytes, hexCase = "lower") {
  const hex = [];
  const toHex = (n) => n.toString(16).padStart(2, "0");
  for (let i = 0; i < bytes.length; i++) {
    const h = toHex(bytes[i]);
    hex.push("\\x" + (hexCase === "upper" ? h.toUpperCase() : h));
  }
  return hex.join("");
}

function wrapAsPythonBytesLiteral(escapes) {
  return "b'" + escapes.replace(/'/g, "\\'") + "'";
}

function parseByteLiteralOrHexEscapes(input) {
  let s = String(input || "").trim();

  if ((s.startsWith("b'") || s.startsWith("B'")) && s.endsWith("'")) {
    s = s.slice(2, -1);
  } else if ((s.startsWith('b"') || s.startsWith('B"')) && s.endsWith('"')) {
    s = s.slice(2, -1);
  } else if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    s = s.slice(1, -1);
  }

  const out = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "\\") {
      const code = s.charCodeAt(i);
      out.push(code & 0xff);
      continue;
    }
    i++;
    if (i >= s.length) throw new Error("转义序列不完整：末尾出现单独的反斜杠");
    const e = s[i];
    switch (e) {
      case "n":
        out.push(0x0a);
        break;
      case "r":
        out.push(0x0d);
        break;
      case "t":
        out.push(0x09);
        break;
      case "\\":
        out.push(0x5c);
        break;
      case "'":
        out.push(0x27);
        break;
      case '"':
        out.push(0x22);
        break;
      case "0":
        out.push(0x00);
        break;
      case "x": {
        if (i + 2 >= s.length) throw new Error("十六进制转义不完整：\\x 后需两位十六进制");
        const h1 = s[i + 1];
        const h2 = s[i + 2];
        const hex = h1 + h2;
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
          throw new Error("无效的十六进制转义：\\x" + hex);
        }
        out.push(parseInt(hex, 16));
        i += 2;
        break;
      }
      default:
        out.push(e.charCodeAt(0));
        break;
    }
  }
  return new Uint8Array(out);
}

export function detectSourceMode(text) {
  if (!text) return "text";
  const s = String(text).trim();
  const isBytesLiteral =
    ((s.startsWith("b'") || s.startsWith("B'")) && s.endsWith("'")) ||
    ((s.startsWith('b"') || s.startsWith('B"')) && s.endsWith('"'));
  const hasHexEsc = /\\x[0-9a-fA-F]{2}/.test(s);
  const compact = s.replace(/\s+/g, "");
  const mostlyHex = /^\\x[0-9a-fA-F]{2}(\\x[0-9a-fA-F]{2})+$/i.test(compact);
  return isBytesLiteral || hasHexEsc || mostlyHex ? "bytes" : "text";
}

export function convertEscapes({
  input = "",
  sourceMode = "text",
  encoding = "utf8",
  outputMode = "python",
  hexCase = "lower",
}) {
  const mode = sourceMode === "bytes" ? "bytes" : "text";
  const enc = encoding === "latin1" ? "latin1" : "utf8";
  const outMode = outputMode === "plain" ? "plain" : "python";

  try {
    if (mode === "text") {
      const bytes = enc === "utf8" ? encodeUtf8(input) : encodeLatin1(input);
      const escapes = bytesToHexEscapes(bytes, hexCase);
      const result = outMode === "python" ? wrapAsPythonBytesLiteral(escapes) : escapes;
      return { result, error: "" };
    }
    const bytes = parseByteLiteralOrHexEscapes(input);
    const text = enc === "utf8" ? decodeUtf8(bytes) : decodeLatin1(bytes);
    return { result: text, error: "" };
  } catch (e) {
    return { result: "", error: e.message || String(e) };
  }
}
