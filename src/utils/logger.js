import { errorLogStore } from '../store/db.js'

const LOG_LEVELS = { info: 'info', warn: 'warn', error: 'error' }

class Logger {
  async info(message, extra = '') {
    console.info('[INFO]', message, extra)
    await errorLogStore.add(LOG_LEVELS.info, message, String(extra))
  }

  async warn(message, extra = '') {
    console.warn('[WARN]', message, extra)
    await errorLogStore.add(LOG_LEVELS.warn, message, String(extra))
  }

  async error(message, err = null) {
    const stack = err instanceof Error ? err.stack : String(err || '')
    console.error('[ERROR]', message, stack)
    await errorLogStore.add(LOG_LEVELS.error, message, stack)
  }
}

export const logger = new Logger()

// 全局未捕获错误
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => {
    logger.error('Unhandled Promise Rejection', e.reason)
  })
  window.addEventListener('error', (e) => {
    logger.error('Uncaught Error: ' + e.message, e.error)
  })
}
