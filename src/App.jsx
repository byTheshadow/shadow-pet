
import React, { useState, useEffect, useCallback } from 'react'
import PetView   from './components/PetView.jsx'
import ChatBox   from './components/ChatBox.jsx'
import SceneMap  from './components/SceneMap.jsx'
import Settings  from './components/Settings.jsx'
import PetList   from './components/PetList.jsx'
import LogViewer from './components/LogViewer.jsx'
import { petStore } from './store/db.js'
import { applyOfflineDecay } from './core/decay.js'
import { checkAndTriggerAiParent } from './ai/aiParent.js'
import { toast } from './utils/feedback.js'
import { logger } from './utils/logger.js'

const TABS = [
  { id: 'pet',      label: '🏠', name: '宠物'  },
  { id: 'chat',     label: '💬', name: '聊天'  },
  { id: 'scene',    label: '🗺️', name: '冒险'  },
  { id: 'friends',  label: '👥', name: '朋友'  },
  { id: 'settings', label: '⚙️', name: '设置'  },
]

export default function App() {
  const [activeTab,   setActiveTab]   = useState('pet')
  const [activePetId, setActivePetId] = useState(null)
  const [activePet,   setActivePet]   = useState(null)
  const [showLogs,    setShowLogs]    = useState(false)
  const [pets,        setPets]        = useState([])
  const [initialized, setInitialized] = useState(false)

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

  useEffect(() => {
    async function onMount() {
      try {
        await loadPets()
        setInitialized(true)
      } catch (err) {
        logger.error('启动初始化失败', err)
        setInitialized(true)
      }
    }
    onMount()
  }, [])

  useEffect(() => {
    if (!activePetId) return
    async function initPet() {
      try {
        const updated = await applyOfflineDecay(activePetId)
        if (updated) setActivePet(updated)
        else await loadActivePet()

        const parentActions = await checkAndTriggerAiParent(activePetId)
        if (parentActions?.length > 0) {
          for (const action of parentActions) {
            toast.info(`${action.parentName} ${action.action}了宠物`)
          }
        }
      } catch (err) {
        logger.error('宠物初始化失败', err)
      }
    }
    initPet()
  }, [activePetId])

  useEffect(() => {
    const timer = setInterval(loadActivePet, 60_000)
    return () => clearInterval(timer)
  }, [loadActivePet])

  const handlePetSelect = useCallback((id) => {
    setActivePetId(id)
    setActiveTab('pet')
  }, [])

  const handlePetUpdate = useCallback(async () => {
    await loadActivePet()
    await loadPets()
  }, [loadActivePet, loadPets])

  if (!initialized) {
    return (
      <div className="min-h-screen bg-pet-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce-slow">🐾</div>
          <p className="text-pet-muted text-sm">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', maxWidth: '448px', margin: '0 auto', background: '#fdf6e3', position: 'relative' }}>

      {/* 顶部栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(253,246,227,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e8ddd0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🐾</span>
          <span style={{ fontWeight: 600, color: '#4a4a4a' }}>Shadow Pet</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {pets.length > 1 && (
            <select
              value={activePetId || ''}
              onChange={e => handlePetSelect(Number(e.target.value))}
              style={{ fontSize: '12px', border: '1px solid #e8ddd0', borderRadius: '8px', padding: '4px 8px', background: 'white', color: '#4a4a4a' }}
            >
              {pets.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowLogs(true)}
            style={{ fontSize: '12px', color: '#9a9a9a', padding: '4px 8px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            📋
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
        {pets.length === 0 ? (
          <PetList onPetCreated={loadPets} onSelect={handlePetSelect} />
        ) : (
          <>
            {activeTab === 'pet'      && <PetView    petId={activePetId} pet={activePet}  onUpdate={handlePetUpdate} />}
            {activeTab === 'chat'     && <ChatBox    petId={activePetId} pet={activePet}  onUpdate={handlePetUpdate} />}
            {activeTab === 'scene'    && <SceneMap   petId={activePetId} pet={activePet}  onUpdate={handlePetUpdate} />}
            {activeTab === 'friends'  && <PetList    onPetCreated={loadPets} onSelect={handlePetSelect} activePetId={activePetId} showFriends />}
            {activeTab === 'settings' && <Settings   onUpdate={handlePetUpdate} onPetsChange={loadPets} />}
          </>
        )}
      </div>

      {/* 底部导航 — 用 inline style 避免 Tailwind purge 问题 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '448px',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid #e8ddd0',
        zIndex: 50,
        display: 'flex',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              color: activeTab === tab.id ? '#ff9eb5' : '#9a9a9a',
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.label}</span>
            <span style={{ fontSize: '11px', fontWeight: activeTab === tab.id ? 600 : 400 }}>{tab.name}</span>
          </button>
        ))}
      </div>

      {/* 日志弹窗 */}
      {showLogs && <LogViewer onClose={() => setShowLogs(false)} />}
    </div>
  )
}
