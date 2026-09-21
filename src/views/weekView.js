import { store } from '../store.js';
import { makeDraggable, makeDropTarget } from '../dnd.js';
import {
  addDays,
  formatDate,
  isSameDay,
  minutesToTime,
  pad2,
  startOfWeek,
  timeToMinutes,
} from '../utils/date.js';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const HOUR_START = 0;
const HOUR_END = 24;
const SLOT_MINUTES = 60;
const SLOT_HEIGHT = 48; // px, must match CSS --slot-height

export function renderWeekView(container, cursor, { onDateClick, onEventClick }) {
  container.innerHTML = '';
  const today = new Date();
  const weekStart = startOfWeek(cursor);

  const wrap = document.createElement('div');
  wrap.className = 'week-view';

  // 头部：星期 + 日期
  const header = document.createElement('div');
  header.className = 'week-header';
  header.appendChild(document.createElement('div')); // 时间轴列占位
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const dateStr = formatDate(day);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'week-header-cell';
    if (isSameDay(day, today)) cell.classList.add('today');
    cell.innerHTML = `<span class="week-dow">${WEEKDAYS[i]}</span><span class="week-date">${day.getDate()}</span>`;
    cell.addEventListener('click', () => onDateClick(dateStr));
    header.appendChild(cell);
  }
  wrap.appendChild(header);

  // 主体：时间轴 + 7 列
  const body = document.createElement('div');
  body.className = 'week-body';

  const axis = document.createElement('div');
  axis.className = 'week-axis';
  for (let h = HOUR_START; h < HOUR_END; h++) {
    const label = document.createElement('div');
    label.className = 'week-axis-label';
    label.textContent = `${pad2(h)}:00`;
    axis.appendChild(label);
  }
  body.appendChild(axis);

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const dateStr = formatDate(day);

    const col = document.createElement('div');
    col.className = 'week-col';
    if (isSameDay(day, today)) col.classList.add('today');
    col.style.height = `${(HOUR_END - HOUR_START) * SLOT_HEIGHT}px`;

    for (let h = HOUR_START; h < HOUR_END; h++) {
      const slot = document.createElement('div');
      slot.className = 'week-slot';
      slot.style.top = `${(h - HOUR_START) * SLOT_HEIGHT}px`;
      slot.style.height = `${SLOT_HEIGHT}px`;
      makeDropTarget(slot, () => ({
        date: dateStr,
        start: minutesToTime(h * 60),
      }));
      col.appendChild(slot);
    }

    for (const evt of store.getByDate(dateStr)) {
      const startMin = timeToMinutes(evt.start);
      const endMin = timeToMinutes(evt.end);
      if (Number.isNaN(startMin) || Number.isNaN(endMin)) continue;
      const block = document.createElement('button');
      block.type = 'button';
      block.className = 'week-event';
      block.style.setProperty('--evt-color', evt.color);
      block.style.top = `${((startMin - HOUR_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT}px`;
      block.style.height = `${Math.max(
        ((endMin - startMin) / SLOT_MINUTES) * SLOT_HEIGHT - 2,
        20
      )}px`;
      block.innerHTML = `<span class="week-event-time">${evt.start} - ${evt.end}</span><span class="week-event-title"></span>`;
      block.querySelector('.week-event-title').textContent = evt.title;
      block.addEventListener('click', () => onEventClick(evt.id));
      makeDraggable(block, evt);
      col.appendChild(block);
    }

    body.appendChild(col);
  }

  wrap.appendChild(body);
  container.appendChild(wrap);
}
