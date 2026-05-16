import { aiParentStore, petStore, settingsStore, memoryStore } from '../store/db.js'
import { callAI } from './claude.js'
import { buildAiParentSystemPrompt } from './prompts.js'
import { feedPet, playWithPet } from '../core/decay.js'
import { logger } from '../utils/logger.js'

export async function checkAndTriggerAiParent(petId) {
  try {
    const config = await settingsStore.get('aiParentConfig')
    if (!config?.enabled) return null

    const parents = await aiParentStore.getAll()
    if (parents.length === 0) return null

    const pet = await petStore.get(petId)
    if (!pet) return null

    const results = []
    const now = Date.now()
    const frequencyMs = (24 / (config.activityFrequency || 3)) * 60 * 60 * 1000

    for (const parent of parents) {
      const lastAction = parent.lastActionAt || 0
      if (now - lastAction < frequencyMs) continue

      const action = await triggerAiParentAction(parent, pet)
      if (action) {
        results.push(action)
        await aiParentStore.update(parent.id, { lastActionAt: now })
      }
    }
    return results.length > 0 ? results : null
  } catch (err) {
    await logger.error('AI家长触发失败', err)
    return null
  }
}

async function triggerAiParentAction(aiParent, pet) {
  try {
    const actions = ['feed', 'play', 'message']
    const action  = actions[Math.floor(Math.random() * actions.length)]

    let statChanges = null
    let actionLabel = ''

    if (action === 'feed' && pet.stats.hunger < 70) {
      statChanges = await feedPet(pet.id, 15)
      actionLabel = '喂食'
    } else if (action === 'play' && pet.stats.mood < 70) {
      statChanges = await playWithPet(pet.id)
      actionLabel = '陪玩'
    } else {
      actionLabel = '留言'
    }

    const systemPrompt = await buildAiParentSystemPrompt(aiParent, pet)
    const message = await callAI({
      systemPrompt,
      messages: [{
        role: 'user',
        content: `你刚刚对${pet.name}进行了「${actionLabel}」操作，请留下一句温馨的话（30字以内）。`,
      }],
    })

    const log = {
      petId:       pet.id,
      type:        'ai_parent_action',
      content:     `${aiParent.name} 对 ${pet.name} 进行了「${actionLabel}」：${message}`,
      parentId:    aiParent.id,
      parentName:  aiParent.name,
      action:      actionLabel,
      statChanges,
    }
    await memoryStore.add(log)
    return log
  } catch (err) {
    await logger.error('AI家长行为生成失败', err)
    return null
  }
}

export async function getAiParentLogs(petId, limit = 20) {
  try {
    const all = await memoryStore.getByPet(petId, 200)
    return all
      .filter(m => m.type === 'ai_parent_action')
      .slice(0, limit)
  } catch (err) {
    await logger.error('获取AI家长日志失败', err)
    return []
  }
}
