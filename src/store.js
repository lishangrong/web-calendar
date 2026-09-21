/**
 * 事件存储层。
 * - 内存 Map + localStorage 持久化
 * - 异步 API（模拟网络请求），失败时抛出错误，由调用方回滚 UI
 * - 每个事件拥有唯一 ID
 */
import {
  MINUTE_MS,
  addDays,
  formatDateTime,
  isValidDateTime,
  parseDateTime,
  startOfDay,
} from './dateUtils.js';

const HOUR_MS = 60 * MINUTE_MS;

const STORAGE_KEY = 'web-calendar-events-v1';

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function seedEvents() {
  const today9 = new Date();
  today9.setHours(9, 0, 0, 0);
  const today10 = new Date(today9);
  today10.setHours(10, 30, 0, 0);

  const tomorrow14 = addDays(startOfDay(new Date()), 1);
  tomorrow14.setHours(14, 0, 0, 0);
  const tomorrow15 = new Date(tomorrow14);
  tomorrow15.setHours(15, 0, 0, 0);

  const dayAfter10 = addDays(startOfDay(new Date()), 2);
  dayAfter10.setHours(10, 0, 0, 0);
  const dayAfter12 = new Date(dayAfter10);
  dayAfter12.setHours(11, 30, 0, 0);

  // 一个跨天事件，用于验证跨日期渲染
  const crossStart = addDays(startOfDay(new Date()), 4);
  crossStart.setHours(22, 0, 0, 0);
  const crossEnd = new Date(crossStart.getTime() + 3 * HOUR_MS);

  return [
    {
      id: createId(),
      title: '晨会',
      start: formatDateTime(today9),
      end: formatDateTime(today10),
      description: '同步本周工作进展',
      color: '#4f8cff',
    },
    {
      id: createId(),
      title: '产品评审',
      start: formatDateTime(tomorrow14),
      end: formatDateTime(tomorrow15),
      description: '评审日历组件交互方案',
      color: '#f59e0b',
    },
    {
      id: createId(),
      title: '代码评审',
      start: formatDateTime(dayAfter10),
      end: formatDateTime(dayAfter12),
      description: '',
      color: '#10b981',
    },
    {
      id: createId(),
      title: '夜班车（跨天）',
      start: formatDateTime(crossStart),
      end: formatDateTime(crossEnd),
      description: '用于演示跨天事件',
      color: '#8b5cf6',
    },
  ];
}

function validateEvent(data) {
  if (!data || typeof data !== 'object') throw new Error('事件数据无效');
  if (!data.title || !String(data.title).trim()) throw new Error('标题不能为空');
  if (!isValidDateTime(data.start)) throw new Error('开始时间格式无效');
  if (!isValidDateTime(data.end)) throw new Error('结束时间格式无效');
  const start = parseDateTime(data.start);
  const end = parseDateTime(data.end);
  if (end.getTime() <= start.getTime()) throw new Error('结束时间必须晚于开始时间');
}

function delay(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class EventStore {
  constructor() {
    this.events = new Map();
    this.listeners = new Set();
    this.failNext = false;
    this.#load();
  }

  /** 测试用：让下一次写入（create/update/remove）失败，验证 UI 回滚 */
  setFailNextWrite() {
    this.failNext = true;
  }

  #load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const evt of arr) {
            if (evt && evt.id && isValidDateTime(evt?.start) && isValidDateTime(evt?.end)) {
              this.events.set(evt.id, evt);
            }
          }
        }
      }
    } catch {
      // 存储损坏时忽略
    }
    if (this.events.size === 0) {
      for (const evt of seedEvents()) this.events.set(evt.id, evt);
      this.#persist();
    }
  }

  #persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.events.values()]));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  #notify() {
    for (const fn of this.listeners) fn(this.list());
  }

  /** 返回事件快照数组（按开始时间排序） */
  list() {
    return [...this.events.values()].sort(
      (a, b) => parseDateTime(a.start).getTime() - parseDateTime(b.start).getTime(),
    );
  }

  /** 根据事件 ID 加载数据 */
  getById(id) {
    return this.events.get(id) ?? null;
  }

  async create(data) {
    await delay();
    if (this.failNext) {
      this.failNext = false;
      throw new Error('模拟网络错误：创建失败');
    }
    const event = {
      id: createId(),
      title: String(data.title).trim(),
      start: data.start,
      end: data.end,
      description: data.description ?? '',
      color: data.color || '#4f8cff',
    };
    validateEvent(event);
    this.events.set(event.id, event);
    this.#persist();
    this.#notify();
    return event;
  }

  async update(id, patch) {
    await delay();
    if (this.failNext) {
      this.failNext = false;
      throw new Error('模拟网络错误：更新失败');
    }
    const existing = this.events.get(id);
    if (!existing) throw new Error('事件不存在或已被删除');
    const next = { ...existing, ...patch, id: existing.id };
    validateEvent(next);
    this.events.set(id, next);
    this.#persist();
    this.#notify();
    return next;
  }

  async remove(id) {
    await delay();
    if (this.failNext) {
      this.failNext = false;
      throw new Error('模拟网络错误：删除失败');
    }
    if (!this.events.has(id)) throw new Error('事件不存在或已被删除');
    this.events.delete(id);
    this.#persist();
    this.#notify();
  }
}

export const store = new EventStore();
export { validateEvent };
