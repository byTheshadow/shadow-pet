import React, { useState, useEffect } from 'react'
import { errorLogStore } from '../store/db.js'
import { toast } from '../utils/feedback.js'

const LEVEL_STYLE = {
  info:  'bg-blue-50  text-blue-700  border-blue-200',
  warn:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  error: 'bg-red-50   text-red-700   border-red-200',
}

export default function LogViewer({ onClose }) {
  const [logs,   setLogs]   = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => { loadLogs() }, [])

  async function loadLogs() {
    const all = await errorLogStore.getAll(200)
    setLogs(all)
  }

  async function handleClear() {
    if (!window.confirm('确定清空所有错误日志？')) return
    await errorLogStore.clear()
    setLogs([])
    toast.success('日志已清空')
  }

  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md bg-white rounded-t-3xl max-h-[80vh] flex flex-col animate-slide-up">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-pet-border">
          <h3 className="font-semibold text-pet-text">📋 错误日志</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleClear} className="text-xs text-red-400 hover:text-red-500 px-2 py-1">清空</button>
            <button onClick={onClose} className="text-pet-muted hover:text-pet-text text-lg leading-none">✕</button>
          </div>
        </div>

        {/* 过滤器 */}
        <div className="flex gap-1 px-4 py-2 border-b border-pet-border">
          {['all', 'error', 'warn', 'info'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all
                ${filter === f ? 'bg-pet-accent text-white' : 'text-pet-muted hover:text-pet-text'}`}>
              {f === 'all' ? '全部' : f}
              {f !== 'all' && (
                <span className="ml-1 opacity-70">
                  ({logs.filter(l => l.level === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 日志列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-pet-muted text-sm">
              <p className="text-2xl mb-2">✅</p>
              <p>暂无日志</p>
            </div>
          ) : (
            filtered.map((log, i) => (
              <div key={log.id || i}
                className={`rounded-xl border p-2.5 text-xs ${LEVEL_STYLE[log.level] || LEVEL_STYLE.info}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold uppercase">{log.level}</span>
                  <span className="opacity-70">
                    {new Date(log.timestamp).toLocaleString('zh-CN', {
                      month: 'numeric', day: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </span>
                </div>
                <p className="leading-relaxed break-words">{log.message}</p>
                {log.stack && (
                  <details className="mt-1">
                    <summary className="cursor-pointer opacity-70 hover:opacity-100">堆栈信息</summary>
                    <pre className="mt-1 text-xs opacity-70 whitespace-pre-wrap break-all leading-relaxed">
                      {log.stack}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
