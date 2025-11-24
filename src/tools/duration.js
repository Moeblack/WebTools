// 时间段换算纯函数

export function toTotalSeconds(days, hours, minutes, seconds) {
  const d = Number(days) || 0;
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  const s = Number(seconds) || 0;
  return d * 86400 + h * 3600 + m * 60 + s;
}

export function fromTotalSeconds(total) {
  let t = Number(total) || 0;
  if (t < 0) t = 0;
  const days = Math.floor(t / 86400);
  let remainder = t % 86400;
  const hours = Math.floor(remainder / 3600);
  remainder %= 3600;
  const minutes = Math.floor(remainder / 60);
  const seconds = remainder % 60;
  return { days, hours, minutes, seconds };
}
