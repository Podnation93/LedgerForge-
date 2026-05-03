import { useEffect, useState } from 'react'
import { Bot, Save } from 'lucide-react'
import type { Settings as AppSettings } from '@shared/types'
import { ActionButton } from '../components/ActionButton'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { invoke } from '../lib/api'

interface SettingsPageProps {
  settings: AppSettings
  onSaved: () => Promise<void>
}

export default function SettingsPage({ settings, onSaved }: SettingsPageProps) {
  const [connection, setConnection] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<AppSettings>(settings)

  useEffect(() => setForm(settings), [settings])

  async function saveSettings() {
    await invoke('settings:update', form)
    await onSaved()
    setMessage('Settings saved.')
  }

  return (
    <section className="page">
      <PageHeader title="Settings" kicker="Australia defaults" />
      <div className="settings-grid">
        <Panel title="Business">
          <div className="form-grid">
            <label>Business name<input value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} /></label>
            <label>ABN<input value={form.abn} onChange={(event) => setForm({ ...form, abn: event.target.value })} /></label>
            <label>GST basis<select value={form.gstBasis} onChange={(event) => setForm({ ...form, gstBasis: event.target.value as AppSettings['gstBasis'] })}><option value="cash">cash</option><option value="accrual">accrual</option></select></label>
            <label>BAS frequency<select value={form.basFrequency} onChange={(event) => setForm({ ...form, basFrequency: event.target.value as AppSettings['basFrequency'] })}><option value="monthly">monthly</option><option value="quarterly">quarterly</option><option value="annual">annual</option></select></label>
            <label className="check-row"><input type="checkbox" checked={form.gstRegistered} onChange={(event) => setForm({ ...form, gstRegistered: event.target.checked })} /> GST registered</label>
            <label className="check-row"><input type="checkbox" checked={form.cloudAiEnabled} onChange={(event) => setForm({ ...form, cloudAiEnabled: event.target.checked })} /> Cloud AI enabled</label>
            <ActionButton icon={Save} label="Save Settings" onClick={saveSettings} />
            {message && <p className="notice success">{message}</p>}
          </div>
        </Panel>
        <Panel title="AI Provider">
          <div className="form-grid">
            <label>Ollama URL<input value={form.ollamaBaseUrl} onChange={(event) => setForm({ ...form, ollamaBaseUrl: event.target.value })} /></label>
          </div>
          <ActionButton icon={Bot} label="Test Connection" onClick={async () => setConnection((await invoke('ai:test-connection', { baseUrl: form.ollamaBaseUrl })).message)} />
          {connection && <p className="notice">{connection}</p>}
        </Panel>
      </div>
    </section>
  )
}
