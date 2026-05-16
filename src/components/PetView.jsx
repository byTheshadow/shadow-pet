import React, { useState, useEffect, useRef } from 'react'
import { petStore } from '../store/db.js'
import { feedPet, playWithPet, cleanPet, healPet, getStatusEmoji, getStatColor } from '../core/decay.js'
import { checkAndTriggerAiParent, getAiParentLogs } from '../ai/aiParent.js'
import { callAI } from '../ai/claude.js'
import { buildPetSystemPrompt } from '../ai/prompts.js'
import { toast } from '../utils/feedback.js'
import { logger } from '../utils/logger.js'

const SHELL_URL = 'https://tc-new.z.wiki/autoupload/1N2_UJVYUo2KjM-_22IFnCfNcKcqEnRmcljopnyJoMs/20260515/Sm5G/1024X1536/waiguan%20(2).png'

export default function PetView({ petId, pet, onUpdate }) {
  const [bubble,      setBubble]      = useState(null)
  const [isThinking,  setIsThinking]  = useState(false)
  const [parentLogs,  setParentLogs]  = useState([])
  const [showLogs,    setShowLogs]    = useState(false)
  const bubbleTimer = useRef(null)

  useEffect(() => {
    if (petId) loadParentLogs()
  }, [petId])

  async function loadParentLogs() {
    const logs = await getAiParentLogs(petId)
    setParentLogs(logs)
  }

  function showBubble(text, duration = 4000) {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current)
    setBubble(text)
    bubbleTimer.current = setTimeout(() => setBubble(null), duration)
  }

  async function handleAction(actionFn, actionName, successMsg) {
    if (!petId) return
    const t = toast.loading(`${actionName}中...`)
    try {
      await actionFn(petId)
      await onUpdate()
      t.dismiss()
      toast.success(successMsg)

      // 触发宠物反应气泡
      const updatedPet = await petStore.get(petId)
      await triggerPetReaction(updatedPet, actionName)
    } catch (err) {
      t.dismiss()
      toast.error(`${actionName}失败：${err.message}`)
      await logger.error(`${actionName}失败`, err)
    }
  }

  async function triggerPetReaction(currentPet, trigger) {
    if (!currentPet) return
    setIsThinking(true)
    try {
      const systemPrompt = await buildPetSystemPrompt(currentPet.id)
      const triggerMap = {
        '喂食': '主人刚刚喂了你，用一句话表达你的感受',
        '玩耍': '主人刚刚陪你玩了，用一句话表达你的感受',
        '洗澡': '主人刚刚帮你洗澡了，用一句话表达你的感受',
        '治疗': '主人刚刚给你治病了，用一句话表达你的感受',
      }
      const prompt = triggerMap[trigger] || '用一句话打个招呼'
      const reply = await callAI({
        systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      })
      if (reply) showBubble(reply, 5000)
    } catch (err) {
      await logger.error('宠物反应生成失败', err)
    } finally {
      setIsThinking(false)
    }
  }

  async function handleGreet() {
    if (!pet || isThinking) return
    setIsThinking(true)
    const t = toast.loading('宠物正在思考...')
    try {
      const systemPrompt = await buildPetSystemPrompt(petId)
      const reply = await callAI({
        systemPrompt,
        messages: [{ role: 'user', content: '主人来看你了，打个招呼吧' }],
      })
      t.dismiss()
      if (reply) showBubble(reply, 6000)
    } catch (err) {
      t.dismiss()
      toast.error(`获取回应失败：${err.message}`)
      await logger.error('宠物打招呼失败', err)
    } finally {
      setIsThinking(false)
    }
  }

  if (!pet) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-pet-muted">
        <span className="text-4xl mb-2">🐾</span>
        <p className="text-sm">还没有宠物，去创建一只吧</p>
      </div>
    )
  }

  const statusInfo = getStatusEmoji(pet.stats)

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in">

      {/* 拓麻歌子外壳 + 宠物展示区 */}
      <div className="flex justify-center">
        <div className="relative w-48 h-48">
          {/* 外壳图片 */}
          <img
            src={SHELL_URL}
            alt="宠物外壳"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
            onError={e => { e.target.style.display = 'none' }}
          />
          {/* 屏幕区域（外壳内部） */}
          <div
            className="absolute z-0 flex flex-col items-center justify-center cursor-pointer"
            style={{ top: '18%', left: '18%', width: '64%', height: '50%' }}
            onClick={handleGreet}
            title="点击和宠物打招呼"
          >
            {/* 宠物图片 */}
            {pet.imageUrl ? (
              <img
                src={pet.imageUrl}
                alt={pet.name}
                className={`w-16 h-16 object-contain rounded-full ${isThinking ? 'animate-pulse-soft' : 'animate-float'}`}
                onError={e => { e.target.src = '' }}
              />
            ) : (
              <div className={`text-5xl ${isThinking ? 'animate-pulse-soft' : 'animate-float'}`}>
                🐾
              </div>
            )}
          </div>

          {/* 气泡 */}
          {bubble && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 animate-bubble-in"
              style={{ width: '200px', transform: 'translateX(-30%)' }}>
              <div className="bg-white border border-pet-border rounded-2xl rounded-bl-none px-3 py-2 shadow-md text-xs text-pet-text leading-relaxed">
                {bubble}
              </div>
              <div className="w-3 h-3 bg-white border-b border-l border-pet-border rotate-45 ml-6 -mt-1.5" />
            </div>
          )}

          {/* 思考中指示 */}
          {isThinking && (
            <div className="absolute -top-2 left-1/2 z-20 animate-bubble-in"
              style={{ transform: 'translateX(-30%)' }}>
              <div className="bg-white border border-pet-border rounded-2xl px-3 py-2 shadow-md text-xs text-pet-muted">
                ···
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 宠物名字和状态 */}
      <div className="text-center">
        <h2 className="font-semibold text-lg text-pet-text">{pet.name}</h2>
        <p className="text-sm text-pet-muted mt-0.5">
          {statusInfo.emoji} {statusInfo.label} {statusInfo.kaomoji}
        </p>
        <p className="text-xs text-pet-muted mt-0.5">Lv.{pet.level || 1} · {pet.exp || 0} EXP</p>
      </div>

      {/* 状态条 */}
      <div className="card space-y-2">
        <h3 className="text-xs font-semibold text-pet-muted uppercase tracking-wide mb-3">状态</h3>
        {[
          { key: 'hunger',      label: '🍖 饥饿', },
          { key: 'mood',        label: '😊 心情', },
          { key: 'health',      label: '💊 健康', },
          { key: 'cleanliness', label: '🛁 清洁', },
          { key: 'intimacy',    label: '💕 亲密', },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs w-16 text-pet-muted shrink-0">{label}</span>
            <div className="flex-1 bg-pet-border rounded-full h-2 overflow-hidden">
              <div
                className={`stat-bar ${getStatColor(pet.stats[key])}`}
                style={{ width: `${pet.stats[key]}%` }}
              />
            </div>
            <span className="text-xs text-pet-muted w-8 text-right">{pet.stats[key]}</span>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '🍖', name: '喂食',  fn: () => handleAction(feedPet,  '喂食',  '喂食成功！') },
          { label: '🎮', name: '玩耍',  fn: () => handleAction(playWithPet, '玩耍', '玩得很开心！') },
          { label: '🛁', name: '洗澡',  fn: () => handleAction(cleanPet, '洗澡',  '干净啦！') },
          { label: '💊', name: '治疗',  fn: () => handleAction(healPet,  '治疗',  '好多了！') },
        ].map(({ label, name, fn }) => (
          <button
            key={name}
            onClick={fn}
            className="flex flex-col items-center gap-1 bg-white border border-pet-border rounded-2xl py-3
                       hover:border-pet-accent hover:bg-pet-card active:scale-95 transition-all duration-150"
          >
            <span className="text-2xl">{label}</span>
            <span className="text-xs text-pet-muted">{name}</span>
          </button>
        ))}
      </div>

      {/* AI家长日志 */}
      <div className="card">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between text-sm font-medium text-pet-text"
        >
          <span>👨‍👩‍👧 家长日志</span>
          <span className="text-pet-muted text-xs">{showLogs ? '收起' : `${parentLogs.length} 条`}</span>
        </button>
        {showLogs && (
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
            {parentLogs.length === 0 ? (
              <p className="text-xs text-pet-muted text-center py-2">暂无记录</p>
            ) : (
              parentLogs.map((log, i) => (
                <div key={i} className="text-xs bg-pet-card rounded-xl p-2 text-pet-text leading-relaxed">
                  <span className="text-pet-muted">
                    {new Date(log.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <p className="mt-0.5">{log.content}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
