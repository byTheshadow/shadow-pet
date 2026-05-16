import React, { useState, useEffect } from 'react'
import { getAllScenes, goOnAdventure } from '../scenes/sceneEngine.js'
import { adventureStore } from '../store/db.js'
import { toast } from '../utils/feedback.js'
import { logger } from '../utils/logger.js'

export default function SceneMap({ petId, pet, onUpdate }) {
  const [scenes,      setScenes]      = useState([])
  const [logs,        setLogs]        = useState([])
  const [adventuring, setAdventuring] = useState(false)
  const [activeLog,   setActiveLog]   = useState(null)

  useEffect(() => {
    loadScenes()
    if (petId) loadLogs()
  }, [petId])

  async function loadScenes() {
    const all = await getAllScenes()
    setScenes(all)
  }

  async function loadLogs() {
    const all = await adventureStore.getByPet(petId, 20)
    setLogs(all)
  }

  async function handleAdventure(scene) {
    if (!petId || adventuring) return
    if (!scene.unlocked) { toast.warn('场景未解锁'); return }

    setAdventuring(true)
    const t = toast.loading(`正在前往 ${scene.name}...`)
    try {
      const result = await goOnAdventure(petId, scene.id)
      t.dismiss()
      toast.success(`冒险完成！获得 ${result.expGain} EXP`)
      if (result.newlyUnlocked?.length > 0) {
        for (const s of result.newlyUnlocked) {
          toast.success(`🎉 解锁了新场景：${s.name}`)
        }
      }
      setActiveLog(result.log)
      await loadScenes()
      await loadLogs()
      await onUpdate()
    } catch (err) {
      t.dismiss()
      toast.error(`冒险失败：${err.message}`)
      await logger.error('冒险失败', err)
    } finally {
      setAdventuring(false)
    }
  }

  async function handleDeleteLog(logId) {
    if (!window.confirm('删除这条冒险日记？')) return
    await adventureStore.deleteAll(petId)
    await loadLogs()
    toast.success('已删除')
  }

  if (!pet) return (
    <div className="flex items-center justify-center h-64 text-pet-muted text-sm">请先选择一只宠物</div>
  )

  return (
        <div className="flex flex-col gap-4 p-4 animate-fade-in">
      <div>
        <h2 className="font-semibold text-pet-text mb-1">🗺️ 带 {pet.name} 去冒险</h2>
        <p className="text-xs text-pet-muted">选择一个场景，AI会生成专属冒险日记</p>
      </div>

      {/* 场景网格 */}
      <div className="grid grid-cols-2 gap-3">
        {scenes.map(scene => (
          <button
            key={scene.id}
            onClick={() => handleAdventure(scene)}
            disabled={adventuring || !scene.unlocked}
            className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-150
              ${scene.unlocked
                ? 'bg-white border-pet-border hover:border-pet-accent hover:shadow-sm active:scale-95'
                : 'bg-pet-bg border-pet-border opacity-60 cursor-not-allowed'}`}
          >
            <span className="text-3xl">{scene.emoji}</span>
            <span className="text-sm font-medium text-pet-text">{scene.name}</span>
            <span className="text-xs text-pet-muted text-center leading-relaxed">{scene.description}</span>
            {!scene.unlocked && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
                <span className="text-xs text-pet-muted">🔒 Lv.{scene.requiredLevel}</span>
              </div>
            )}
            {adventuring && scene.unlocked && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                <span className="text-xs text-pet-accent animate-pulse">出发中...</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* 最新冒险结果弹出 */}
      {activeLog && (
        <div className="card border-pet-accent/30 bg-gradient-to-br from-white to-pet-card animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-pet-text">
              {activeLog.sceneEmoji} {activeLog.sceneName} · {activeLog.eventTitle}
            </span>
            <button onClick={() => setActiveLog(null)} className="text-pet-muted text-xs hover:text-pet-text">✕</button>
          </div>
          <p className="text-sm text-pet-text leading-relaxed">{activeLog.diary}</p>
          <div className="flex gap-3 mt-3 flex-wrap">
            {Object.entries(activeLog.statChanges || {}).map(([key, val]) => (
              <span key={key} className={`text-xs px-2 py-0.5 rounded-full font-medium
                ${val > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {val > 0 ? '+' : ''}{val} {key}
              </span>
            ))}
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
              +{activeLog.expGain} EXP
            </span>
          </div>
        </div>
      )}

      {/* 冒险日记历史 */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-pet-text">📖 冒险日记</h3>
          {logs.length > 0 && (
            <button
              onClick={() => handleDeleteLog()}
              className="text-xs text-red-400 hover:text-red-500"
            >
              清空
            </button>
          )}
        </div>
        {logs.length === 0 ? (
          <p className="text-xs text-pet-muted text-center py-4">还没有冒险记录，快出发吧！</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={log.id || i} className="border-b border-pet-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-pet-text">
                    {log.sceneEmoji} {log.sceneName}
                  </span>
                  <span className="text-xs text-pet-muted">
                    {new Date(log.timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-pet-text leading-relaxed">{log.diary}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

