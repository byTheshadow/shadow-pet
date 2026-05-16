import { petStore, settingsStore } from '../store/db.js'
import { logger } from '../utils/logger.js'

export async function applyOfflineDecay(petId) {
  try {
    const pet = await petStore.get(petId)
    if (!pet) return null

    const config = await settingsStore.get('decayConfig')
    const rates = config?.rates || {
      hunger: -3, mood: -2, health: -1, cleanliness: -2, intimacy: -1
    }
    const intervalMs = (config?.intervalMinutes || 30) * 60 * 1000

    const now = Date.now()
    const elapsed = now - (pet.lastActiveAt || now)
    const intervals = Math.floor(elapsed / intervalMs)

    if (intervals <= 0) return pet

    const newStats = { ...pet.stats }
    for (const [key, rate] of Object.entries(rates)) {
      if (newStats[key] !== undefined) {
        newStats[key] = Math.max(0, Math.min(100, newStats[key] + rate * intervals))
      }
    }

    // 健康受饥饿影响
    if (newStats.hunger < 20) {
      newStats.health = Math.max(0, newStats.health - intervals * 2)
    }

    await petStore.update(petId, { stats: newStats, lastActiveAt: now })
    await logger.info(`宠物 ${pet.name} 离线衰减: ${intervals} 个周期`)

    return { ...pet, stats: newStats, lastActiveAt: now }
  } catch (err) {
    await logger.error('离线衰减计算失败', err)
    return null
  }
}

export function getStatusEmoji(stats) {
  const { hunger, mood, health, cleanliness } = stats
  const avg = (hunger + mood + health + cleanliness) / 4

  if (health < 20)      return { emoji: '🤒', label: '生病了', kaomoji: '(´；ω；`)' }
  if (hunger < 20)      return { emoji: '😫', label: '好饿',   kaomoji: '(´・ω・`)' }
  if (cleanliness < 20) return { emoji: '🛁', label: '需要洗澡', kaomoji: '(｀Д´)' }
  if (mood < 20)        return { emoji: '😢', label: '心情不好', kaomoji: '(╥_╥)' }
  if (avg > 80)         return { emoji: '😊', label: '非常开心', kaomoji: '(≧▽≦)' }
  if (avg > 60)         return { emoji: '😌', label: '状态不错', kaomoji: '(´｡• ᵕ •｡`)' }
  if (avg > 40)         return { emoji: '😐', label: '一般般',   kaomoji: '(・_・)' }
  return                       { emoji: '😔', label: '状态欠佳', kaomoji: '(´-ω-`)' }
}

export function getStatColor(value) {
  if (value > 60) return 'bg-green-400'
  if (value > 30) return 'bg-yellow-400'
  return 'bg-red-400'
}

export async function feedPet(petId, amount = 20) {
  const pet = await petStore.get(petId)
  if (!pet) return null
  const newStats = {
    ...pet.stats,
    hunger:   Math.min(100, pet.stats.hunger + amount),
    mood:     Math.min(100, pet.stats.mood + 5),
    intimacy: Math.min(100, pet.stats.intimacy + 2),
  }
  await petStore.update(petId, { stats: newStats, lastActiveAt: Date.now() })
  return newStats
}

export async function playWithPet(petId) {
  const pet = await petStore.get(petId)
  if (!pet) return null
  const newStats = {
    ...pet.stats,
    mood:     Math.min(100, pet.stats.mood + 20),
    hunger:   Math.max(0,   pet.stats.hunger - 5),
    intimacy: Math.min(100, pet.stats.intimacy + 5),
    health:   Math.min(100, pet.stats.health + 5),
  }
  await petStore.update(petId, { stats: newStats, lastActiveAt: Date.now() })
  return newStats
}

export async function cleanPet(petId) {
  const pet = await petStore.get(petId)
  if (!pet) return null
  const newStats = {
    ...pet.stats,
    cleanliness: Math.min(100, pet.stats.cleanliness + 30),
    mood:        Math.min(100, pet.stats.mood + 5),
    health:      Math.min(100, pet.stats.health + 5),
  }
  await petStore.update(petId, { stats: newStats, lastActiveAt: Date.now() })
  return newStats
}

export async function healPet(petId) {
  const pet = await petStore.get(petId)
  if (!pet) return null
  const newStats = {
    ...pet.stats,
    health: Math.min(100, pet.stats.health + 30),
    mood:   Math.min(100, pet.stats.mood + 10),
  }
  await petStore.update(petId, { stats: newStats, lastActiveAt: Date.now() })
  return newStats
}
