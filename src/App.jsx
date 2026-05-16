import React, { useState, useEffect, useCallback } from 'react'
import PetView     from './components/PetView.jsx'
import ChatBox     from './components/ChatBox.jsx'
import SceneMap    from './components/SceneMap.jsx'
import Settings    from './components/Settings.jsx'
import PetList     from './components/PetList.jsx'
import LogViewer   from './components/LogViewer.jsx'
import { petStore } from './store/db.js'
import { applyOfflineDecay } from './core/decay.js'
import { checkAndTriggerAiParent } from './ai/aiParent.js'
import { toast } from './utils/feedback.js'
import { logger } from './utils/logger.js'

const TABS = [
  { id: 'pet',      label: '🏠 宠物',   },
  { id: 'chat',     label: '💬 聊天',   },
  { id: 'scene',    label: '🗺️ 冒险',   },
  { id: 'friends',  label: '👥 朋友',   },
  { id: 'settings', label: '⚙️ 设置',   },
]

export default function App() {
  const [activeTab,   setActiveTab]   = useState('pet')
  const [activePetId, setActivePetId] = useState(null)
  const [activePet,   setActivePet]   = useState(null)
  const [showLogs,    setShowLogs]    = useState(false)
  const [pets,        setPets]        = useState([])

  const loadPets = useCallback(async () => {
    const all = await petStore.getAll()
    setPets(all)
    if (all.length > 0 && !activePetId) {
      setActivePetId(all[0].id)
    }
  }, [activePetId])

  const loadActivePet = useCallback(async () => {
    if (!activePetId) return
    const pet = await petStore.get(activePetId)
    setActivePet(pet)
  }, [activePetId])

  // 启动时：离线衰减 + AI家长检查
  useEffect(() => {
    async function onMount() {
      await loadPets()
      if (activePetId) {
        const updated = await applyOfflineDecay(activePetId)
        if (updated) setActivePet(updated)

        const parentActions = await checkAndTriggerAiParent(activePetId)
        if (parentActions?.length > 0) {
          for (const action of parentActions) {
            toast.info(`${action.parentName} ${action.action}了 ${activePet?.name || '宠物'}`)
          }
        }
      }
    }
    onMount().catch(err => logger.error('启动初始化失败', err))
  }, [activePetId])

  useEffect(() => {
    loadActivePet()
  }, [activePetId])

  // 定时刷新宠物状态
  useEffect(() => {
    const timer = setInterval(loadActivePet, 60_000)
    return () => clearInterval(timer)
  }, [loadActivePet])

  const handlePetSelect = (id) => {
    setActivePetId(id)
    setActiveTab('pet')
  }

  const handlePetUpdate = useCallback(async () => {
    await loadActivePet()
    await loadPets()
  }, [loadActivePet, loadPets])

  return (
    <div className="min-h-screen bg-pet-bg flex flex-col max-w-md mx-auto relative">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-40 bg-pet-bg/90 backdrop-blur-sm border-b border-pet-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🐾</span>
          <span className="font-semibold text-pet-text">Shadow Pet</span>
        </div>
        <div className="flex items-center gap-2">
          {pets.length > 1 && (
            <select
              value={activePetId || ''}
              onChange={e => handlePetSelect(Number(e.target.value))}
              className="text-xs border border-pet-border rounded-lg px-2 py-1 bg-white text-pet-text"
            >
              {pets.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowLogs(true)}
            className="text-xs text-pet-muted hover:text-pet-text px-2 py-1 rounded-lg hover:bg-pet-border transition-colors"
            title="错误日志"
          >
            📋
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto pb-20">
        {pets.length === 0 ? (
          <PetList onPetCreated={loadPets} onSelect={handlePetSelect} />
        ) : (
          <>
                       {activeTab === 'pet'      && <PetView     petId={activePetId} pet={activePet}   onUpdate={handlePetUpdate} />}
            {activeTab === 'chat'     && <ChatBox     petId={activePetId} pet={activePet}   onUpdate={handlePetUpdate} />}
            {activeTab === 'scene'    && <SceneMap    petId={activePetId} pet={activePet}   onUpdate={handlePetUpdate} />}
            {activeTab === 'friends'  && <PetList     onPetCreated={loadPets} onSelect={handlePetSelect} activePetId={activePetId} showFriends />}
            {activeTab === 'settings' && <Settings    onUpdate={handlePetUpdate} onPetsChange={loadPets} />}
          </>
        )}
      </main>

      {/* 底部导航 */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-sm border-t border-pet-border z-40">
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-xs font-medium transition-colors duration-150 flex flex-col items-center gap-0.5
                ${activeTab === tab.id ? 'text-pet-accent' : 'text-pet-muted hover:text-pet-text'}`}
            >
              <span className="text-lg leading-none">{tab.label.split(' ')[0]}</span>
              <span>{tab.label.split(' ')[1]}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* 日志弹窗 */}
      {showLogs && <LogViewer onClose={() => setShowLogs(false)} />}
    </div>
  )
}
