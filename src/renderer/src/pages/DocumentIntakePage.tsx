import { useState } from 'react'
import { Files, FolderOpen, Paperclip, Search } from 'lucide-react'
import type { DocumentImportResult } from '@shared/types'
import { formatAud } from '@shared/formatters'
import { ActionButton } from '../components/ActionButton'
import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { SummaryTile } from '../components/SummaryTile'
import { useAsyncData } from '../hooks/useAsyncData'
import { invoke } from '../lib/api'

export default function DocumentIntakePage() {
  const [rows, reload, error] = useAsyncData('documents:imports:list', [])
  const [transactions, reloadTransactions] = useAsyncData('transactions:list', [])
  const [receipts, reloadReceipts] = useAsyncData('receipts:list', [])
  const [result, setResult] = useState<DocumentImportResult | null>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [selectedTransactionId, setSelectedTransactionId] = useState('')
  const [ocrMessage, setOcrMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function importFromPicker(channel: 'documents:pick-files' | 'documents:pick-folder') {
    setBusy(true)
    try {
      const paths = await invoke(channel)
      if (paths.length === 0) return
      const importResult = await invoke('documents:imports:create', { paths })
      setResult(importResult)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function attachReceipt() {
    await invoke('receipts:attach', { documentImportId: selectedDocumentId, transactionId: selectedTransactionId })
    await Promise.all([reloadReceipts(), reloadTransactions()])
  }

  async function processOcr() {
    setBusy(true)
    try {
      const ocrResult = await invoke('documents:ocr:process-pending', { limit: 10 })
      setOcrMessage(`Processed ${ocrResult.records.length} documents. ${ocrResult.failed} failed.`)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page">
      <PageHeader
        title="Document Intake"
        kicker="Receipts, PDFs, and OCR queue"
        action={
          <div className="button-row">
            <ActionButton icon={Files} label={busy ? 'Importing...' : 'Import Files'} onClick={() => importFromPicker('documents:pick-files')} />
            <ActionButton icon={FolderOpen} label="Import Folder" onClick={() => importFromPicker('documents:pick-folder')} />
            <ActionButton icon={Search} label={busy ? 'Working...' : 'Run OCR'} onClick={processOcr} />
          </div>
        }
      />
      {error && <p className="notice danger">{error}</p>}
      {result && (
        <div className="metric-grid intake-summary">
          <SummaryTile label="Imported" value={result.imported} />
          <SummaryTile label="Duplicates" value={result.duplicates} />
          <SummaryTile label="Skipped" value={result.skipped} />
          <SummaryTile label="Failed" value={result.failed} />
        </div>
      )}
      <Panel title="OCR status">
        <p className="muted">
          PDFs and images are copied into the local intake vault, hashed for duplicate detection, and processed locally. PDFs use embedded text first, then scanned-page OCR where Poppler rendering is available.
        </p>
        {ocrMessage && <p className="notice success">{ocrMessage}</p>}
      </Panel>
      <div className="dashboard-grid">
        <Panel title="Attach receipt evidence">
          <div className="form-grid">
            <label>Imported document<select value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)}><option value="">Choose document</option>{rows.map((row) => <option key={row.id} value={row.id}>{row.fileName}</option>)}</select></label>
            <label>Transaction<select value={selectedTransactionId} onChange={(event) => setSelectedTransactionId(event.target.value)}><option value="">Choose transaction</option>{transactions.map((row) => <option key={row.id} value={row.id}>{row.date} · {row.description} · {formatAud(row.amountCents)}</option>)}</select></label>
            <ActionButton icon={Paperclip} label="Attach To Transaction" onClick={attachReceipt} />
          </div>
        </Panel>
        <DataTable title="Receipt links" rows={receipts} columns={['transactionId', 'filePath', 'sha256', 'notes']} />
      </div>
      <DataTable title="Imported documents" rows={rows} columns={['createdAt', 'fileName', 'mimeType', 'sizeBytes', 'status', 'ocrStatus', 'errorMessage']} />
    </section>
  )
}
