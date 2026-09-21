const root = () => document.getElementById('toast-root');

export function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  root().appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 3200);
}

export const showError = (msg) => toast(msg, 'error');
export const showSuccess = (msg) => toast(msg, 'success');
