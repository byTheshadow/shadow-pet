import React, { useState, useEffect } from 'react'
import {
  settingsStore, aiParentStore, db,
  clearAllData, getStorageEstimate,
  petStore, memoryStore, chatStore, adventureStore
} from '../store/db.js'
import { fetchAvailableModels } from '../ai/claude.js'
import { toast } from '../utils/feedback.js'
import { logger } from '../utils/logger.js'

const TABS = ['API', '全局', '性格', '家长', '场景', '数据']

export default function Settings({ onUpdate, onPetsChange }) {
  const [tab, setTab] = useState('API')

  return (
    <div className="flex flex-col gap-0 animate-fade-in">
      {/* 子标签栏 */}
      <div className="flex overflow-x-auto gap-1 px-4 py-2 border-b border-pet-border bg-white sticky top-14 z-30">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
              ${tab === t ? 'bg-pet-accent text-white' : 'text-pet-muted hover:text-pet-text'}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === 'API'  && <ApiSettings />}
        {tab === '全局' && <GlobalPromptSettings />}
        {tab === '性格' && <PersonalitySettings />}
        {tab === '家长' && <AiParentSettings />}
        {tab === '场景' && <SceneSettings />}
        {tab === '数据' && <DataSettings onUpdate={onUpdate} onPetsChange={onPetsChange} />}
      </div>
    </div>
  )
}

// ── API 设置 ──────────────────────────────────────────────
function ApiSettings() {
  const [config,   setConfig]   = useState({ apiKey: '', apiEndpoint: 'https://api.deepseek.com', modelName: '' })
  const [models,   setModels]   = useState([])
  const [loading,  setLoading]  = useState(false)
  const [fetching, setFetching] = useState(false)

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    const c = await settingsStore.get('apiConfig')
    if (c) setConfig(c)
  }

  async function handleSave() {
    setLoading(true)
    try {
      await settingsStore.set('apiConfig', config)
      toast.success('API 配置已保存')
    } catch (err) {
      toast.error('保存失败：' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleFetchModels() {
    if (!config.apiKey || !config.apiEndpoint) {
      toast.warn('请先填写 API Key 和接口地址')
      return
    }
    setFetching(true)
    // 先保存当前配置再获取
    await settingsStore.set('apiConfig', config)
    const t = toast.loading('正在获取模型列表...')
    try {
      const list = await fetchAvailableModels()
      t.dismiss()
      setModels(list)
      if (list.length === 0) toast.warn('未获取到模型，请检查接口地址')
      else toast.success(`获取到 ${list.length} 个模型`)
    } catch (err) {
      t.dismiss()
      toast.error('获取失败：' + err.message)
      await logger.error('获取模型列表失败', err)
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-pet-text">API 配置</h3>
      <div>
        <label className="text-xs text-pet-muted mb-1 block">API Key</label>
        <input className="input-base" type="password" placeholder="sk-..."
          value={config.apiKey}
          onChange={e => setConfig(c => ({ ...c, apiKey: e.target.value }))} />
      </div>
      <div>
        <label className="text-xs text-pet-muted mb-1 block">接口地址</label>
        <input className="input-base" placeholder="https://api.deepseek.com"
          value={config.apiEndpoint}
          onChange={e => setConfig(c => ({ ...c, apiEndpoint: e.target.value }))} />
        <p className="text-xs text-pet-muted mt-1">
          DeepSeek: https://api.deepseek.com<br />
          OpenAI: https://api.openai.com<br />
          Claude: https://api.anthropic.com
        </p>
      </div>
      <div>
        <label className="text-xs text-pet-muted mb-1 block">模型</label>
        <div className="flex gap-2">
          <select className="input-base flex-1"
            value={config.modelName}
            onChange={e => setConfig(c => ({ ...c, modelName: e.target.value }))}
          >
            <option value="">-- 请先获取模型列表 --</option>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button onClick={handleFetchModels} disabled={fetching}
            className="btn-secondary shrink-0 text-xs px-3">
            {fetching ? '获取中...' : '获取'}
          </button>
        </div>
        {config.modelName && (
          <p className="text-xs text-green-600 mt-1">✓ 当前：{config.modelName}</p>
        )}
      </div>
      <button onClick={handleSave} disabled={loading} className="btn-primary w-full">
        {loading ? '保存中...' : '保存配置'}
      </button>
    </div>
  )
}

// ── 全局提示词 ────────────────────────────────────────────
function GlobalPromptSettings() {
  const [prompt,  setPrompt]  = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    const p = await settingsStore.get('globalPrompt')
    if (p) setPrompt(p)
  }
  async function handleSave() {
    setLoading(true)
    try {
      await settingsStore.set('globalPrompt', prompt)
      toast.success('全局提示词已保存')
    } catch (err) {
      toast.error('保存失败：' + err.message)
    } finally {
      setLoading(false)
    }
  }
  async function handleReset() {
    const def = `你正在扮演一个电子宠物世界中的角色。这个世界温馨、可爱、充满奇幻色彩。
所有角色都用简短、生动的语言交流，喜欢用颜文字表达情感。
保持角色一致性，根据宠物当前的状态和性格来回应。`
    setPrompt(def)
    toast.info('已重置为默认值，记得保存')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-pet-text">全局提示词</h3>
        <button onClick={handleReset} className="text-xs text-pet-muted hover:text-pet-text">重置默认</button>
      </div>
      <p className="text-xs text-pet-muted">控制整个世界的基调，宠物和AI家长的言行都在此框架内。</p>
      <textarea className="textarea-base" rows={8}
        value={prompt} onChange={e => setPrompt(e.target.value)} />
      <button onClick={handleSave} disabled={loading} className="btn-primary w-full">
        {loading ? '保存中...' : '保存'}
      </button>
    </div>
  )
}

// ── 性格预设 ──────────────────────────────────────────────
function PersonalitySettings() {
  const [personalities, setPersonalities] = useState([])
  const [loading,       setLoading]       = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    const p = await settingsStore.get('petPersonalities')
    if (p) setPersonalities(p)
  }
  async function handleSave() {
    setLoading(true)
    try {
      await settingsStore.set('petPersonalities', personalities)
      toast.success('性格预设已保存')
    } catch (err) {
      toast.error('保存失败：' + err.message)
    } finally {
      setLoading(false)
    }
  }
  function updateItem(idx, field, value) {
    setPersonalities(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-pet-text">性格预设编辑</h3>
      <p className="text-xs text-pet-muted">编辑宠物可选的性格选项和对应提示词。</p>
      <div className="space-y-3">
        {personalities.map((p, i) => (
          <div key={p.id} className="card space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-pet-accent w-16 shrink-0">{p.label}</span>
              <input className="input-base text-xs" placeholder="显示名称"
                value={p.label} onChange={e => updateItem(i, 'label', e.target.value)} />
            </div>
            <textarea className="textarea-base text-xs" rows={3}
              placeholder="性格提示词..."
              value={p.prompt} onChange={e => updateItem(i, 'prompt', e.target.value)} />
          </div>
        ))}
      </div>
      <button onClick={handleSave} disabled={loading} className="btn-primary w-full">
        {loading ? '保存中...' : '保存性格预设'}
      </button>
    </div>
  )
}

// ── AI 家长 ───────────────────────────────────────────────
function AiParentSettings() {
  const [parents,  setParents]  = useState([])
  const [config,   setConfig]   = useState({ enabled: true, activityFrequency: 3, defaultPrompt: '' })
  const [showForm, setShowForm] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [form, setForm] = useState({ name: '', prompt: '', activityFrequency: 3 })

  useEffect(() => { load() }, [])
  async function load() {
    const all = await aiParentStore.getAll()
    setParents(all)
        const c = await settingsStore.get('aiParentConfig')
    if (c) setConfig(c)
  }

  async function handleSaveConfig() {
    setLoading(true)
    try {
      await settingsStore.set('aiParentConfig', config)
      toast.success('家长配置已保存')
    } catch (err) {
      toast.error('保存失败：' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) { toast.warn('请输入家长名字'); return }
    const t = toast.loading('创建中...')
    try {
      await aiParentStore.create({
        name:              form.name.trim(),
        prompt:            form.prompt.trim(),
        activityFrequency: Number(form.activityFrequency) || 3,
      })
      t.dismiss()
      toast.success(`${form.name} 创建成功`)
      setForm({ name: '', prompt: '', activityFrequency: 3 })
      setShowForm(false)
      await load()
    } catch (err) {
      t.dismiss()
      toast.error('创建失败：' + err.message)
      await logger.error('创建AI家长失败', err)
    }
  }

  async function handleDelete(parent) {
    if (!window.confirm(`确定删除家长 ${parent.name}？`)) return
    try {
      await aiParentStore.delete(parent.id)
      toast.success('已删除')
      await load()
    } catch (err) {
      toast.error('删除失败：' + err.message)
    }
  }

  async function handleUpdateParent(id, field, value) {
    try {
      await aiParentStore.update(id, { [field]: value })
      await load()
    } catch (err) {
      toast.error('更新失败：' + err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-pet-text">AI 家长</h3>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs px-3 py-1.5">
          {showForm ? '取消' : '+ 新建'}
        </button>
      </div>

      {/* 全局家长配置 */}
      <div className="card space-y-3">
        <h4 className="text-xs font-semibold text-pet-muted uppercase tracking-wide">全局配置</h4>
        <div className="flex items-center justify-between">
          <span className="text-sm text-pet-text">启用AI家长</span>
          <button
            onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
            className={`w-10 h-6 rounded-full transition-colors duration-200 relative
              ${config.enabled ? 'bg-pet-accent' : 'bg-pet-border'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200
              ${config.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>
        <div>
          <label className="text-xs text-pet-muted mb-1 block">每天互动次数</label>
          <input type="number" min={1} max={24} className="input-base"
            value={config.activityFrequency}
            onChange={e => setConfig(c => ({ ...c, activityFrequency: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="text-xs text-pet-muted mb-1 block">默认家长提示词</label>
          <textarea className="textarea-base" rows={3}
            value={config.defaultPrompt}
            onChange={e => setConfig(c => ({ ...c, defaultPrompt: e.target.value }))} />
        </div>
        <button onClick={handleSaveConfig} disabled={loading} className="btn-primary w-full">
          {loading ? '保存中...' : '保存配置'}
        </button>
      </div>

      {/* 创建表单 */}
      {showForm && (
        <div className="card space-y-3 animate-slide-up">
          <h4 className="text-xs font-semibold text-pet-text">新建AI家长</h4>
          <div>
            <label className="text-xs text-pet-muted mb-1 block">名字 *</label>
            <input className="input-base" placeholder="如：妈妈、小助手"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-pet-muted mb-1 block">性格与说话风格</label>
            <textarea className="textarea-base" rows={4}
              placeholder="描述这位家长的性格、说话方式、与宠物的关系..."
              value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-pet-muted mb-1 block">每天互动次数</label>
            <input type="number" min={1} max={24} className="input-base"
              value={form.activityFrequency}
              onChange={e => setForm(f => ({ ...f, activityFrequency: e.target.value }))} />
          </div>
          <button onClick={handleCreate} className="btn-primary w-full">创建家长</button>
        </div>
      )}

      {/* 家长列表 */}
      {parents.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-2xl mb-2">👤</p>
          <p className="text-sm text-pet-muted">还没有AI家长</p>
        </div>
      ) : (
        <div className="space-y-3">
          {parents.map(parent => (
            <AiParentCard
              key={parent.id}
              parent={parent}
              onDelete={handleDelete}
              onUpdate={handleUpdateParent}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AiParentCard({ parent, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState({ name: parent.name, prompt: parent.prompt || '' })
  const [saving,  setSaving]  = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate(parent.id, 'name',   draft.name)
      await onUpdate(parent.id, 'prompt', draft.prompt)
      toast.success('已更新')
      setEditing(false)
    } catch (err) {
      toast.error('更新失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">👤</span>
          {editing
            ? <input className="input-base text-sm w-32"
                value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
            : <span className="font-medium text-sm text-pet-text">{parent.name}</span>
          }
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(!editing)}
            className="text-xs text-pet-accent hover:opacity-80">
            {editing ? '取消' : '编辑'}
          </button>
          <button onClick={() => onDelete(parent)} className="text-xs text-red-400 hover:text-red-500">删除</button>
        </div>
      </div>
      {editing ? (
        <>
          <textarea className="textarea-base text-xs" rows={4}
            value={draft.prompt} onChange={e => setDraft(d => ({ ...d, prompt: e.target.value }))} />
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full text-xs">
            {saving ? '保存中...' : '保存'}
          </button>
        </>
      ) : (
        parent.prompt && (
          <p className="text-xs text-pet-muted leading-relaxed line-clamp-2">{parent.prompt}</p>
        )
      )}
    </div>
  )
}

// ── 场景编辑 ──────────────────────────────────────────────
function SceneSettings() {
  const [scenes,  setScenes]  = useState([])
  const [openId,  setOpenId]  = useState(null)
  const [events,  setEvents]  = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadScenes() }, [])

  async function loadScenes() {
    const all = await db.scenes.toArray()
    setScenes(all)
  }

  async function loadEvents(sceneId) {
    const evs = await db.sceneEvents.where('sceneId').equals(sceneId).toArray()
    setEvents(prev => ({ ...prev, [sceneId]: evs }))
  }

  async function toggleScene(sceneId) {
    if (openId === sceneId) {
      setOpenId(null)
    } else {
      setOpenId(sceneId)
      if (!events[sceneId]) await loadEvents(sceneId)
    }
  }

  async function handleUpdateScene(sceneId, field, value) {
    try {
      await db.scenes.update(sceneId, { [field]: value })
      await loadScenes()
      toast.success('已更新')
    } catch (err) {
      toast.error('更新失败：' + err.message)
    }
  }

  async function handleUpdateEvent(eventId, sceneId, field, value) {
    try {
      await db.sceneEvents.update(eventId, { [field]: value })
      await loadEvents(sceneId)
    } catch (err) {
      toast.error('更新失败：' + err.message)
    }
  }

  async function handleDeleteEvent(eventId, sceneId) {
    if (!window.confirm('删除这个事件？')) return
    try {
      await db.sceneEvents.delete(eventId)
      await loadEvents(sceneId)
      toast.success('已删除')
    } catch (err) {
      toast.error('删除失败：' + err.message)
    }
  }

  async function handleAddEvent(sceneId) {
    try {
      await db.sceneEvents.add({
        sceneId,
        type:                'custom',
        weight:              20,
        title:               '新事件',
        descriptionTemplate: '{petName}遇到了一件有趣的事！',
        statChanges:         { mood: 5 },
      })
      await loadEvents(sceneId)
      toast.success('已添加新事件')
    } catch (err) {
      toast.error('添加失败：' + err.message)
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-pet-text">场景与事件编辑</h3>
      <p className="text-xs text-pet-muted">点击场景展开编辑，可修改描述、事件文本和权重。</p>
      {scenes.map(scene => (
        <div key={scene.id} className="card">
          <button
            onClick={() => toggleScene(scene.id)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{scene.emoji}</span>
              <div className="text-left">
                <p className="text-sm font-medium text-pet-text">{scene.name}</p>
                <p className="text-xs text-pet-muted">
                  {scene.unlocked ? '✓ 已解锁' : `🔒 Lv.${scene.requiredLevel}`}
                </p>
              </div>
            </div>
            <span className="text-pet-muted text-xs">{openId === scene.id ? '▲' : '▼'}</span>
          </button>

          {openId === scene.id && (
            <div className="mt-3 space-y-3 animate-fade-in">
              {/* 场景基本信息编辑 */}
              <div className="space-y-2 pb-3 border-b border-pet-border">
                <div>
                  <label className="text-xs text-pet-muted mb-1 block">场景描述</label>
                  <textarea className="textarea-base text-xs" rows={2}
                    defaultValue={scene.description}
                    onBlur={e => handleUpdateScene(scene.id, 'description', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-pet-muted mb-1 block">Emoji</label>
                    <input className="input-base text-xs"
                      defaultValue={scene.emoji}
                      onBlur={e => handleUpdateScene(scene.id, 'emoji', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-pet-muted mb-1 block">解锁等级</label>
                    <input type="number" className="input-base text-xs"
                      defaultValue={scene.requiredLevel}
                      onBlur={e => handleUpdateScene(scene.id, 'requiredLevel', Number(e.target.value))} />
                  </div>
                </div>
              </div>

              {/* 事件列表 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-pet-muted uppercase tracking-wide">随机事件</span>
                  <button onClick={() => handleAddEvent(scene.id)}
                    className="text-xs text-pet-accent hover:opacity-80">+ 添加</button>
                </div>
                <div className="space-y-2">
                  {(events[scene.id] || []).map(ev => (
                    <div key={ev.id} className="bg-pet-bg rounded-xl p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <input className="input-base text-xs flex-1 mr-2"
                          defaultValue={ev.title}
                          onBlur={e => handleUpdateEvent(ev.id, scene.id, 'title', e.target.value)} />
                        <button onClick={() => handleDeleteEvent(ev.id, scene.id)}
                          className="text-xs text-red-400 hover:text-red-500 shrink-0">🗑️</button>
                      </div>
                      <textarea className="textarea-base text-xs" rows={2}
                        defaultValue={ev.descriptionTemplate}
                        onBlur={e => handleUpdateEvent(ev.id, scene.id, 'descriptionTemplate', e.target.value)} />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-pet-muted shrink-0">权重</span>
                        <input type="number" className="input-base text-xs w-16"
                          defaultValue={ev.weight}
                          onBlur={e => handleUpdateEvent(ev.id, scene.id, 'weight', Number(e.target.value))} />
                        <span className="text-xs text-pet-muted shrink-0">状态变化(JSON)</span>
                        <input className="input-base text-xs flex-1"
                          defaultValue={JSON.stringify(ev.statChanges || {})}
                          onBlur={e => {
                            try {
                              const val = JSON.parse(e.target.value)
                              handleUpdateEvent(ev.id, scene.id, 'statChanges', val)
                            } catch {
                              toast.error('JSON格式错误')
                            }
                          }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── 数据管理 ──────────────────────────────────────────────
function DataSettings({ onUpdate, onPetsChange }) {
  const [estimate, setEstimate] = useState(null)
  const [pets,     setPets]     = useState([])
  const [loading,  setLoading]  = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const est = await getStorageEstimate()
    setEstimate(est)
    const all = await petStore.getAll()
    setPets(all)
  }

  async function handleClearPetData(petId, type) {
    const labels = { memory: '记忆', chat: '聊天记录', adventure: '冒险日记' }
    if (!window.confirm(`确定清空该宠物的${labels[type]}？`)) return
    setLoading(true)
    try {
      if (type === 'memory')    await memoryStore.deleteAll(petId)
      if (type === 'chat')      await chatStore.deleteAll(petId)
      if (type === 'adventure') await adventureStore.deleteAll(petId)
      toast.success(`${labels[type]}已清空`)
      await loadData()
      onUpdate?.()
    } catch (err) {
      toast.error('清空失败：' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleClearAll() {
    if (!window.confirm('⚠️ 确定清除所有数据？包括宠物、聊天、记忆、设置，此操作不可恢复！')) return
    if (!window.confirm('再次确认：所有数据将被永久删除。')) return
    setLoading(true)
    try {
      await clearAllData()
      toast.success('所有数据已清除，即将刷新...')
      setTimeout(() => location.reload(), 1500)
    } catch (err) {
      toast.error('清除失败：' + err.message)
      await logger.error('清除所有数据失败', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleClearLogs() {
    const { errorLogStore } = await import('../store/db.js')
    await errorLogStore.clear()
    toast.success('错误日志已清空')
    await loadData()
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-pet-text">数据管理</h3>

      {/* 存储概览 */}
      {estimate && (
        <div className="card space-y-2">
          <h4 className="text-xs font-semibold text-pet-muted uppercase tracking-wide">存储概览</h4>
          {Object.entries(estimate).map(([key, count]) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-pet-text">{key}</span>
              <span className="text-pet-muted">{count} 条</span>
            </div>
          ))}
        </div>
      )}

      {/* 按宠物清理 */}
      <div className="card space-y-3">
        <h4 className="text-xs font-semibold text-pet-muted uppercase tracking-wide">按宠物清理</h4>
        {pets.length === 0 ? (
          <p className="text-xs text-pet-muted">暂无宠物</p>
        ) : (
          pets.map(pet => (
            <div key={pet.id} className="space-y-1.5">
              <p className="text-sm font-medium text-pet-text">{pet.name}</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { type: 'memory',    label: '清空记忆' },
                  { type: 'chat',      label: '清空聊天' },
                  { type: 'adventure', label: '清空日记' },
                ].map(({ type, label }) => (
                  <button key={type}
                    onClick={() => handleClearPetData(pet.id, type)}
                    disabled={loading}
                    className="btn-danger text-xs px-3 py-1.5">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 全局清理 */}
      <div className="card space-y-2">
        <h4 className="text-xs font-semibold text-pet-muted uppercase tracking-wide">全局清理</h4>
        <button onClick={handleClearLogs} className="btn-secondary w-full text-sm">
          清空错误日志
        </button>
        <button onClick={handleClearAll} disabled={loading}
          className="w-full py-2 rounded-xl text-sm font-medium bg-red-500 text-white
                     hover:bg-red-600 active:scale-95 transition-all duration-150
                     disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? '清除中...' : '⚠️ 清除所有数据'}
        </button>
        <p className="text-xs text-pet-muted text-center">此操作不可恢复，请谨慎操作</p>
      </div>
    </div>
  )
}

