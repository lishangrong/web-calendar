import { store } from '../store.js';
import { makeDraggable, makeDropTarget } from '../dnd.js';
import {
  addDays,
  formatDate,
  isSameDay,
  startOfMonth,
  startOfWeek,
} from '../utils/date.js';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export function renderMonthView(container, cursor, { onDateClick, onEventClick }) {
  container.innerHTML = '';
  const today = new Date();
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);

  const grid = document.createElement('div');
  grid.className = 'month-grid';

  for (const label of WEEKDAYS) {
    const head = document.createElement('div');
    head.className = 'month-weekday';
    head.textContent = label;
    grid.appendChild(head);
  }

  // 真实日历结构：固定 6 行 x 7 列，包含上月/下月补齐日期
  for (let i = 0; i < 42; i++) {
    const day = addDays(gridStart, i);
    const dateStr = formatDate(day);
    const inMonth = day.getMonth() === cursor.getMonth();

    const cell = document.createElement('div');
    cell.className = 'month-cell';
    if (!inMonth) cell.classList.add('other-month');
    if (isSameDay(day, today)) cell.classList.add('today');
    cell.dataset.date = dateStr;

    const num = document.createElement('button');
    num.type = 'button';
    num.className = 'month-day-num';
    num.textContent = String(day.getDate());
    num.addEventListener('click', () => onDateClick(dateStr));
    cell.appendChild(num);

    const list = document.createElement('div');
    list.className = 'month-events';
    for (const evt of store.getByDate(dateStr)) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'event-chip';
      chip.style.setProperty('--evt-color', evt.color);
      chip.textContent = `${evt.start} ${evt.title}`;
      chip.title = evt.title;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        onEventClick(evt.id);
      });
      makeDraggable(chip, evt);
      list.appendChild(chip);
    }
    cell.appendChild(list);

    makeDropTarget(cell, () => ({ date: dateStr }));
    grid.appendChild(cell);
  }

  container.appendChild(grid);
}
