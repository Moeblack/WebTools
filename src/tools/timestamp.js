// 时间戳双向转换纯函数

export function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

export function timestampFromParts({ year, month, day, hour = 0, minute = 0, second = 0 }) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d) return null;
  const hh = Number.isFinite(Number(hour)) ? Number(hour) : 0;
  const mm = Number.isFinite(Number(minute)) ? Number(minute) : 0;
  const ss = Number.isFinite(Number(second)) ? Number(second) : 0;
  const date = new Date(y, m - 1, d, hh, mm, ss);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

export function partsFromTimestamp(timestamp) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const date = new Date(ts * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function formatParts(parts) {
  if (!parts) return "";
  return (
    `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ` +
    `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`
  );
}
