/**
 * 事件详情 / 编辑 / 新建 侧边面板。
 * - 详情模式：标题、日期、时间、描述，支持编辑 / 删除
 * - 删除必须二次确认
 * - 标题不能为空；时间使用统一 YYYY-MM-DDTHH:mm 格式
 * - 操作失败时保留面板并展示错误提示，不修改已有数据
 */
import { formatFullLabel, formatTime, parseDateTime } from './dateUtils.js';
import { store } from './store.js';
import { toast } from './toast.js';

const COLORS = ['#4f8cff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function createEventPanel() {
  const host = document.getElementById('panel-root');

  const overlay = document.createElement('div');
  overlay.className = 'panel-overlay';

  const panel = document.createElement('aside');
  panel.className = 'event-panel';

  host.append(overlay, panel);

  function close() {
    panel.classList.remove('is-open');
    overlay.classList.remove('is-open');
  }

  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  /** 根据事件 ID 加载数据并打开详情 */
  function openEvent(id) {
    const evt = store.getById(id);
    if (!evt) {
      toast('未找到该事件，可能已被删除');
      return;
    }
    renderDetail(evt);
    show();
  }

  /** 新建：preset 可包含 start/end（来自点击日期/时间格） */
  function openCreate(dateKey, preset = {}) {
    const fallbackStart = new Date();
    fallbackStart.setMinutes(60, 0, 0);
    const start = preset.start || `${dateKey}T09:00`;
    const end = preset.end || `${dateKey}T10:00`;
    renderForm(
      { title: '', start, end, description: '', color: COLORS[0] },
      '新建事件',
      true,
    );
    show();
  }

  function show() {
    overlay.classList.add('is-open');
    panel.classList.add('is-open');
  }

  function renderDetail(evt) {
    panel.replaceChildren();

    const header = document.createElement('header');
    header.className = 'panel-header';
    const colorDot = document.createElement('span');
    colorDot.className = 'panel-color-dot';
    colorDot.style.background = evt.color || '#4f8cff';
    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = evt.title;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn icon-btn panel-close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', '关闭');
    closeBtn.addEventListener('click', close);
    header.append(colorDot, title, closeBtn);

    const body = document.createElement('div');
    body.className = 'panel-body';

    const timeRow = document.createElement('div');
    timeRow.className = 'panel-row';
    timeRow.innerHTML = `<span class="panel-label">时间</span><span class="panel-value"></span>`;
    timeRow.querySelector('.panel-value').textContent =
      `${formatFullLabel(evt.start)} – ${formatTime(parseDateTime(evt.end))}`;

    const descRow = document.createElement('div');
    descRow.className = 'panel-row';
    descRow.innerHTML = `<span class="panel-label">描述</span><div class="panel-value panel-desc"></div>`;
    descRow.querySelector('.panel-desc').textContent = evt.description || '（无）';

    body.append(timeRow, descRow);

    const footer = document.createElement('footer');
    footer.className = 'panel-footer';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-primary';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', () => renderForm(evt, '编辑事件', false));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '删除';

    deleteBtn.addEventListener('click', async () => {
      // 二次确认：第一次点击进入确认态，第二次才真正删除
      if (!deleteBtn.classList.contains('is-confirming')) {
        deleteBtn.classList.add('is-confirming');
        deleteBtn.textContent = '再次点击确认删除';
        cancelConfirmBtn.hidden = false;
        return;
      }
      deleteBtn.disabled = true;
      try {
        await store.remove(evt.id);
        close(); // 删除成功立即关闭，日历通过订阅自动刷新，事件立即消失
      } catch (err) {
        toast(err.message || '删除失败');
        deleteBtn.disabled = false;
      }
    });

    const cancelConfirmBtn = document.createElement('button');
    cancelConfirmBtn.className = 'btn';
    cancelConfirmBtn.textContent = '取消删除';
    cancelConfirmBtn.hidden = true;
    cancelConfirmBtn.addEventListener('click', () => {
      deleteBtn.classList.remove('is-confirming');
      deleteBtn.textContent = '删除';
      cancelConfirmBtn.hidden = true;
    });

    footer.append(editBtn, deleteBtn, cancelConfirmBtn);
    panel.append(header, body, footer);
  }

  function renderForm(evt, heading, isCreate) {
    panel.replaceChildren();

    const header = document.createElement('header');
    header.className = 'panel-header';
    const titleEl = document.createElement('h2');
    titleEl.className = 'panel-title';
    titleEl.textContent = heading;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn icon-btn panel-close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', '关闭');
    header.append(titleEl, closeBtn);

    const form = document.createElement('form');
    form.className = 'panel-body event-form';
    form.noValidate = true;

    const formState = { ...evt };

    const titleGroup = field('标题', () => {
      const input = document.createElement('input');
      input.className = 'form-input';
      input.type = 'text';
      input.value = formState.title;
      input.placeholder = '必填';
      input.addEventListener('input', () => {
        formState.title = input.value;
        errorEl.textContent = '';
      });
      return input;
    });

    const startGroup = field('开始时间', () => {
      const input = document.createElement('input');
      input.className = 'form-input';
      input.type = 'datetime-local';
      input.step = 60;
      input.value = formState.start;
      input.addEventListener('change', () => {
        formState.start = input.value;
      });
      return input;
    });

    const endGroup = field('结束时间', () => {
      const input = document.createElement('input');
      input.className = 'form-input';
      input.type = 'datetime-local';
      input.step = 60;
      input.value = formState.end;
      input.addEventListener('change', () => {
        formState.end = input.value;
      });
      return input;
    });

    const descGroup = field('描述', () => {
      const textarea = document.createElement('textarea');
      textarea.className = 'form-input';
      textarea.rows = 4;
      textarea.value = formState.description || '';
      textarea.addEventListener('input', () => {
        formState.description = textarea.value;
      });
      return textarea;
    });

    const colorGroup = field('颜色', () => {
      const wrap = document.createElement('div');
      wrap.className = 'color-picker';
      for (const color of COLORS) {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'color-swatch';
        swatch.dataset.color = color;
        if (color === formState.color) swatch.classList.add('is-selected');
        swatch.style.background = color;
        swatch.addEventListener('click', () => {
          formState.color = color;
          wrap
            .querySelectorAll('.color-swatch')
            .forEach((el) => el.classList.toggle('is-selected', el.dataset.color === color));
        });
        wrap.appendChild(swatch);
      }
      return wrap;
    });

    const errorEl = document.createElement('div');
    errorEl.className = 'form-error';

    form.append(
      titleGroup,
      startGroup,
      endGroup,
      descGroup,
      colorGroup,
      errorEl,
    );

    const footer = document.createElement('footer');
    footer.className = 'panel-footer';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.type = 'submit';
    saveBtn.textContent = '保存';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = '取消';
    // 取消编辑直接回到详情/关闭，不修改任何原数据
    cancelBtn.addEventListener('click', () => {
      if (isCreate) close();
      else renderDetail(store.getById(evt.id));
    });

    closeBtn.addEventListener('click', () => {
      if (isCreate) close();
      else renderDetail(store.getById(evt.id));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';

      if (!formState.title.trim()) {
        errorEl.textContent = '标题不能为空';
        return;
      }
      if (!parseDateTime(formState.start)) {
        errorEl.textContent = '开始时间格式无效（需为 YYYY-MM-DDTHH:mm）';
        return;
      }
      if (!parseDateTime(formState.end)) {
        errorEl.textContent = '结束时间格式无效（需为 YYYY-MM-DDTHH:mm）';
        return;
      }
      if (parseDateTime(formState.end) <= parseDateTime(formState.start)) {
        errorEl.textContent = '结束时间必须晚于开始时间';
        return;
      }

      saveBtn.disabled = true;
      try {
        if (isCreate) {
          await store.create({
            title: formState.title,
            start: formState.start,
            end: formState.end,
            description: formState.description,
            color: formState.color,
          });
        } else {
          await store.update(evt.id, {
            title: formState.title.trim(),
            start: formState.start,
            end: formState.end,
            description: formState.description,
            color: formState.color,
          });
        }
        // 编辑成功后 store 订阅会刷新日历
        close();
      } catch (err) {
        errorEl.textContent = err.message || '保存失败，请重试';
        toast(err.message || '保存失败');
      } finally {
        saveBtn.disabled = false;
      }
    });

    footer.append(saveBtn, cancelBtn);
    panel.append(header, form, footer);

    function field(labelText, buildControl) {
      const group = document.createElement('label');
      group.className = 'form-field';
      const span = document.createElement('span');
      span.className = 'form-label';
      span.textContent = labelText;
      group.append(span, buildControl());
      return group;
    }
  }

  return { openEvent, openCreate, close };
}
