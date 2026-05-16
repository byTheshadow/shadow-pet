import { db, adventureStore, petStore, settingsStore } from '../store/db.js'
import { callAI } from '../ai/claude.js'
import { buildScenePrompt } from '../ai/prompts.js'
import { addMemoryEvent } from '../core/memory.js'
import { logger } from '../utils/logger.js'

export async function getAllScenes() {
  return db.scenes.toArray()
}

export async function getSceneEvents(sceneId) {
  return db.sceneEvents.where('sceneId').equals(sceneId).toArray()
}

export async function unlockScene(sceneId) {
  await db.scenes.update(sceneId, { unlocked: true })
}

export async function checkSceneUnlocks(pet) {
  const scenes = await getAllScenes()
  const unlocked = []
  for (const scene of scenes) {
    if (!scene.unlocked && pet.level >= scene.requiredLevel) {
      await unlockScene(scene.id)
      unlocked.push(scene)
    }
  }
  return unlocked
}

export async function goOnAdventure(petId, sceneId) {
  try {
    const pet   = await petStore.get(petId)
    const scene = await db.scenes.get(sceneId)
    if (!pet || !scene) throw new Error('宠物或场景不存在')
    if (!scene.unlocked)  throw new Error('场景未解锁')

    const events = await getSceneEvents(sceneId)
    if (events.length === 0) throw new Error('场景没有事件')

    // 加权随机选事件
    const event = weightedRandom(events)

    // 应用状态变化
    const newStats = { ...pet.stats }
    for (const [key, val] of Object.entries(event.statChanges || {})) {
      if (newStats[key] !== undefined) {
        newStats[key] = Math.max(0, Math.min(100, newStats[key] + val))
      }
    }

    // 经验值
    const expGain = 10 + Math.floor(Math.random() * 10)
    const newExp  = (pet.exp || 0) + expGain
    const newLevel = Math.floor(newExp / 100) + 1

    await petStore.update(petId, {
      stats:       newStats,
      exp:         newExp,
      level:       newLevel,
      lastActiveAt: Date.now(),
    })

    // AI生成冒险日记
    const scenePrompt = await buildScenePrompt(pet, scene, event)
    const diary = await callAI({
      systemPrompt: scenePrompt,
      messages: [{ role: 'user', content: '请生成这次冒险的日记。' }],
    })

    const log = {
      petId,
      sceneId,
      sceneName:   scene.name,
      sceneEmoji:  scene.emoji,
      eventTitle:  event.title,
      diary:       diary || event.descriptionTemplate.replace('{petName}', pet.name),
      statChanges: event.statChanges,
      expGain,
    }
    await adventureStore.add(log)
    await addMemoryEvent(petId, 'adventure', `去了${scene.name}，${event.title}：${diary}`)

    // 检查解锁
    const newlyUnlocked = await checkSceneUnlocks({ ...pet, level: newLevel })

    return { log, newStats, newLevel, expGain, newlyUnlocked }
  } catch (err) {
    await logger.error('冒险失败', err)
    throw err
  }
}

function weightedRandom(events) {
  const total  = events.reduce((sum, e) => sum + (e.weight || 1), 0)
  let rand     = Math.random() * total
  for (const e of events) {
    rand -= (e.weight || 1)
    if (rand <= 0) return e
  }
  return events[events.length - 1]
}

export async function updateSceneEvent(eventId, data) {
  await db.sceneEvents.update(eventId, data)
}

export async function addSceneEvent(sceneId, data) {
  return db.sceneEvents.add({ ...data, sceneId })
}

export async function deleteSceneEvent(eventId) {
  return db.sceneEvents.delete(eventId)
}

export async function updateScene(sceneId, data) {
  return db.scenes.update(sceneId, data)
}
