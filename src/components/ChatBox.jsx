import React, { useState, useEffect, useRef } from 'react'
import { chatStore, aiParentStore, settingsStore } from '../store/db.js'
import { callAI } from '../ai/claude.js'
import { buildPetSystemPrompt, buildAiParentSystemPrompt, buildTrioSystemPrompt } from '../ai/prompts.js'
import { compressMemory } from '../core/memory.js'
import { toast } from '../utils/feedback.js'
import { logger } from '../utils/logger.js'

const MODES = [
  { id: 'pet',    label: '与宠物' },
  { id: 'parent', label: '与家长' },
  { id: 'trio',   label: '三方' },
]

export default function ChatBox({ petId, pet, onUpdate }) {
  const [messages,    setMessages]    = useState([])
  const [input,       setInput]       = useState('')
  const [mode,        setMode]        = useState('pet')
  const [isLoading,   setIsLoading]   = useState(false)
  const [aiParents,   setAiParents]   = useState([])
  const [streamText,  setStreamText]  = useState('')
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    if (petId) {
      loadHistory()
      loadParents()
    }
  }, [petId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  async function loadHistory() {
    const history = await chatStore.getByPet(petId, 50)
    setMessages(history)
  }

  async function loadParents() {
    const parents = await aiParentStore.getAll()
    setAiParents(parents)
  }

  async function handleSend() {
    if (!input.trim() || isLoading || !pet) return
    const userMsg = input.trim()
    setInput('')

    const userEntry = { petId, role: 'user', content: userMsg, speakerName: '主人' }
    await chatStore.add(userEntry)
    setMessages(prev => [...prev, { ...userEntry, timestamp: Date.now() }])

    setIsLoading(true)
    setStreamText('')

    try {
      if (mode === 'pet') {
        await sendToPet(userMsg)
      } else if (mode === 'parent') {
        await sendToParent(userMsg)
      } else {
        await sendTrio(userMsg)
      }

      // 检查是否需要压缩记忆
      const allChats = await chatStore.getByPet(petId, 200)
      if (allChats.length > 80) {
        compressMemory(petId).catch(err => logger.error('记忆压缩失败', err))
      }
    } catch (err) {
      toast.error(`发送失败：${err.message}`)
      await logger.error('聊天发送失败', err)
    } finally {
      setIsLoading(false)
      setStreamText('')
      inputRef.current?.focus()
    }
  }

  async function sendToPet(userMsg) {
    const systemPrompt = await buildPetSystemPrompt(petId)
    const recentMsgs   = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))

    let fullReply = ''
    await callAI({
      systemPrompt,
      messages: [...recentMsgs, { role: 'user', content: userMsg }],
      stream: true,
      onChunk: (delta, full) => {
        fullReply = full
        setStreamText(full)
      },
    })

    const petEntry = { petId, role: 'assistant', content: fullReply, speakerName: pet.name }
    await chatStore.add(petEntry)
    setMessages(prev => [...prev, { ...petEntry, timestamp: Date.now() }])
  }

  async function sendToParent(userMsg) {
    if (aiParents.length === 0) {
      toast.warn('还没有AI家长，请先在设置中创建')
      return
    }
    const parent = aiParents[0]
    const systemPrompt = await buildAiParentSystemPrompt(parent, pet)
    const recentMsgs   = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))

    let fullReply = ''
    await callAI({
      systemPrompt,
      messages: [...recentMsgs, { role: 'user', content: userMsg }],
      stream: true,
      onChunk: (delta, full) => {
        fullReply = full
        setStreamText(full)
      },
    })

    const parentEntry = { petId, role: 'assistant', content: fullReply, speakerName: parent.name }
    await chatStore.add(parentEntry)
    setMessages(prev => [...prev, { ...parentEntry, timestamp: Date.now() }])
  }

  async function sendTrio(userMsg) {
    if (aiParents.length === 0) {
      toast.warn('还没有AI家长，请先在设置中创建')
      return
    }
    const parent = aiParents[0]

    // 宠物先回复
    const petPrompt = await buildTrioSystemPrompt(parent, pet, 'pet')
    const recentMsgs = messages.slice(-8).map(m => ({ role: m.role, content: m.content }))

    let petReply = ''
    await callAI({
      systemPrompt: petPrompt,
      messages: [...recentMsgs, { role: 'user', content: userMsg }],
      stream: true,
      onChunk: (delta, full) => {
        petReply = full
        setStreamText(`${pet.name}: ${full}`)
      },
    })
    const petEntry = { petId, role: 'assistant', content: petReply, speakerName: pet.name }
    await chatStore.add(petEntry)
    setMessages(prev => [...prev, { ...petEntry, timestamp: Date.now() }])
    setStreamText('')

    // 家长再回复
    const parentPrompt = await buildTrioSystemPrompt(parent, pet, 'parent')
    let parentReply = ''
    await callAI({
      systemPrompt: parentPrompt,
      messages: [
        ...recentMsgs,
        { role: 'user',      content: userMsg },
        { role: 'assistant', content: petReply },
      ],
      stream: true,
      onChunk: (delta, full) => {
        parentReply = full
        setStreamText(`${parent.name}: ${full}`)
      },
    })
    const parentEntry = { petId, role: 'assistant', content: parentReply, speakerName: parent.name }
    await chatStore.add(parentEntry)
    setMessages(prev => [...prev, { ...parentEntry, timestamp: Date.now() }])
  }

  async function handleClearChat() {
    if (!window.confirm('确定清空聊天记录？')) return
    await chatStore.deleteAll(petId)
    setMessages([])
    toast.success('聊天记录已清空')
  }

  if (!pet) return (
    <div className="flex items-center justify-center h-64 text-pet-muted text-sm">
      请先选择一只宠物
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* 模式切换 + 清空 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-pet-border bg-white">
        <div className="flex gap-1 bg-pet-bg rounded-xl p-1">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150
                ${mode === m.id ? 'bg-pet-accent text-white shadow-sm' : 'text-pet-muted hover:text-pet-text'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button onClick={handleClearChat} className="text-xs text-red-400 hover:text-red-500 px-2 py-1">
          清空
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-pet-muted text-sm py-8">
            <p className="text-2xl mb-2">💬</p>
            <p>开始和{mode === 'pet' ? pet.name : mode === 'parent' ? 'AI家长' : '大家'}聊天吧</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={msg.id || i} msg={msg} petName={pet.name} />
        ))}
        {/* 流式输出中 */}
        {isLoading && streamText && (
          <div className="flex gap-2 items-start">
            <div className="w-7 h-7 rounded-full bg-pet-accent/20 flex items-center justify-center text-sm shrink-0">
              {pet.imageUrl
                ? <img src={pet.imageUrl} className="w-full h-full rounded-full object-cover" alt="" />
                : '🐾'}
            </div>
            <div className="bg-white border border-pet-border rounded-2xl rounded-tl-none px-3 py-2 text-sm text-pet-text max-w-[75%] leading-relaxed">
              {streamText}
              <span className="inline-block w-1 h-4 bg-pet-accent ml-0.5 animate-pulse" />
            </div>
          </div>
        )}
        {isLoading && !streamText && (
          <div className="flex gap-2 items-center">
            <div className="w-7 h-7 rounded-full bg-pet-accent/20 flex items-center justify-center text-sm shrink-0">🐾</div>
            <div className="bg-white border border-pet-border rounded-2xl rounded-tl-none px-3 py-2 text-sm text-pet-muted">
              <span className="flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入框 */}
      <div className="px-4 py-3 border-t border-pet-border bg-white flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          placeholder={`和${mode === 'pet' ? pet.name : mode === 'parent' ? 'AI家长' : '大家'}说点什么...`}
          rows={1}
          className="textarea-base flex-1 max-h-24"
          style={{ resize: 'none' }}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="btn-primary shrink-0 h-9 px-4"
        >
          发送
        </button>
      </div>
    </div>
  )
}

function MessageBubble({ msg, petName }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className="w-7 h-7 rounded-full bg-pet-accent/20 flex items-center justify-center text-xs shrink-0 font-medium text-pet-accent">
        {isUser ? '我' : (msg.speakerName?.[0] || '🐾')}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        {!isUser && (
          <span className="text-xs text-pet-muted px-1">{msg.speakerName || petName}</span>
        )}
        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-pet-accent text-white rounded-tr-none'
            : 'bg-white border border-pet-border text-pet-text rounded-tl-none'}`}>
          {msg.content}
        </div>
        <span className="text-xs text-pet-muted px-1">
          {msg.timestamp
            ? new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            : ''}
        </span>
      </div>
    </div>
  )
}
