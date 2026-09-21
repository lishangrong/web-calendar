import './style.css';
import { addDays, addMonths } from './dateUtils.js';
import { createEventPanel } from './eventPanel.js';
import { createMonthView } from './monthView.js';
import { store } from './store.js';
import { toast } from './toast.js';
import { createWeekView } from './weekView.js';

const root = document.getElementById('calendar-root');
const titleEl = document.getElementById('view-title');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');
const todayBtn = document.getElementById('btn-today');
const switchBtns = document.querySelectorAll('.switch-btn');

const panel = createEventPanel();

let currentView = 'month';
let view = null;

/**
 * 拖拽结束后的统一更新入口。
 * store 采用“先校验后写入”，失败时数据不变；视图订阅 store 后会自动重渲染，
 * 因此更新失败即恢复原数据，同时给出错误提示。
 */
async function applyDragChange(id, patch) {
  try {
    await store.update(id, patch);
  } catch (err) {
    toast(err.message || '更新失败，已恢复原时间');
  }
}

function mountView(name) {
  currentView = name;
  const anchor = view ? view.getAnchor() : new Date();
  view?.destroy?.();
  root.replaceChildren();

  const common = {
    store,
    onEditEvent: (id) => panel.openEvent(id),
    onCreateOnDate: (dateKey, preset) => panel.openCreate(dateKey, preset),
    onMoveEvent: applyDragChange,
    onResizeEvent: applyDragChange,
  };

  view = name === 'month' ? createMonthView(common) : createWeekView(common);
  view.setAnchor(anchor);
  root.appendChild(view.root);
  titleEl.textContent = view.title();
}

prevBtn.addEventListener('click', () => {
  if (currentView === 'month') view.setAnchor(addMonths(view.getAnchor(), -1));
  else view.setAnchor(addDays(view.getAnchor(), -7));
  titleEl.textContent = view.title();
});

nextBtn.addEventListener('click', () => {
  if (currentView === 'month') view.setAnchor(addMonths(view.getAnchor(), 1));
  else view.setAnchor(addDays(view.getAnchor(), 7));
  titleEl.textContent = view.title();
});

todayBtn.addEventListener('click', () => {
  view.setAnchor(new Date());
  titleEl.textContent = view.title();
});

switchBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    switchBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
    mountView(btn.dataset.view);
  });
});

// 标题随视图内部重渲染（如 store 变更）保持同步
store.subscribe(() => {
  if (view) titleEl.textContent = view.title();
});

// 测试开关：让下一次 create/update/remove 失败，用于验证拖拽/编辑失败回滚
window.__simulateNextWriteFail = () => {
  store.setFailNextWrite();
  toast('已开启：下一次保存将失败（用于测试回滚）', 'info');
};

mountView('month');
