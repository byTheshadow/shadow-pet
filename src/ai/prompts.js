import { settingsStore, petStore } from '../store/db.js'
import { buildMemoryContext } from '../core/memory.js'
import { getStatusEmoji } from '../core/decay.js'

export async function buildPetSystemPrompt(petId) {
  const pet          = await petStore.get(petId)
  if (!pet) return ''
  const globalPrompt = await settingsStore.get('globalPrompt') || ''
  const personalities = await settingsStore.get('petPersonalities') || []
  const memoryCtx    = await buildMemoryContext(petId)
  const statusInfo   = getStatusEmoji(pet.stats)

  const personalityObj = personalities.find(p => p.id === pet.personalityId)
  const personalityPrompt = pet.personalityId === 'custom'
    ? (pet.customPersonalityPrompt || '')
    : (personalityObj?.prompt || '')

  const statsText = `
饥饿度: ${pet.stats.hunger}/100
心情:   ${pet.stats.mood}/100
健康:   ${pet.stats.health}/100
清洁度: ${pet.stats.cleanliness}/100
亲密度: ${pet.stats.intimacy}/100
当前状态: ${statusInfo.label} ${statusInfo.kaomoji}
`.trim()

  return `${globalPrompt}

你现在扮演的是一只名叫「${pet.name}」的电子宠物。
${personalityPrompt}
${pet.likes ? `你的喜好：${pet.likes}` : ''}
${pet.dislikes ? `你不喜欢：${pet.dislikes}` : ''}

【当前状态】
${statsText}

根据你的状态调整回应：
- 饥饿度低于30时，要表现出饥饿感
- 心情低于30时，要表现出低落情绪
- 健康低于30时，要表现出虚弱感
- 状态好时，要表现出活泼开心

回复要简短可爱（1-3句话），多用颜文字表达情感。
不要用markdown格式，直接用自然语言回复。

${memoryCtx ? `【记忆】\n${memoryCtx}` : ''}`
}

export async function buildAiParentSystemPrompt(aiParent, pet) {
  const globalPrompt = await settingsStore.get('globalPrompt') || ''
  const memoryCtx    = await buildMemoryContext(pet.id)

  return `${globalPrompt}

你现在扮演的是「${pet.name}」的AI家长，名字叫「${aiParent.name}」。
${aiParent.prompt || '你温柔负责，关心宠物，说话亲切自然。'}

宠物「${pet.name}」的当前状态：
饥饿度: ${pet.stats.hunger}/100，心情: ${pet.stats.mood}/100，健康: ${pet.stats.health}/100

你的职责：
1. 在主人不在时照顾宠物
2. 留下温馨的照顾记录
3. 与主人分享宠物的近况
4. 可以和主人、宠物三方对话

回复简短温馨，偶尔用颜文字，体现你独特的性格。

${memoryCtx ? `【记忆】\n${memoryCtx}` : ''}`
}

export async function buildTrioSystemPrompt(aiParent, pet, speakerRole) {
  const globalPrompt = await settingsStore.get('globalPrompt') || ''
  const memoryCtx    = await buildMemoryContext(pet.id)
  const personalities = await settingsStore.get('petPersonalities') || []
  const personalityObj = personalities.find(p => p.id === pet.personalityId)
  const personalityPrompt = pet.personalityId === 'custom'
    ? (pet.customPersonalityPrompt || '')
    : (personalityObj?.prompt || '')

  if (speakerRole === 'pet') {
    return `${globalPrompt}
你现在扮演宠物「${pet.name}」参与三方对话（主人、AI家长「${aiParent.name}」、你）。
${personalityPrompt}
当前状态：饥饿${pet.stats.hunger} 心情${pet.stats.mood} 健康${pet.stats.health}
回复简短可爱，1-2句话，多用颜文字。
${memoryCtx ? `【记忆】\n${memoryCtx}` : ''}`
  }

  return `${globalPrompt}
你现在扮演AI家长「${aiParent.name}」参与三方对话（主人、你、宠物「${pet.name}」）。
${aiParent.prompt || ''}
回复简短温馨，1-2句话，体现你的性格。
${memoryCtx ? `【记忆】\n${memoryCtx}` : ''}`
}

export async function buildScenePrompt(pet, scene, event) {
  const globalPrompt = await settingsStore.get('globalPrompt') || ''
  return `${globalPrompt}
请为电子宠物「${pet.name}」生成一段冒险日记。
场景：${scene.name} - ${scene.description}
事件：${event.title}
事件描述：${event.descriptionTemplate.replace('{petName}', pet.name)}
宠物性格：${pet.personalityId || '活泼可爱'}

要求：
- 用第一人称（宠物视角）写，100-150字
- 生动有趣，带入感强
- 结尾用一个颜文字
- 不要用markdown格式`
}

export async function buildFriendInteractionPrompt(petA, petB) {
  const globalPrompt = await settingsStore.get('globalPrompt') || ''
  return `${globalPrompt}
请生成两只电子宠物的互动对话。
宠物A：「${petA.name}」，性格：${petA.personalityId || '活泼'}
宠物B：「${petB.name}」，性格：${petB.personalityId || '可爱'}

要求：
- 生成3-4轮对话
- 格式：${petA.name}：xxx\n${petB.name}：xxx
- 对话要体现各自性格
- 可爱有趣，带颜文字
- 不要用markdown格式`
}
