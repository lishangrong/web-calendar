/**
 * 统一时间/日期工具。
 * 所有事件时间统一使用本地时间字符串 "YYYY-MM-DDTHH:mm"（无秒、无时区后缀）。
 */

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const SNAP_MINUTES = 15;

const pad = (n) => String(n).padStart(2, '0');

/** YYYY-MM-DD */
export function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** YYYY-MM-DDTHH:mm —— 全应用统一时间格式 */
export function formatDateTime(date) {
  return `${formatDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** HH:mm */
export function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 严格解析 "YYYY-MM-DDTHH:mm"，非法输入返回 null（绝不产生无效日期）。
 */
export function parseDateTime(str) {
  if (typeof str !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(str);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const date = new Date(y, mo - 1, d, h, mi, 0, 0);
  // 兜底：例如 2 月 30 日会被 Date 进位，必须拒绝
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

export function isValidDateTime(str) {
  return parseDateTime(str) !== null;
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeek(date) {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7; // 周一 = 0
  d.setDate(d.getDate() - day);
  return d;
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** 生成月视图需要的 42 格（6 行），周一开头，保证真实日历结构 */
export function getMonthGrid(anchor) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** 周视图的 7 天 */
export function getWeekDays(anchor) {
  const weekStart = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

/** 中文长日期，如 2026年9月21日 周一 14:30 */
export function formatFullLabel(dateTimeStr) {
  const date = parseDateTime(dateTimeStr);
  if (!date) return dateTimeStr;
  const weekday = WEEKDAY_LABELS[(date.getDay() + 6) % 7];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 周${weekday} ${formatTime(date)}`;
}

/** 判断事件是否发生在某一天（支持跨天事件） */
export function eventOccursOnDay(event, day) {
  const start = parseDateTime(event.start);
  const end = parseDateTime(event.end);
  if (!start) return false;
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + DAY_MS;
  return start.getTime() < dayEnd && (end ? end.getTime() : start.getTime() + MINUTE_MS) > dayStart;
}
