export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Date -> 'YYYY-MM-DD' (local time) */
export function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 'YYYY-MM-DD' -> Date (local, 00:00). Returns null for invalid input/date. */
export function parseDate(str) {
  if (typeof str !== 'string' || !DATE_RE.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null; // e.g. 2025-02-30
  }
  return date;
}

export function isValidTime(str) {
  return typeof str === 'string' && TIME_RE.test(str);
}

/** 'HH:mm' -> minutes since midnight. NaN if invalid. */
export function timeToMinutes(str) {
  if (!isValidTime(str)) return NaN;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins) {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(mins)));
  return `${pad2(Math.floor(clamped / 60) % 24)}:${pad2(clamped % 60)}`;
}

export function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Monday as first day of week. */
export function startOfWeek(date) {
  const day = date.getDay(); // 0=Sun
  const diff = (day + 6) % 7;
  return addDays(date, -diff);
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isValidDateStr(str) {
  return parseDate(str) !== null;
}
