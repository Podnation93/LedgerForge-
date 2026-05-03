import { useState } from 'react'
import { Check, Search, Upload } from 'lucide-react'
import type { CsvPreview } from '@shared/types'
import { ActionButton } from '../components/ActionButton'
import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { invoke } from '../lib/api'

export default function BankingPage() {
  const [sourceName, setSourceName] = useState('bank-import.csv')
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [message, setMessage] = useState('')

  async function pickCsv() {
    const file = await invoke('imports:pick-csv')
    if (!file) return
    setSourceName(file.sourceName)
    setCsvText(file.csvText)
    setPreview(await invoke('imports:csv-preview', file))
  }

  async function previewCsv() {
    setPreview(await invoke('imports:csv-preview', { sourceName, csvText }))
  }

  async function importCsv() {
    const result = await invoke('imports:csv', { sourceName, csvText })
    setMessage(`Imported ${result.imported} transactions. Skipped ${result.duplicates} duplicates.`)
    setPreview(await invoke('imports:csv-preview', { sourceName, csvText }))
  }

  return (
    <section className="page">
      <PageHeader
        title="CSV Import Review"
        kicker="Banking"
        action={<div className="button-row"><ActionButton icon={Upload} label="Choose CSV" onClick={pickCsv} /><ActionButton icon={Search} label="Preview" onClick={previewCsv} /><ActionButton icon={Check} label="Import Valid Rows" onClick={importCsv} /></div>}
      />
      <div className="dashboard-grid">
        <Panel title="CSV source">
          <div className="form-grid">
            <label>Source name<input value={sourceName} onChange={(event) => setSourceName(event.target.value)} /></label>
            <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="Paste CSV with date, description, amount, and optional contact columns..." />
          </div>
        </Panel>
        <Panel title="Review summary">
          {preview ? (
            <div className="period-values">
              <span>Total rows {preview.rowCount}</span>
              <span>Ready to import {preview.importable}</span>
              <span>Duplicates {preview.duplicates}</span>
              <span>Errors {preview.errors}</span>
            </div>
          ) : <p className="muted">Choose or paste a CSV, then preview before importing.</p>}
          {message && <p className="notice success">{message}</p>}
        </Panel>
      </div>
      {preview && <DataTable title="Preview rows" rows={preview.rows.map((row, index) => ({ id: index, ...row }))} columns={['date', 'description', 'contactName', 'amountCents', 'duplicate', 'error']} />}
    </section>
  )
}
