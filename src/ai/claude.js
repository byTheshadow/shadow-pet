import { settingsStore } from '../store/db.js'
import { logger } from '../utils/logger.js'

export async function getApiConfig() {
  const config = await settingsStore.get('apiConfig')
  return {
    apiKey:      config?.apiKey      || '',
    apiEndpoint: config?.apiEndpoint || 'https://api.deepseek.com',
    modelName:   config?.modelName   || '',
  }
}

export async function fetchAvailableModels() {
  const { apiKey, apiEndpoint } = await getApiConfig()
  if (!apiKey || !apiEndpoint) {
    throw new Error('请先配置 API Key 和接口地址')
  }
  const base = apiEndpoint.replace(/\/$/, '')
  const res = await fetch(`${base}/v1/models`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`获取模型列表失败: ${res.status} ${text}`)
  }
  const data = await res.json()
  // 兼容 OpenAI / DeepSeek / Claude 格式
  const models = data.data || data.models || []
  return models.map(m => ({
    id:   m.id   || m.name || String(m),
    name: m.id   || m.name || String(m),
  }))
}

export async function callAI({ systemPrompt, messages, stream = false, onChunk = null }) {
  const { apiKey, apiEndpoint, modelName } = await getApiConfig()

  if (!apiKey)    throw new Error('未配置 API Key')
  if (!modelName) throw new Error('未选择模型')

  const base = apiEndpoint.replace(/\/$/, '')
  const url  = `${base}/v1/chat/completions`

  const body = {
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    stream,
    max_tokens: 1024,
    temperature: 0.85,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API 请求失败: ${res.status} ${text}`)
  }

  if (stream && onChunk) {
    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let fullText  = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const jsonStr = line.replace('data: ', '').trim()
        if (jsonStr === '[DONE]') continue
        try {
          const parsed = JSON.parse(jsonStr)
          const delta  = parsed.choices?.[0]?.delta?.content || ''
          if (delta) {
            fullText += delta
            onChunk(delta, fullText)
          }
        } catch (_) { /* ignore parse errors on stream chunks */ }
      }
    }
    return fullText
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}
