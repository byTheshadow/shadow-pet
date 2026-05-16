import { memoryStore, chatStore, settingsStore } from '../store/db.js'
import { callAI } from '../ai/claude.js'
import { logger } from '../utils/logger.js'

export async function compressMemory(petId) {
  try {
    const chats = await chatStore.getByPet(petId, 100)
    if (chats.length < 20) return null

    const toCompress = chats.slice(0, chats.length - 10)
    const chatText = toCompress
      .map(c => `${c.role === 'user' ? '主人' : c.speakerName || '宠物'}: ${c.content}`)
      .join('\n')

    const globalPrompt = await settingsStore.get('globalPrompt')

    const summary = await callAI({
      systemPrompt: `${globalPrompt || ''}
你的任务是将以下对话历史压缩成一段简洁的记忆摘要（200字以内）。
保留重要的情感事件、宠物喜好、特殊经历。用第三人称描述。`,
      messages: [{ role: 'user', content: `请压缩以下对话记录：\n${chatText}` }],
    })

    if (summary) {
      await memoryStore.add({
        petId,
        type: 'summary',
        content: summary,
      })
      await chatStore.deleteOld(petId, 10)
      await logger.info(`宠物 ${petId} 记忆压缩完成`)
      return summary
    }
  } catch (err) {
    await logger.error('记忆压缩失败', err)
  }
  return null
}

export async function buildMemoryContext(petId) {
  try {
    const summaries = await memoryStore.getSummaries(petId)
    const recentChats = await chatStore.getByPet(petId, 20)

    let context = ''
    if (summaries.length > 0) {
      const latestSummaries = summaries.slice(-3)
      context += '【历史记忆摘要】\n'
      context += latestSummaries.map(s => s.content).join('\n') + '\n\n'
    }
    if (recentChats.length > 0) {
      context += '【近期对话】\n'
      context += recentChats
        .map(c => `${c.role === 'user' ? '主人' : c.speakerName || '宠物'}: ${c.content}`)
        .join('\n')
    }
    return context
  } catch (err) {
    await logger.error('构建记忆上下文失败', err)
    return ''
  }
}

export async function addMemoryEvent(petId, type, content) {
  try {
    await memoryStore.add({ petId, type, content })
    await memoryStore.deleteOld(petId, 100)
  } catch (err) {
    await logger.error('添加记忆事件失败', err)
  }
}

