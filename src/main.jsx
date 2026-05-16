import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initDefaultData } from './store/db.js'
import { logger } from './utils/logger.js'
import './index.css'

async function bootstrap() {
  try {
    await initDefaultData()
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  } catch (err) {
    await logger.error('应用启动失败', err)
    document.getElementById('root').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;font-family:sans-serif;">
        <div style="font-size:48px">😿</div>
        <div style="font-size:18px;color:#b91c1c;">应用启动失败</div>
        <div style="font-size:14px;color:#666;">${err.message}</div>
        <button onclick="localStorage.clear();location.reload()" 
          style="padding:8px 20px;background:#ff9eb5;color:white;border:none;border-radius:8px;cursor:pointer;">
          清除缓存并重试
        </button>
      </div>`
  }
}

bootstrap()
