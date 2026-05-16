// 全局 toast 通知系统，不依赖任何 UI 库
let toastContainer = null

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.id = 'toast-container'
    toastContainer.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 9999;
      display: flex; flex-direction: column; gap: 8px;
      pointer-events: none;
    `
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

function createToast(message, type = 'info', duration = 3000) {
  const colors = {
    info:    { bg: '#e0f2fe', border: '#38bdf8', text: '#0369a1', icon: 'ℹ️' },
    success: { bg: '#dcfce7', border: '#4ade80', text: '#15803d', icon: '✅' },
    error:   { bg: '#fee2e2', border: '#f87171', text: '#b91c1c', icon: '❌' },
    warn:    { bg: '#fef9c3', border: '#facc15', text: '#854d0e', icon: '⚠️' },
    loading: { bg: '#f3e8ff', border: '#c084fc', text: '#7e22ce', icon: '⏳' },
  }
  const c = colors[type] || colors.info
  const el = document.createElement('div')
  el.style.cssText = `
    background: ${c.bg}; border: 1.5px solid ${c.border}; color: ${c.text};
    padding: 10px 16px; border-radius: 12px; font-size: 14px; font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1); pointer-events: auto;
    display: flex; align-items: center; gap: 8px;
    animation: slideInRight 0.3s ease-out;
    max-width: 320px; word-break: break-word;
  `
  el.innerHTML = `<span>${c.icon}</span><span>${message}</span>`

  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0);    opacity: 1; }
      to   { transform: translateX(100%); opacity: 0; }
    }
  `
  if (!document.getElementById('toast-styles')) {
    style.id = 'toast-styles'
    document.head.appendChild(style)
  }

  getContainer().appendChild(el)

  if (duration > 0) {
    setTimeout(() => {
      el.style.animation = 'slideOutRight 0.3s ease-in forwards'
      setTimeout(() => el.remove(), 300)
    }, duration)
  }

  return el
}

export const toast = {
  info:    (msg, duration)  => createToast(msg, 'info',    duration),
  success: (msg, duration)  => createToast(msg, 'success', duration),
  error:   (msg, duration)  => createToast(msg, 'error',   duration ?? 5000),
  warn:    (msg, duration)  => createToast(msg, 'warn',    duration),
  loading: (msg) => {
    const el = createToast(msg, 'loading', 0)
    return { dismiss: () => el.remove() }
  },
}
