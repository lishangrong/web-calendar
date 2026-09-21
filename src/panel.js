import { store } from './store.js';
import { showError, showSuccess } from './toast.js';
import { isValidDateStr, isValidTime, timeToMinutes } from './utils/date.js';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

let panelEl = null;
let overlayEl = null;

function ensureMounted() {
  if (panelEl) return;
  const root = document.getElementById('panel-root');
  overlayEl = document.createElement('div');
  overlayEl.className = 'panel-overlay';
  panelEl = document.createElement('aside');
  panelEl.className = 'event-panel';
  panelEl.setAttribute('role', 'dialog');
  root.appendChild(overlayEl);
  root.appendChild(panelEl);
  overlayEl.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelEl.classList.contains('open')) closePanel();
  });
}

export function closePanel() {
  if (!panelEl) return;
  panelEl.classList.remove('open');
  overlayEl.classList.remove('open');
}

function openShell() {
  ensureMounted();
  panelEl.classList.add('open');
  overlayEl.classList.add('open');
}

/** 根据事件 ID 加载数据并展示详情 */
export function openEventPanel(eventId, { onChanged } = {}) {
  const event = store.getById(eventId);
  if (!event) {
    showError('事件不存在或已被删除');
    return;
  }
  openShell();
  renderDetail(event, { onChanged });
}

export function openCreatePanel(dateStr, { onChanged } = {}) {
  openShell();
  renderForm(
    {
      title: '',
      date: dateStr,
      start: '09:00',
      end: '10:00',
      description: '',
      color: COLORS[0],
    },
    { mode: 'create', onChanged }
  );
}

function renderDetail(event, { onChanged }) {
  panelEl.innerHTML = '';
  panelEl.append(
    header('事件详情'),
    section('标题', event.title),
    section('日期', event.date),
    section('时间', `${event.start} - ${event.end}`),
    section('描述', event.description || '（无）')
  );

  const actions = document.createElement('div');
  actions.className = 'panel-actions';

  const editBtn = button('编辑', 'btn btn-primary', () => {
    const fresh = store.getById(event.id);
    if (!fresh) return showError('事件不存在或已被删除');
    renderForm({ ...fresh }, { mode: 'edit', onChanged });
  });

  const deleteBtn = button('删除', 'btn btn-danger', () => {
    renderDeleteConfirm(event, { onChanged });
  });

  actions.append(editBtn, deleteBtn);
  panelEl.appendChild(actions);
}

function renderDeleteConfirm(event, { onChanged }) {
  const box = document.createElement('div');
  box.className = 'confirm-box';
  const tip = document.createElement('p');
  tip.textContent = `确定删除「${event.title}」吗？此操作不可撤销。`;
  const row = document.createElement('div');
  row.className = 'panel-actions';

  const confirmBtn = button('确认删除', 'btn btn-danger', async () => {
    confirmBtn.disabled = true;
    try {
      await store.remove(event.id);
      showSuccess('事件已删除');
      closePanel();
      onChanged?.();
    } catch (err) {
      confirmBtn.disabled = false;
      showError(`删除失败：${err.message}`);
    }
  });
  const cancelBtn = button('取消', 'btn', () => renderDetail(event, { onChanged }));

  row.append(confirmBtn, cancelBtn);
  box.append(tip, row);
  panelEl.appendChild(box);
}

function renderForm(event, { mode, onChanged }) {
  panelEl.innerHTML = '';
  panelEl.appendChild(header(mode === 'create' ? '新建事件' : '编辑事件'));

  const form = document.createElement('form');
  form.className = 'panel-form';
  form.noValidate = true;

  const titleInput = field(form, '标题 *', 'input', event.title);
  titleInput.maxLength = 80;
  const dateInput = field(form, '日期 *', 'input', event.date);
  dateInput.type = 'date';
  dateInput.required = true;
  const startInput = field(form, '开始时间 *', 'input', event.start);
  startInput.type = 'time';
  startInput.required = true;
  const endInput = field(form, '结束时间 *', 'input', event.end);
  endInput.type = 'time';
  endInput.required = true;
  const descInput = field(form, '描述', 'textarea', event.description);

  const colorRow = document.createElement('div');
  colorRow.className = 'color-row';
  let selectedColor = event.color;
  for (const c of COLORS) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'color-dot';
    dot.style.background = c;
    if (c === selectedColor) dot.classList.add('selected');
    dot.addEventListener('click', () => {
      selectedColor = c;
      colorRow.querySelectorAll('.color-dot').forEach((d) => d.classList.remove('selected'));
      dot.classList.add('selected');
    });
    colorRow.appendChild(dot);
  }
  form.appendChild(colorRow);

  const errorEl = document.createElement('p');
  errorEl.className = 'form-error';
  form.appendChild(errorEl);

  const actions = document.createElement('div');
  actions.className = 'panel-actions';
  const submitBtn = button(mode === 'create' ? '创建' : '保存', 'btn btn-primary', null);
  submitBtn.type = 'submit';
  const cancelBtn = button('取消', 'btn', () => {
    // 取消编辑：不修改任何数据
    if (mode === 'edit') renderDetail(store.getById(event.id) ?? event, { onChanged });
    else closePanel();
  });
  actions.append(submitBtn, cancelBtn);
  form.appendChild(actions);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const payload = {
      title: titleInput.value,
      date: dateInput.value,
      start: startInput.value,
      end: endInput.value,
      description: descInput.value,
      color: selectedColor,
    };

    const errors = validate(payload);
    if (errors.length) {
      errorEl.textContent = errors.join('；');
      return;
    }

    submitBtn.disabled = true;
    try {
      if (mode === 'create') {
        await store.create(payload);
        showSuccess('事件已创建');
      } else {
        await store.update(event.id, payload);
        showSuccess('事件已更新');
      }
      closePanel();
      onChanged?.(); // 编辑成功后刷新日历
    } catch (err) {
      submitBtn.disabled = false;
      errorEl.textContent = `操作失败：${err.message}`;
    }
  });

  panelEl.appendChild(form);
}

function validate(payload) {
  const errors = [];
  if (!payload.title.trim()) errors.push('标题不能为空');
  if (!isValidDateStr(payload.date)) errors.push('日期无效');
  if (!isValidTime(payload.start)) errors.push('开始时间格式须为 HH:mm');
  if (!isValidTime(payload.end)) errors.push('结束时间格式须为 HH:mm');
  if (
    isValidTime(payload.start) &&
    isValidTime(payload.end) &&
    timeToMinutes(payload.end) <= timeToMinutes(payload.start)
  ) {
    errors.push('结束时间必须晚于开始时间');
  }
  return errors;
}

function header(text) {
  const wrap = document.createElement('div');
  wrap.className = 'panel-header';
  const h = document.createElement('h2');
  h.textContent = text;
  const close = button('✕', 'btn btn-icon', closePanel);
  close.setAttribute('aria-label', '关闭');
  wrap.append(h, close);
  return wrap;
}

function section(label, value) {
  const div = document.createElement('div');
  div.className = 'panel-section';
  const dt = document.createElement('span');
  dt.className = 'panel-label';
  dt.textContent = label;
  const dd = document.createElement('p');
  dd.className = 'panel-value';
  dd.textContent = value;
  div.append(dt, dd);
  return div;
}

function field(form, label, tag, value) {
  const wrap = document.createElement('label');
  wrap.className = 'form-field';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement(tag);
  input.value = value ?? '';
  wrap.append(span, input);
  form.appendChild(wrap);
  return input;
}

function button(text, className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = text;
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}
