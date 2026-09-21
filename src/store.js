import { isValidDateStr, isValidTime, timeToMinutes } from './utils/date.js';

const STORAGE_KEY = 'web-calendar.events.v1';
const LATENCY_MS = 120;

// Test hook: set window.__CALENDAR_FAIL_NEXT__ = true to make the next
// persistence call reject (used to verify restore-on-failure behaviour).
function maybeFail() {
  if (typeof window !== 'undefined' && window.__CALENDAR_FAIL_NEXT__) {
    window.__CALENDAR_FAIL_NEXT__ = false;
    throw new Error('模拟的持久化失败');
  }
}

function delay() {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function seedEvents() {
  const today = new Date();
  const fmt = (offset) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };
  return [
    {
      id: createId(),
      title: '团队晨会',
      date: fmt(0),
      start: '09:30',
      end: '10:00',
      description: '每日站会，同步进度与阻塞项。',
      color: '#3b82f6',
    },
    {
      id: createId(),
      title: '产品评审',
      date: fmt(1),
      start: '14:00',
      end: '15:30',
      description: '评审下一迭代需求稿。',
      color: '#8b5cf6',
    },
    {
      id: createId(),
      title: '健身',
      date: fmt(-1),
      start: '19:00',
      end: '20:00',
      description: '',
      color: '#10b981',
    },
    {
      id: createId(),
      title: '发布 v0.1',
      date: fmt(3),
      start: '11:00',
      end: '12:00',
      description: '灰度发布并观察指标。',
      color: '#f59e0b',
    },
  ];
}

function validateEvent(input) {
  const errors = [];
  if (!input.title || !input.title.trim()) errors.push('标题不能为空');
  if (!isValidDateStr(input.date)) errors.push('日期无效');
  if (!isValidTime(input.start)) errors.push('开始时间格式须为 HH:mm');
  if (!isValidTime(input.end)) errors.push('结束时间格式须为 HH:mm');
  if (
    isValidTime(input.start) &&
    isValidTime(input.end) &&
    timeToMinutes(input.end) <= timeToMinutes(input.start)
  ) {
    errors.push('结束时间必须晚于开始时间');
  }
  return errors;
}

function normalize(input) {
  return {
    id: input.id,
    title: input.title.trim(),
    date: input.date,
    start: input.start,
    end: input.end,
    description: (input.description || '').trim(),
    color: input.color || '#3b82f6',
  };
}

class EventStore {
  constructor() {
    this.events = [];
    this.listeners = new Set();
  }

  async load() {
    await delay();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.events = Array.isArray(parsed) ? parsed : [];
      } else {
        this.events = seedEvents();
        this.persist();
      }
    } catch {
      this.events = seedEvents();
    }
    this.emit();
  }

  persist() {
    maybeFail();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.events);
  }

  getAll() {
    return [...this.events];
  }

  getById(id) {
    return this.events.find((e) => e.id === id) || null;
  }

  getByDate(dateStr) {
    return this.events
      .filter((e) => e.date === dateStr)
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  }

  async create(input) {
    const errors = validateEvent(input);
    if (errors.length) throw new Error(errors.join('；'));
    const event = normalize({ ...input, id: createId() });
    const snapshot = this.events;
    this.events = [...this.events, event];
    try {
      this.persist();
    } catch (err) {
      this.events = snapshot;
      this.emit();
      throw err;
    }
    this.emit();
    return event;
  }

  async update(id, patch) {
    const current = this.getById(id);
    if (!current) throw new Error('事件不存在');
    const merged = { ...current, ...patch, id };
    const errors = validateEvent(merged);
    if (errors.length) throw new Error(errors.join('；'));
    const snapshot = this.events;
    this.events = this.events.map((e) => (e.id === id ? normalize(merged) : e));
    try {
      this.persist();
    } catch (err) {
      this.events = snapshot; // 失败时恢复原数据
      this.emit();
      throw err;
    }
    this.emit();
    return this.getById(id);
  }

  async remove(id) {
    const snapshot = this.events;
    this.events = this.events.filter((e) => e.id !== id);
    try {
      this.persist();
    } catch (err) {
      this.events = snapshot;
      this.emit();
      throw err;
    }
    this.emit();
  }
}

export const store = new EventStore();
