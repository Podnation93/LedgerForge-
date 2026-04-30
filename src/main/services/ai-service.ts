import type { WebContents } from 'electron'
import { redactSensitiveText } from '@shared/redact'

export class AiService {
  async testConnection(baseUrl: string): Promise<{ ok: boolean; models: string[]; message: string }> {
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`)
      if (!response.ok) throw new Error(`Ollama returned ${response.status}`)
      const payload = (await response.json()) as { models?: Array<{ name: string }> }
      return { ok: true, models: payload.models?.map((model) => model.name) ?? [], message: 'Ollama is reachable' }
    } catch (error) {
      return { ok: false, models: [], message: error instanceof Error ? error.message : 'Unable to reach Ollama' }
    }
  }

  async streamChat(webContents: WebContents, baseUrl: string, model: string, prompt: string): Promise<void> {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: 'user', content: redactSensitiveText(prompt) }],
      }),
    })
    if (!response.body) throw new Error('Ollama did not return a stream')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split('\n').filter(Boolean)
      for (const line of lines) {
        const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
        if (parsed.message?.content) webContents.send('ai:token-stream', parsed.message.content)
      }
    }
    webContents.send('ai:token-stream', '[DONE]')
  }
}
