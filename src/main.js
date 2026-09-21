import './style.css';
import { store } from './store.js';
import { renderMonthView } from './views/monthView.js';
import { renderWeekView } from './views/weekView.js';
import { closePanel, openCreatePanel, openEventPanel } from './panel.js';
import { formatDate } from './utils/date.js';

const state = {
  view: 'month', // 'month' | 'week'
  cursor: new Date(),
};

const rootEl = document.getElementById('calendar-root');
const labelEl = document.getElementById('toolbar-label');

function render() {
  labelEl.textContent =
    state.view === 'month'
      ? `${state.cursor.getFullYear()} 年 ${state.cursor.getMonth() + 1} 月`
      : weekLabel();

  const handlers = {
    onDateClick: (dateStr) => openCreatePanel(dateStr, { onChanged: render }),
    onEventClick: (id) => openEventPanel(id, { onChanged: render }),
  };

  if (state.view === 'month') renderMonthView(rootEl, state.cursor, handlers);
  else renderWeekView(rootEl, state.cursor, handlers);
}

function weekLabel() {
  const d = state.cursor;
  const day = d.getDay();
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return `${formatDate(monday)} ~ ${formatDate(sunday)}`;
}

function switchView(view) {
  state.view = view;
  document.getElementById('view-month').classList.toggle('active', view === 'month');
  document.getElementById('view-week').classList.toggle('active', view === 'week');
  render();
}

function shift(delta) {
  const c = state.cursor;
  state.cursor =
    state.view === 'month'
      ? new Date(c.getFullYear(), c.getMonth() + delta, 1)
      : new Date(c.getFullYear(), c.getMonth(), c.getDate() + delta * 7);
  render();
}

document.getElementById('btn-prev').addEventListener('click', () => shift(-1));
document.getElementById('btn-next').addEventListener('click', () => shift(1));
document.getElementById('btn-today').addEventListener('click', () => {
  state.cursor = new Date();
  render();
});
document.getElementById('view-month').addEventListener('click', () => switchView('month'));
document.getElementById('view-week').addEventListener('click', () => switchView('week'));
document.getElementById('btn-new-event').addEventListener('click', () =>
  openCreatePanel(formatDate(state.cursor), { onChanged: render })
);

// 数据变化（拖拽、编辑、删除）后自动刷新日历
store.subscribe(() => {
  if (document.getElementById('calendar-root').isConnected) render();
});

store.load().then(render);
