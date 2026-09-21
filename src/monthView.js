import {
  DAY_MS,
  WEEKDAY_LABELS,
  eventOccursOnDay,
  formatDateKey,
  formatFullLabel,
  formatTime,
  getMonthGrid,
  isSameDay,
  isSameMonth,
  parseDateTime,
} from './dateUtils.js';
import { beginDrag, createGhost, hitDateKey } from './drag.js';

const MAX_CHIPS = 3;
const pad = (n) => String(n).padStart(2, '0');

/** Date -> 本地统一格式字符串 */
export function toLocalDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function createMonthView({ store, onEditEvent, onCreateOnDate, onMoveEvent }) {
  const root = document.createElement('div');
  root.className = 'month-view';
  let anchor = new Date();
  let events = store.list();

  const unsubscribe = store.subscribe((list) => {
    events = list;
    render();
  });

  function setAnchor(date) {
    anchor = date;
    render();
  }

  function getAnchor() {
    return anchor;
  }

  const title = () => `${anchor.getFullYear()}年 ${anchor.getMonth() + 1}月`;

  function clearHighlights() {
    root.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
  }

  function render() {
    const grid = getMonthGrid(anchor);
    const today = new Date();

    root.replaceChildren();

    const header = document.createElement('div');
    header.className = 'month-header';
    for (const label of WEEKDAY_LABELS) {
      const cell = document.createElement('div');
      cell.className = 'month-weekday';
      cell.textContent = label;
      header.appendChild(cell);
    }
    root.appendChild(header);

    const gridEl = document.createElement('div');
    gridEl.className = 'month-grid';

    for (const day of grid) {
      const dateKey = formatDateKey(day);
      const cell = document.createElement('div');
      cell.className = 'month-cell';
      cell.dataset.date = dateKey;
      if (!isSameMonth(day, anchor)) cell.classList.add('is-other-month');
      if (isSameDay(day, today)) cell.classList.add('is-today');

      const num = document.createElement('div');
      num.className = 'month-date-num';
      num.textContent = day.getDate();
      cell.appendChild(num);

      const chipWrap = document.createElement('div');
      chipWrap.className = 'month-chips';
      renderChips(cell, chipWrap, day, false);
      cell.appendChild(chipWrap);

      cell.addEventListener('click', (e) => {
        if (e.target.closest('.month-chip')) return;
        onCreateOnDate?.(dateKey);
      });

      gridEl.appendChild(cell);
    }

    root.appendChild(gridEl);
  }

  function renderChips(cell, chipWrap, day, expanded) {
    const dayEvents = events.filter((evt) => eventOccursOnDay(evt, day));
    chipWrap.replaceChildren();

    const shown = expanded ? dayEvents : dayEvents.slice(0, MAX_CHIPS);
    for (const evt of shown) chipWrap.appendChild(createChip(evt, day));

    if (!expanded && dayEvents.length > MAX_CHIPS) {
      const more = document.createElement('button');
      more.className = 'month-more';
      more.type = 'button';
      more.textContent = `+${dayEvents.length - MAX_CHIPS} 更多`;
      more.addEventListener('click', (e) => {
        e.stopPropagation();
        cell.classList.add('is-expanded');
        renderChips(cell, chipWrap, day, true);
      });
      chipWrap.appendChild(more);
    } else if (expanded && dayEvents.length > MAX_CHIPS) {
      const less = document.createElement('button');
      less.className = 'month-more';
      less.type = 'button';
      less.textContent = '收起';
      less.addEventListener('click', (e) => {
        e.stopPropagation();
        cell.classList.remove('is-expanded');
        renderChips(cell, chipWrap, day, false);
      });
      chipWrap.appendChild(less);
    }
  }

  function createChip(evt, day) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'month-chip';
    chip.dataset.eventId = evt.id;
    chip.style.setProperty('--chip-color', evt.color || '#4f8cff');

    const start = parseDateTime(evt.start);
    const end = parseDateTime(evt.end);
    const dayStartMs = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const prefix = start.getTime() < dayStartMs ? '↗ ' : '';
    const suffix = end.getTime() > dayStartMs + DAY_MS ? ' ↘' : '';
    chip.textContent = `${prefix}${formatTime(start)} ${evt.title}${suffix}`;

    chip.addEventListener('pointerdown', (downEvt) => {
      if (typeof downEvt.button === 'number' && downEvt.button !== 0) return;

      let ghost = null;
      let currentKey = null;

      beginDrag(downEvt, {
        onStart: () => chip.classList.add('is-dragging'),
        onMove: ({ x, y }) => {
          if (!ghost) ghost = createGhost(evt.title, evt.color);
          const key = hitDateKey(x, y);
          if (key && key !== currentKey) {
            currentKey = key;
            clearHighlights();
            root
              .querySelector(`.month-cell[data-date="${key}"]`)
              ?.classList.add('drag-over');
          }
          const timeOfDay = formatTime(parseDateTime(evt.start));
          ghost.update(x, y, key ? formatFullLabel(`${key}T${timeOfDay}`) : '');
        },
        onEnd: ({ x, y }) => {
          chip.classList.remove('is-dragging');
          clearHighlights();
          if (ghost) ghost.destroy();
          const key = hitDateKey(x, y);
          if (!key || key === formatDateKey(day)) return;

          // 保持事件原有的时刻与时长，整体平移到目标日期
          const timeOfDay = formatTime(parseDateTime(evt.start));
          const newStartStr = `${key}T${timeOfDay}`;
          const newStart = parseDateTime(newStartStr);
          if (!newStart) return; // 兜底，不允许产生无效日期
          const duration = parseDateTime(evt.end).getTime() - parseDateTime(evt.start).getTime();
          const newEnd = new Date(newStart.getTime() + duration);
          onMoveEvent?.(evt.id, { start: newStartStr, end: toLocalDateTime(newEnd) }, evt);
        },
        onCancel: () => {
          chip.classList.remove('is-dragging');
          clearHighlights();
          ghost?.destroy();
          ghost = null;
        },
        onTap: () => onEditEvent?.(evt.id),
      });
    });

    return chip;
  }

  render();
  return { root, setAnchor, getAnchor, title, destroy: unsubscribe };
}
