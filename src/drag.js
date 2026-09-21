/**
 * 基于 Pointer Events 的统一拖拽机制（鼠标 / 触屏通用）。
 * - 移动超过阈值才判定为拖拽，否则视为点击
 * - Escape / pointercancel 触发取消回调，由调用方恢复原状
 */

const DRAG_THRESHOLD = 6;

/**
 * 拖拽结束后浏览器可能仍触发一次 click（落点在日期格/时间格上），
 * 用捕获阶段拦截，避免误开“新建事件”面板。
 */
function suppressClickAfterDrag() {
  const blocker = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener('click', blocker, true);
  setTimeout(() => window.removeEventListener('click', blocker, true), 250);
}

export function beginDrag(downEvt, handlers) {
  const { onStart, onMove, onEnd, onCancel, onTap, threshold = DRAG_THRESHOLD } = handlers;
  const startX = downEvt.clientX;
  const startY = downEvt.clientY;
  let started = false;

  // 阻止触屏滚动（配合 CSS touch-action: none）
  downEvt.preventDefault();

  function cleanup() {
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
    window.removeEventListener('pointercancel', handleCancel);
    window.removeEventListener('keydown', handleKey);
  }

  function handleMove(e) {
    const x = e.clientX;
    const y = e.clientY;
    if (!started && Math.hypot(x - startX, y - startY) < threshold) return;
    if (!started) {
      started = true;
      onStart?.({ x: startX, y: startY });
    }
    e.preventDefault();
    onMove?.({ x, y });
  }

  function handleUp(e) {
    cleanup();
    if (started) onEnd?.({ x: e.clientX, y: e.clientY });
    if (started) suppressClickAfterDrag();
    else onTap?.();
  }

  function handleCancel() {
    cleanup();
    if (started) {
      onCancel?.();
      suppressClickAfterDrag();
    }
  }

  function handleKey(e) {
    if (e.key === 'Escape') handleCancel();
  }

  window.addEventListener('pointermove', handleMove, { passive: false });
  window.addEventListener('pointerup', handleUp);
  window.addEventListener('pointercancel', handleCancel);
  window.addEventListener('keydown', handleKey);
}

/** 跟随指针的悬浮幽灵元素（视觉拖拽反馈） */
export function createGhost(text, color) {
  const el = document.createElement('div');
  el.className = 'drag-ghost';
  el.style.setProperty('--ghost-color', color || '#4f8cff');
  const titleEl = document.createElement('span');
  titleEl.className = 'drag-ghost-title';
  titleEl.textContent = text;
  const hintEl = document.createElement('span');
  hintEl.className = 'drag-ghost-hint';
  el.append(titleEl, hintEl);
  document.body.appendChild(el);

  return {
    el,
    update(x, y, hint) {
      el.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
      hintEl.textContent = hint || '';
    },
    destroy() {
      el.remove();
    },
  };
}

/** 找到指针所在的日期格子，返回其 data-date */
export function hitDateKey(x, y) {
  const el = document.elementFromPoint(x, y)?.closest('[data-date]');
  return el?.dataset.date ?? null;
}
