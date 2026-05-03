import type { WebContents } from 'electron'
import { redactSensitiveText } from '@shared/redact'
import { validateLocalHttpUrl } from '@shared/settingsValidation'

export class AiService {
  async testConnection(baseUrl: string): Promise<{ ok: boolean; models: string[]; message: string }> {
    try {
      const safeBaseUrl = validateLocalHttpUrl(baseUrl, 'Ollama URL')
      const response = await fetch(`${safeBaseUrl}/api/tags`)
      if (!response.ok) throw new Error(`Ollama returned ${response.status}`)
      const payload = (await response.json()) as { models?: Array<{ name: string }> }
      return { ok: true, models: payload.models?.map((model) => model.name) ?? [], message: 'Ollama is reachable' }
    } catch (error) {
      return { ok: false, models: [], message: error instanceof Error ? error.message : 'Unable to reach Ollama' }
    }
  }

  async streamChat(webContents: WebContents, baseUrl: string, model: string, prompt: string): Promise<void> {
    const safeBaseUrl = validateLocalHttpUrl(baseUrl, 'Ollama URL')
    const response = await fetch(`${safeBaseUrl}/api/chat`, {
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
        try {
          const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
          if (parsed.message?.content) webContents.send('ai:token-stream', parsed.message.content)
        } catch {
          // skip malformed NDJSON lines
        }
      }
    }
    webContents.send('ai:token-stream', '[DONE]')
  }

  async reviewLedger(baseUrl: string, model: string, context: unknown): Promise<Array<{ targetType: 'transaction' | 'tax' | 'report'; targetId: string; title: string; rationale: string; payloadJson: string }>> {
    if (!model.trim()) throw new Error('Select an Ollama model before generating AI review suggestions')
    const safeBaseUrl = validateLocalHttpUrl(baseUrl, 'Ollama URL')
    const response = await fetch(`${safeBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        messages: [
          {
            role: 'system',
            content:
              'You are a cautious Australian small-business bookkeeping reviewer. Return only valid JSON. Do not invent transactions. Do not give final tax advice.',
          },
          {
            role: 'user',
            content: redactSensitiveText(`Review this local ledger context and return JSON with a suggestions array. Each suggestion must have targetType transaction/tax/report, targetId, title, rationale, and payloadJson as an object.\n${JSON.stringify(context, null, 2)}`),
          },
        ],
      }),
    })
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`)
    const payload = (await response.json()) as { message?: { content?: string } }
    const content = payload.message?.content
    if (!content) throw new Error('Ollama did not return review content')
    const parsed = JSON.parse(content) as { suggestions?: Array<{ targetType?: string; targetId?: string; title?: string; rationale?: string; payloadJson?: unknown }> }
    const suggestions = parsed.suggestions ?? []
    return suggestions.slice(0, 12).map((item) => {
      const targetType = item.targetType === 'transaction' || item.targetType === 'tax' || item.targetType === 'report' ? item.targetType : 'report'
      return {
        targetType,
        targetId: String(item.targetId || targetType),
        title: String(item.title || 'AI review finding').slice(0, 160),
        rationale: String(item.rationale || 'AI review suggested human follow-up.').slice(0, 1000),
        payloadJson: JSON.stringify(item.payloadJson ?? {}),
      }
    })
  }
}
