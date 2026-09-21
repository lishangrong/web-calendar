import {
  DAY_MS,
  MINUTE_MS,
  SNAP_MINUTES,
  WEEKDAY_LABELS,
  eventOccursOnDay,
  formatDateKey,
  formatTime,
  getWeekDays,
  isSameDay,
  parseDateTime,
  startOfDay,
} from './dateUtils.js';
import { beginDrag, createGhost } from './drag.js';
import { toLocalDateTime } from './monthView.js';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function snapMinutes(value) {
  return Math.max(0, Math.min(24 * 60 - SNAP_MINUTES, Math.round(value / SNAP_MINUTES) * SNAP_MINUTES));
}

export function createWeekView({ store, onEditEvent, onCreateOnDate, onMoveEvent, onResizeEvent }) {
  const root = document.createElement('div');
  root.className = 'week-view';
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

  const getAnchor = () => anchor;

  function title() {
    const days = getWeekDays(anchor);
    const first = days[0];
    const last = days[6];
    return `${first.getMonth() + 1}月${first.getDate()}日 – ${last.getMonth() + 1}月${last.getDate()}日`;
  }

  function hourHeight() {
    return parseFloat(getComputedStyle(root).getPropertyValue('--hour-height')) || 56;
  }

  function yToMinutes(y, gridBody) {
    const rect = gridBody.getBoundingClientRect();
    return ((y - rect.top) / hourHeight()) * 60;
  }

  function render() {
    const days = getWeekDays(anchor);
    const today = new Date();
    root.replaceChildren();

    const scroll = document.createElement('div');
    scroll.className = 'week-scroll';

    const grid = document.createElement('div');
    grid.className = 'week-grid';

    // 表头：占位 + 7 天
    const corner = document.createElement('div');
    corner.className = 'week-corner';
    grid.appendChild(corner);
    for (const day of days) {
      const head = document.createElement('div');
      head.className = 'week-day-head';
      if (isSameDay(day, today)) head.classList.add('is-today');
      head.innerHTML = `<span class="week-day-name">周${WEEKDAY_LABELS[(day.getDay() + 6) % 7]}</span
        ><span class="week-day-num">${day.getDate()}</span>`;
      grid.appendChild(head);
    }

    // 时间刻度列
    const gutter = document.createElement('div');
    gutter.className = 'week-gutter';
    for (const h of HOURS) {
      const tick = document.createElement('div');
      tick.className = 'week-hour-tick';
      tick.textContent = `${String(h).padStart(2, '0')}:00`;
      gutter.appendChild(tick);
    }
    grid.appendChild(gutter);

    const body = document.createElement('div');
    body.className = 'week-body';

    for (const day of days) {
      body.appendChild(createDayColumn(day));
    }
    grid.appendChild(body);

    // 落点提示线
    const marker = document.createElement('div');
    marker.className = 'week-dropmarker';
    marker.hidden = true;
    body.appendChild(marker);

    scroll.appendChild(grid);
    root.appendChild(scroll);

    // 初始滚动到 7:30
    scroll.scrollTop = hourHeight() * 7.5;

    drawNowIndicator(grid, days);

    function createDayColumn(day) {
      const col = document.createElement('div');
      col.className = 'week-day-col';
      col.dataset.date = formatDateKey(day);

      for (const h of HOURS) {
        const slot = document.createElement('div');
        slot.className = 'week-hour-slot';
        slot.style.height = `${hourHeight()}px`;
        col.appendChild(slot);
      }

      // 点击空白时间格：在该时刻新建事件
      col.addEventListener('click', (e) => {
        if (e.target.closest('.week-event')) return;
        const mins = snapMinutes(yToMinutes(e.clientY, body));
        const startDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        startDate.setMinutes(mins);
        const endDate = new Date(startDate.getTime() + 60 * MINUTE_MS);
        onCreateOnDate?.(formatDateKey(day), {
          start: toLocalDateTime(startDate),
          end: toLocalDateTime(endDate),
        });
      });

      // 当天事件（跨天事件裁剪为当天片段）
      const dayMs = startOfDay(day).getTime();
      for (const evt of events) {
        if (!eventOccursOnDay(evt, day)) continue;
        const evtStart = parseDateTime(evt.start).getTime();
        const evtEnd = parseDateTime(evt.end).getTime();
        const segStart = Math.max(evtStart, dayMs);
        const segEnd = Math.min(evtEnd, dayMs + DAY_MS);
        col.appendChild(createEventBlock(evt, day, segStart, segEnd));
      }

      return col;
    }

    function drawNowIndicator(gridEl, days) {
      const now = new Date();
      if (!days.some((d) => isSameDay(d, now))) return;
      const mins = now.getHours() * 60 + now.getMinutes();
      const line = document.createElement('div');
      line.className = 'week-now-line';
      line.style.top = `${(mins / 60) * hourHeight()}px`;
      const dot = document.createElement('span');
      dot.className = 'week-now-dot';
      line.appendChild(dot);
      body.appendChild(line);
    }

    function locatePoint(x, y) {
      const colEl = document
        .elementFromPoint(x, y)
        ?.closest('.week-day-col');
      if (!colEl || !body.contains(colEl)) return null;
      const dateKey = colEl.dataset.date;
      const mins = snapMinutes(yToMinutes(y, body));
      return { dateKey, mins, col: colEl };
    }

    function showMarker(loc, topMinutes, heightMinutes, label) {
      const colIndex = [...body.children].indexOf(loc.col);
      if (colIndex < 0 || topMinutes < 0 || heightMinutes <= 0) {
        hideMarker();
        return;
      }
      const colWidth = loc.col.getBoundingClientRect().width;
      marker.hidden = false;
      marker.style.left = `${colIndex * colWidth}px`;
      marker.style.width = `${colWidth}px`;
      marker.style.top = `${(topMinutes / 60) * hourHeight()}px`;
      marker.style.height = `${(heightMinutes / 60) * hourHeight()}px`;
      marker.textContent = label;
    }

    function hideMarker() {
      marker.hidden = true;
    }

    function createEventBlock(evt, day, segStartMs, segEndMs) {
      const block = document.createElement('div');
      block.className = 'week-event';
      block.dataset.eventId = evt.id;
      block.style.setProperty('--evt-color', evt.color || '#4f8cff');

      const dayMs = startOfDay(day).getTime();
      const topMin = ((segStartMs - dayMs) / MINUTE_MS);
      const heightMin = Math.max(SNAP_MINUTES, (segEndMs - segStartMs) / MINUTE_MS);
      block.style.top = `${(topMin / 60) * hourHeight()}px`;
      block.style.height = `${(heightMin / 60) * hourHeight()}px`;

      const isStartDay = parseDateTime(evt.start).getTime() === segStartMs;
      const isEndDay = parseDateTime(evt.end).getTime() === segEndMs;
      if (!isStartDay) block.classList.add('is-continued');
      if (!isEndDay) block.classList.add('is-continues');

      const label = document.createElement('span');
      label.className = 'week-event-label';
      label.textContent = `${formatTime(parseDateTime(evt.start))} ${evt.title}`;
      block.appendChild(label);

      // 仅在结束片段显示调整大小手柄
      if (isEndDay) {
        const handle = document.createElement('div');
        handle.className = 'week-resize-handle';
        block.appendChild(handle);
        handle.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          startResize(e, evt, block);
        });
      }

      block.addEventListener('pointerdown', (downEvt) => {
        if (downEvt.target.closest('.week-resize-handle')) return;
        if (typeof downEvt.button === 'number' && downEvt.button !== 0) return;
        startMove(downEvt, evt, block);
      });

      return block;
    }

    function startMove(downEvt, evt, block) {
      const durationMin =
        (parseDateTime(evt.end).getTime() - parseDateTime(evt.start).getTime()) / MINUTE_MS;
      let ghost = null;

      beginDrag(downEvt, {
        onStart: () => block.classList.add('is-dragging'),
        onMove: ({ x, y }) => {
          if (!ghost) ghost = createGhost(evt.title, evt.color);
          const loc = locatePoint(x, y);
          if (!loc) {
            hideMarker();
            ghost.update(x, y, '');
            return;
          }
          const endMin = Math.min(24 * 60, loc.mins + durationMin);
          showMarker(
            loc,
            loc.mins,
            endMin - loc.mins,
            `${loc.dateKey} ${String(Math.floor(loc.mins / 60)).padStart(2, '0')}:${String(
              loc.mins % 60,
            ).padStart(2, '0')}`,
          );
          const [ey, em] = [Math.floor(endMin / 60), endMin % 60];
          ghost.update(
            x,
            y,
            `${String(Math.floor(loc.mins / 60)).padStart(2, '0')}:${String(
              loc.mins % 60,
            ).padStart(2, '0')} – ${String(ey).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
          );
        },
        onEnd: ({ x, y }) => {
          block.classList.remove('is-dragging');
          hideMarker();
          ghost?.destroy();
          const loc = locatePoint(x, y);
          if (!loc) return;
          const newStart = new Date(
            parseDateTime(`${loc.dateKey}T00:00`).getTime() + loc.mins * MINUTE_MS,
          );
          const newEnd = new Date(newStart.getTime() + durationMin * MINUTE_MS);
          const patch = {
            start: toLocalDateTime(newStart),
            end: toLocalDateTime(newEnd),
          };
          if (patch.start === evt.start && patch.end === evt.end) return;
          onMoveEvent?.(evt.id, patch, evt);
        },
        onCancel: () => {
          block.classList.remove('is-dragging');
          hideMarker();
          ghost?.destroy();
        },
        onTap: () => onEditEvent?.(evt.id),
      });
    }

    function startResize(downEvt, evt, block) {
      let ghost = null;

      beginDrag(downEvt, {
        onStart: () => block.classList.add('is-resizing'),
        onMove: ({ x, y }) => {
          if (!ghost) ghost = createGhost(`${evt.title}（调整时长）`, evt.color);
          const loc = locatePoint(x, y);
          if (!loc) {
            hideMarker();
            ghost.update(x, y, '');
            return;
          }
          // 以指针所在列的日期为基准，允许把结束时间拖到次日（跨日调整）
          const locDayMs = parseDateTime(`${loc.dateKey}T00:00`).getTime();
          const startMin = (parseDateTime(evt.start).getTime() - locDayMs) / MINUTE_MS;
          const endMin = snapMinutes(loc.mins);
          if (endMin <= startMin || endMin > 24 * 60) {
            ghost.update(x, y, '时长不能少于 15 分钟');
            return;
          }
          showMarker(loc, startMin, endMin - startMin, '');
          ghost.update(
            x,
            y,
            `结束于 ${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(
              endMin % 60,
            ).padStart(2, '0')}`,
          );
        },
        onEnd: ({ x, y }) => {
          block.classList.remove('is-resizing');
          hideMarker();
          ghost?.destroy();
          const loc = locatePoint(x, y);
          if (!loc) return;
          const locDayMs = parseDateTime(`${loc.dateKey}T00:00`).getTime();
          const startMs = parseDateTime(evt.start).getTime();
          const endMin = snapMinutes(loc.mins);
          const newEndMs = locDayMs + endMin * MINUTE_MS;
          if (newEndMs - startMs < SNAP_MINUTES * MINUTE_MS) return;
          const newEndStr = toLocalDateTime(new Date(newEndMs));
          if (newEndStr === evt.end) return;
          onResizeEvent?.(evt.id, { end: newEndStr }, evt);
        },
        onCancel: () => {
          block.classList.remove('is-resizing');
          hideMarker();
          ghost?.destroy();
        },
      });
    }
  }

  render();
  return { root, setAnchor, getAnchor, title, destroy: unsubscribe };
}
