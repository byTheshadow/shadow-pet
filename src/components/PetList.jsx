import React, { useState, useEffect } from 'react'
import { petStore, friendshipStore, settingsStore } from '../store/db.js'
import { callAI } from '../ai/claude.js'
import { buildFriendInteractionPrompt } from '../ai/prompts.js'
import { toast } from '../utils/feedback.js'
import { logger } from '../utils/logger.js'

const DEFAULT_STATS = { hunger: 80, mood: 80, health: 80, cleanliness: 80, intimacy: 50 }

export default function PetList({ onPetCreated, onSelect, activePetId, showFriends }) {
  const [pets,          setPets]          = useState([])
  const [showCreate,    setShowCreate]    = useState(false)
  const [personalities, setPersonalities] = useState([])
  const [interacting,   setInteracting]   = useState(false)
  const [interactLog,   setInteractLog]   = useState(null)
  const [form, setForm] = useState({
    name: '', imageUrl: '', personalityId: 'cheerful',
    customPersonalityPrompt: '', likes: '', dislikes: '',
  })

  useEffect(() => {
    loadPets()
    loadPersonalities()
  }, [])

  async function loadPets() {
    const all = await petStore.getAll()
    setPets(all)
  }

  async function loadPersonalities() {
    const p = await settingsStore.get('petPersonalities')
    setPersonalities(p || [])
  }

  async function handleCreate() {
    if (!form.name.trim()) { toast.warn('请输入宠物名字'); return }
    const t = toast.loading('创建中...')
    try {
      const id = await petStore.create({
        name:                    form.name.trim(),
        imageUrl:                form.imageUrl.trim(),
        personalityId:           form.personalityId,
        customPersonalityPrompt: form.customPersonalityPrompt.trim(),
        likes:                   form.likes.trim(),
        dislikes:                form.dislikes.trim(),
      })
      t.dismiss()
      toast.success(`${form.name} 创建成功！`)
      setForm({ name: '', imageUrl: '', personalityId: 'cheerful', customPersonalityPrompt: '', likes: '', dislikes: '' })
      setShowCreate(false)
      await loadPets()
      onPetCreated?.()
      onSelect?.(id)
    } catch (err) {
      t.dismiss()
      toast.error(`创建失败：${err.message}`)
      await logger.error('创建宠物失败', err)
    }
  }

  async function handleDelete(pet) {
    if (!window.confirm(`确定删除 ${pet.name}？所有数据将被清除。`)) return
    const t = toast.loading('删除中...')
    try {
      await petStore.delete(pet.id)
      t.dismiss()
      toast.success(`${pet.name} 已删除`)
      await loadPets()
      onPetCreated?.()
    } catch (err) {
      t.dismiss()
      toast.error(`删除失败：${err.message}`)
      await logger.error('删除宠物失败', err)
    }
  }

  async function handleFriendInteract(petA, petB) {
    if (interacting) return
    setInteracting(true)
    setInteractLog(null)
    const t = toast.loading(`${petA.name} 和 ${petB.name} 正在互动...`)
    try {
      const prompt = await buildFriendInteractionPrompt(petA, petB)
      const result = await callAI({
        systemPrompt: prompt,
        messages: [{ role: 'user', content: '请生成这两只宠物的互动对话。' }],
      })
      t.dismiss()
      setInteractLog({ petA, petB, content: result })

      // 增加互动计数
      const friendships = await friendshipStore.getByPet(petA.id)
      const fs = friendships.find(f => f.petBId === petB.id || f.petAId === petB.id)
      if (fs) await friendshipStore.incrementInteraction(fs.id)
      else     await friendshipStore.add(petA.id, petB.id)
    } catch (err) {
      t.dismiss()
      toast.error(`互动失败：${err.message}`)
      await logger.error('宠物互动失败', err)
    } finally {
      setInteracting(false)
    }
  }

  // 朋友模式：展示互动
  if (showFriends) {
    return (
      <div className="flex flex-col gap-4 p-4 animate-fade-in">
        <div>
          <h2 className="font-semibold text-pet-text mb-1">👥 宠物朋友圈</h2>
          <p className="text-xs text-pet-muted">选择两只宠物让他们互动</p>
        </div>

        {pets.length < 2 ? (
          <div className="card text-center py-8">
            <p className="text-pet-muted text-sm">至少需要两只宠物才能互动</p>
            <p className="text-xs text-pet-muted mt-1">去宠物页面创建更多宠物吧</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pets.map(petA => (
              pets.filter(p => p.id !== petA.id).map(petB => (
                petA.id < petB.id && (
                  <div key={`${petA.id}-${petB.id}`} className="card flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <PetAvatar pet={petA} size="sm" />
                      <span className="text-pet-muted text-sm">×</span>
                      <PetAvatar pet={petB} size="sm" />
                      <div className="ml-1">
                        <p className="text-sm font-medium text-pet-text">{petA.name} & {petB.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleFriendInteract(petA, petB)}
                      disabled={interacting}
                      className="btn-primary text-xs px-3 py-1.5 shrink-0"
                    >
                      互动
                    </button>
                  </div>
                )
              ))
            ))}
          </div>
        )}

        {/* 互动结果 */}
        {interactLog && (
          <div className="card border-pet-accent2/50 bg-gradient-to-br from-white to-blue-50 animate-slide-up">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-pet-text">
                💬 {interactLog.petA.name} & {interactLog.petB.name} 的对话
              </span>
              <button onClick={() => setInteractLog(null)} className="text-pet-muted text-xs">✕</button>
            </div>
            <p className="text-sm text-pet-text leading-relaxed whitespace-pre-line">{interactLog.content}</p>
          </div>
        )}
      </div>
    )
  }

  // 普通模式：宠物列表 + 创建
  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-pet-text">🐾 我的宠物</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-xs px-3 py-1.5">
          {showCreate ? '取消' : '+ 新建'}
        </button>
      </div>

      {/* 创建表单 */}
      {showCreate && (
        <div className="card space-y-3 animate-slide-up">
          <h3 className="text-sm font-semibold text-pet-text">创建新宠物</h3>
          <div>
            <label className="text-xs text-pet-muted mb-1 block">名字 *</label>
            <input
              className="input-base"
              placeholder="给宠物起个名字"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-pet-muted mb-1 block">图片 URL</label>
            <input
              className="input-base"
              placeholder="https://... （留空使用默认）"
              value={form.imageUrl}
              onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
            />
            {form.imageUrl && (
              <img src={form.imageUrl} alt="预览" className="mt-2 w-16 h-16 rounded-full object-cover border border-pet-border"
                onError={e => { e.target.style.display = 'none' }} />
            )}
          </div>
          <div>
            <label className="text-xs text-pet-muted mb-1 block">性格</label>
            <select
              className="input-base"
              value={form.personalityId}
              onChange={e => setForm(f => ({ ...f, personalityId: e.target.value }))}
            >
              {personalities.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          {form.personalityId === 'custom' && (
            <div>
              <label className="text-xs text-pet-muted mb-1 block">自定义性格描述</label>
              <textarea
                className="textarea-base"
                rows={3}
                placeholder="描述宠物的性格、说话方式、喜好..."
                value={form.customPersonalityPrompt}
                onChange={e => setForm(f => ({ ...f, customPersonalityPrompt: e.target.value }))}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-pet-muted mb-1 block">喜欢</label>
              <input className="input-base" placeholder="如：红茶拿铁、晒太阳"
                value={form.likes} onChange={e => setForm(f => ({ ...f, likes: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-pet-muted mb-1 block">不喜欢</label>
              <input className="input-base" placeholder="如：雷声、洗澡"
                value={form.dislikes} onChange={e => setForm(f => ({ ...f, dislikes: e.target.value }))} />
            </div>
          </div>
          <button onClick={handleCreate} className="btn-primary w-full">创建宠物</button>
        </div>
      )}

      {/* 宠物列表 */}
      {pets.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">🥚</p>
          <p className="text-pet-text font-medium">还没有宠物</p>
          <p className="text-xs text-pet-muted mt-1">点击上方「新建」创建你的第一只宠物</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pets.map(pet => (
            <div key={pet.id}
              className={`card flex items-center gap-3 cursor-pointer transition-all duration-150
                ${activePetId === pet.id ? 'border-pet-accent shadow-sm' : 'hover:border-pet-accent/50'}`}
              onClick={() => onSelect?.(pet.id)}
            >
              <PetAvatar pet={pet} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-pet-text text-sm">{pet.name}</p>
                <p className="text-xs text-pet-muted truncate">
                  Lv.{pet.level || 1} · {personalities.find(p => p.id === pet.personalityId)?.label || '未知性格'}
                </p>
              </div>
              {activePetId === pet.id && (
                <span className="text-xs text-pet-accent font-medium shrink-0">当前</span>
              )}
              <button
                onClick={e => { e.stopPropagation(); handleDelete(pet) }}
                className="text-xs text-red-400 hover:text-red-500 shrink-0 p-1"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PetAvatar({ pet, size = 'md' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-lg' : 'w-10 h-10 text-xl'
  return (
    <div className={`${sz} rounded-full bg-pet-accent/10 flex items-center justify-center shrink-0 overflow-hidden`}>
      {pet.imageUrl
        ? <img src={pet.imageUrl} alt={pet.name} className="w-full h-full object-cover"
            onError={e => { e.target.style.display = 'none' }} />
        : <span>🐾</span>}
    </div>
  )
}
