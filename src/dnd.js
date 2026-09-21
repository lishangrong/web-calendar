import { store } from './store.js';
import { showError, showSuccess } from './toast.js';
import { minutesToTime, timeToMinutes } from './utils/date.js';

const MIME = 'application/x-calendar-event';

let dragState = null;

export function makeDraggable(el, event) {
  el.draggable = true;
  el.dataset.eventId = event.id;

  el.addEventListener('dragstart', (e) => {
    const fresh = store.getById(event.id);
    if (!fresh) return;
    dragState = { original: { ...fresh } };
    e.dataTransfer.setData(MIME, event.id);
    e.dataTransfer.effectAllowed = 'move';
    // 视觉反馈：拖拽中的源元素半透明，其余位置显示克隆影像
    requestAnimationFrame(() => el.classList.add('dragging'));
    document.body.classList.add('dnd-active');
  });

  el.addEventListener('dragend', () => {
    // 无论 drop 是否发生都清理；未 drop（取消）时数据从未变更，天然恢复原状态
    el.classList.remove('dragging');
    document.body.classList.remove('dnd-active');
    clearDropHints();
    dragState = null;
  });
}

/**
 * Make an element a drop target.
 * getTarget() must return { date: 'YYYY-MM-DD', start?: 'HH:mm' } or null.
 */
export function makeDropTarget(el, getTarget) {
  el.addEventListener('dragover', (e) => {
    if (!dragState) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropHints();
    el.classList.add('drop-target');
  });

  el.addEventListener('dragleave', () => {
    el.classList.remove('drop-target');
  });

  el.addEventListener('drop', async (e) => {
    e.preventDefault();
    clearDropHints();
    const id = e.dataTransfer.getData(MIME);
    if (!id || !dragState) return;

    const target = getTarget();
    const original = dragState.original;
    if (!target || !target.date) return;

    const patch = { date: target.date };
    if (target.start) {
      const duration = timeToMinutes(original.end) - timeToMinutes(original.start);
      const startMin = timeToMinutes(target.start);
      if (Number.isNaN(startMin)) return;
      patch.start = target.start;
      // 保持时长，不允许跨天产生无效时间
      const endMin = Math.min(startMin + duration, 24 * 60 - 1);
      patch.end = minutesToTime(Math.max(endMin, startMin + 15));
    }

    if (
      patch.date === original.date &&
      (!patch.start || patch.start === original.start)
    ) {
      return; // 位置未变化
    }

    try {
      await store.update(id, patch);
      showSuccess(`已更新「${original.title}」的时间`);
    } catch (err) {
      // store 内部已回滚数据，这里仅提示
      showError(`更新失败，已恢复原数据：${err.message}`);
    }
  });
}

function clearDropHints() {
  document
    .querySelectorAll('.drop-target')
    .forEach((el) => el.classList.remove('drop-target'));
}
