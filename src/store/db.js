import Dexie from 'dexie'

export const db = new Dexie('ShadowPetDB')

db.version(1).stores({
  pets:         '++id, name, createdAt',
  aiParents:    '++id, name, createdAt',
  globalSettings: 'key',
  scenes:       '++id, name',
  sceneEvents:  '++id, sceneId',
  memories:     '++id, petId, timestamp, type',
  chatHistory:  '++id, petId, timestamp, role',
  adventureLogs:'++id, petId, timestamp, sceneId',
  friendships:  '++id, petAId, petBId',
  errorLogs:    '++id, timestamp, level',
})

// 默认数据初始化
export async function initDefaultData() {
  const count = await db.globalSettings.count()
  if (count === 0) {
    await db.globalSettings.bulkPut([
      {
        key: 'apiConfig',
        value: {
          apiKey: '',
          apiEndpoint: 'https://api.deepseek.com',
          modelName: '',
        }
      },
      {
        key: 'globalPrompt',
        value: `你正在扮演一个电子宠物世界中的角色。这个世界温馨、可爱、充满奇幻色彩。
所有角色都用简短、生动的语言交流，喜欢用颜文字表达情感。
保持角色一致性，根据宠物当前的状态和性格来回应。`
      },
      {
        key: 'petPersonalities',
        value: [
          { id: 'cheerful',  label: '开朗活泼', prompt: '你性格开朗活泼，总是充满能量，喜欢玩耍，说话带着兴奋感，常用 (≧▽≦) 这类颜文字。' },
          { id: 'tsundere',  label: '傲娇',     prompt: '你性格傲娇，表面冷淡实则在意，说话时会假装不在乎但偶尔露出真心，常用 (｀・ω・´) 这类颜文字。' },
          { id: 'gentle',    label: '温柔治愈', prompt: '你性格温柔，说话轻声细语，总是给人安慰和温暖，常用 (´｡• ᵕ •｡`) 这类颜文字。' },
          { id: 'curious',   label: '好奇探索', prompt: '你对一切都充满好奇，喜欢提问和探索，说话时充满疑问和惊叹，常用 (・o・) 这类颜文字。' },
          { id: 'lazy',      label: '慵懒咸鱼', prompt: '你性格慵懒，喜欢睡觉和发呆，说话有气无力但偶尔会说出很有深度的话，常用 (´-ω-`) 这类颜文字。' },
          { id: 'custom',    label: '自定义',   prompt: '' },
        ]
      },
      {
        key: 'decayConfig',
        value: {
          intervalMinutes: 30,
          rates: {
            hunger:    -3,
            mood:      -2,
            health:    -1,
            cleanliness: -2,
            intimacy:  -1,
          }
        }
      },
      {
        key: 'aiParentConfig',
        value: {
          enabled: true,
          activityFrequency: 3,
          defaultPrompt: '你是宠物的AI家长，温柔负责，会定期照顾宠物并留下温馨留言。说话风格亲切自然，偶尔用颜文字。',
        }
      }
    ])
  }

  // 默认场景
  const sceneCount = await db.scenes.count()
  if (sceneCount === 0) {
    const scenes = [
      {
        name: '城市公园',
        emoji: '🌳',
        description: '阳光明媚的公园，有草坪、喷泉和小松鼠。',
        backgroundGradient: 'from-green-100 to-blue-100',
        unlocked: true,
        requiredLevel: 0,
      },
      {
        name: '海边沙滩',
        emoji: '🏖️',
        description: '金色沙滩，海浪轻拍，偶尔有海鸥飞过。',
        backgroundGradient: 'from-yellow-100 to-cyan-100',
        unlocked: true,
        requiredLevel: 0,
      },
      {
        name: '魔法森林',
        emoji: '🌲',
        description: '神秘的森林，树木会发光，住着各种精灵。',
        backgroundGradient: 'from-purple-100 to-green-100',
        unlocked: false,
        requiredLevel: 5,
      },
      {
        name: '星空宇宙',
        emoji: '🚀',
        description: '浩瀚宇宙，星星触手可及，偶尔遇到外星朋友。',
        backgroundGradient: 'from-indigo-100 to-purple-100',
        unlocked: false,
        requiredLevel: 10,
      },
      {
        name: '甜品王国',
        emoji: '🍰',
        description: '一切都是甜品做的王国，空气里都是奶油香。',
        backgroundGradient: 'from-pink-100 to-yellow-100',
        unlocked: false,
        requiredLevel: 3,
      },
      {
        name: '温泉小屋',
        emoji: '♨️',
        description: '山间温泉，热气腾腾，最适合放松身心。',
        backgroundGradient: 'from-orange-100 to-red-100',
        unlocked: false,
        requiredLevel: 7,
      },
    ]
    for (const scene of scenes) {
      const sceneId = await db.scenes.add(scene)
      // 每个场景添加默认事件
      await db.sceneEvents.bulkAdd(getDefaultEvents(sceneId, scene.name))
    }
  }
}

function getDefaultEvents(sceneId, sceneName) {
  const baseEvents = [
    {
      sceneId,
      type: 'item',
      weight: 30,
      title: '捡到了小东西',
      descriptionTemplate: `在${sceneName}散步时，{petName}发现了一个闪闪发光的小东西！`,
      statChanges: { mood: 10, intimacy: 5 },
    },
    {
      sceneId,
      type: 'friend',
      weight: 25,
      title: '遇到了新朋友',
      descriptionTemplate: `{petName}在${sceneName}遇到了一只友善的小动物，他们玩得很开心！`,
      statChanges: { mood: 15, health: 5 },
    },
    {
      sceneId,
      type: 'rest',
      weight: 20,
      title: '舒适地休息了',
      descriptionTemplate: `{petName}在${sceneName}找到了一个舒适的角落，美美地休息了一会儿。`,
      statChanges: { health: 10, mood: 5 },
    },
    {
      sceneId,
      type: 'food',
      weight: 25,
      title: '发现了美食',
      descriptionTemplate: `{petName}在${sceneName}发现了好吃的东西，吃得肚子圆滚滚的！`,
      statChanges: { hunger: 20, mood: 10 },
    },
  ]
  return baseEvents
}

// 通用 CRUD helpers
export const settingsStore = {
  async get(key) {
    const row = await db.globalSettings.get(key)
    return row ? row.value : null
  },
  async set(key, value) {
    await db.globalSettings.put({ key, value })
  },
}

export const petStore = {
  async getAll() { return db.pets.orderBy('createdAt').toArray() },
  async get(id)  { return db.pets.get(id) },
  async create(data) {
    return db.pets.add({
      ...data,
      stats: { hunger: 80, mood: 80, health: 80, cleanliness: 80, intimacy: 50 },
      level: 1,
      exp: 0,
      friends: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    })
  },
  async update(id, data) { return db.pets.update(id, data) },
  async delete(id) {
    await db.pets.delete(id)
    await db.memories.where('petId').equals(id).delete()
    await db.chatHistory.where('petId').equals(id).delete()
    await db.adventureLogs.where('petId').equals(id).delete()
    await db.friendships.where('petAId').equals(id).or('petBId').equals(id).delete()
  },
}

export const aiParentStore = {
  async getAll() { return db.aiParents.orderBy('createdAt').toArray() },
  async get(id)  { return db.aiParents.get(id) },
  async create(data) {
    return db.aiParents.add({ ...data, createdAt: Date.now(), lastActionAt: 0 })
  },
  async update(id, data) { return db.aiParents.update(id, data) },
  async delete(id) { return db.aiParents.delete(id) },
}

export const memoryStore = {
  async getByPet(petId, limit = 50) {
    return db.memories.where('petId').equals(petId).reverse().limit(limit).toArray()
  },
  async add(data) {
    return db.memories.add({ ...data, timestamp: Date.now() })
  },
  async getSummaries(petId) {
    return db.memories.where({ petId, type: 'summary' }).toArray()
  },
  async deleteOld(petId, keepCount = 100) {
    const all = await db.memories.where('petId').equals(petId).toArray()
    if (all.length > keepCount) {
      const toDelete = all.slice(0, all.length - keepCount).map(m => m.id)
      await db.memories.bulkDelete(toDelete)
    }
  },
  async deleteAll(petId) {
    await db.memories.where('petId').equals(petId).delete()
  },
}

export const chatStore = {
  async getByPet(petId, limit = 100) {
    return db.chatHistory.where('petId').equals(petId).limit(limit).toArray()
  },
  async add(data) {
    return db.chatHistory.add({ ...data, timestamp: Date.now() })
  },
  async deleteAll(petId) {
    await db.chatHistory.where('petId').equals(petId).delete()
  },
  async deleteOld(petId, keepCount = 200) {
    const all = await db.chatHistory.where('petId').equals(petId).sortBy('timestamp')
    if (all.length > keepCount) {
      const toDelete = all.slice(0, all.length - keepCount).map(m => m.id)
      await db.chatHistory.bulkDelete(toDelete)
    }
  },
}

export const adventureStore = {
  async getByPet(petId, limit = 30) {
    return db.adventureLogs.where('petId').equals(petId).reverse().limit(limit).toArray()
  },
  async add(data) {
    return db.adventureLogs.add({ ...data, timestamp: Date.now() })
  },
  async deleteAll(petId) {
    await db.adventureLogs.where('petId').equals(petId).delete()
  },
}

export const friendshipStore = {
  async getByPet(petId) {
    const a = await db.friendships.where('petAId').equals(petId).toArray()
    const b = await db.friendships.where('petBId').equals(petId).toArray()
    return [...a, ...b]
  },
  async add(petAId, petBId) {
    const exists = await db.friendships
      .where('petAId').equals(petAId).and(f => f.petBId === petBId)
      .or('petAId').equals(petBId).and(f => f.petBId === petAId)
      .count()
    if (exists === 0) {
      return db.friendships.add({ petAId, petBId, createdAt: Date.now(), interactionCount: 0 })
    }
  },
  async incrementInteraction(id) {
    const f = await db.friendships.get(id)
    if (f) await db.friendships.update(id, { interactionCount: (f.interactionCount || 0) + 1 })
  },
  async delete(id) { return db.friendships.delete(id) },
}

export const errorLogStore = {
  async add(level, message, stack = '') {
    return db.errorLogs.add({ timestamp: Date.now(), level, message, stack })
  },
  async getAll(limit = 200) {
    return db.errorLogs.orderBy('timestamp').reverse().limit(limit).toArray()
  },
  async clear() { return db.errorLogs.clear() },
}

// 清除所有数据
export async function clearAllData() {
  await db.pets.clear()
  await db.aiParents.clear()
  await db.globalSettings.clear()
  await db.scenes.clear()
  await db.sceneEvents.clear()
  await db.memories.clear()
  await db.chatHistory.clear()
  await db.adventureLogs.clear()
  await db.friendships.clear()
  await db.errorLogs.clear()
}

// 获取数据库大小估算
export async function getStorageEstimate() {
  const counts = {
    pets:          await db.pets.count(),
    memories:      await db.memories.count(),
    chatHistory:   await db.chatHistory.count(),
    adventureLogs: await db.adventureLogs.count(),
    errorLogs:     await db.errorLogs.count(),
  }
  return counts
}
