import { useEffect, useState } from 'react'
import { Bot, Check, Sparkles, X } from 'lucide-react'
import type { AiSuggestion, Settings as AppSettings } from '@shared/types'
import { ActionButton } from '../components/ActionButton'
import { IconButton } from '../components/IconButton'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { useAsyncData } from '../hooks/useAsyncData'
import { invoke } from '../lib/api'

interface AiPageProps {
  settings: AppSettings
}

export default function AiPage({ settings }: AiPageProps) {
  const [suggestions, reload] = useAsyncData('ai:suggestions:list', [])
  const [message, setMessage] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [aiError, setAiError] = useState('')
  const [tokens, setTokens] = useState('')

  useEffect(() => {
    window.electronAPI.on('ai:token-stream', (payload) => setTokens((current) => `${current}${payload === '[DONE]' ? '' : payload}`))
  }, [])

  useEffect(() => {
    invoke('ai:test-connection', { baseUrl: settings.ollamaBaseUrl })
      .then((result) => {
        setModels(result.models)
        setModel((current) => current || result.models[0] || '')
        setAiError(result.ok ? '' : result.message)
      })
      .catch((error) => setAiError(error instanceof Error ? error.message : 'Unable to reach Ollama'))
  }, [settings.ollamaBaseUrl])

  async function updateSuggestion(id: string, status: AiSuggestion['status']) {
    await invoke('ai:suggestions:update-status', { id, status })
    await reload()
  }

  async function generateAiReview() {
    try {
      setAiError('')
      await invoke('ai:suggestions:generate-ai-review', { baseUrl: settings.ollamaBaseUrl, model })
      await reload()
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI review failed')
    }
  }

  return (
    <section className="page">
      <PageHeader
        title="AI Assistant"
        kicker="Private local Ollama"
        action={<ActionButton icon={Sparkles} label="Generate AI Review" onClick={generateAiReview} />}
      />
      {aiError && <p className="notice danger">{aiError}</p>}
      <Panel title="Local chat">
        <div className="form-grid">
          <label>Model<select value={model} onChange={(event) => setModel(event.target.value)}>{models.length === 0 ? <option value="">No models found</option> : models.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        </div>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask for a source-backed accounting review..." />
        <ActionButton icon={Bot} label="Stream from Ollama" onClick={async () => { setTokens(''); await invoke('ai:stream-chat', { baseUrl: settings.ollamaBaseUrl, model, prompt: message }) }} />
        <pre className="ai-output">{tokens || 'Ollama responses stream here. AI suggestions stay in review until approved.'}</pre>
      </Panel>
      <Panel title="Suggestion queue">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Created</th><th>Status</th><th>Target</th><th>Title</th><th>Rationale</th><th>Actions</th></tr></thead>
            <tbody>
              {suggestions.length === 0 ? <tr><td colSpan={6}>No suggestions yet.</td></tr> : suggestions.map((suggestion) => (
                <tr key={suggestion.id}>
                  <td>{suggestion.createdAt}</td>
                  <td>{suggestion.status}</td>
                  <td>{suggestion.targetType}</td>
                  <td>{suggestion.title}</td>
                  <td>{suggestion.rationale}</td>
                  <td><div className="button-row left"><IconButton icon={Check} label="Approve" onClick={() => updateSuggestion(suggestion.id, 'APPROVED')} /><IconButton icon={X} label="Reject" onClick={() => updateSuggestion(suggestion.id, 'REJECTED')} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  )
}
