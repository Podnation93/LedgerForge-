import { useState } from 'react'
import { Save } from 'lucide-react'
import type { Invoice } from '@shared/types'
import { formatAud } from '@shared/formatters'
import { ActionButton } from '../components/ActionButton'
import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { useAsyncData } from '../hooks/useAsyncData'
import { invoke } from '../lib/api'
import { centsToDollars, dollarsToCents } from '../utils/money'

interface DocumentRegisterPageProps {
  kind: Invoice['kind']
  title: string
}

export default function DocumentRegisterPage({ kind, title }: DocumentRegisterPageProps) {
  const [rows, reload, error] = useAsyncData('documents:list', [], { kind })
  const [message, setMessage] = useState('')
  const prefix = kind === 'bill' ? 'BILL' : kind === 'quote' ? 'QUO' : 'INV'
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    number: `${prefix}-${String(rows.length + 1).padStart(4, '0')}`,
    contactName: '',
    issueDate: today,
    dueDate: today,
    status: 'draft' as Invoice['status'],
    subtotalDollars: '0.00',
    gstDollars: '0.00',
  })

  function updateSubtotal(value: string) {
    const subtotalCents = dollarsToCents(value)
    setForm({
      ...form,
      subtotalDollars: value,
      gstDollars: centsToDollars(Math.round(subtotalCents * 0.1)),
    })
  }

  async function createDocument() {
    const subtotalCents = dollarsToCents(form.subtotalDollars)
    const gstCents = dollarsToCents(form.gstDollars)
    await invoke('documents:create', {
      kind,
      number: form.number,
      contactName: form.contactName,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      status: form.status,
      subtotalCents,
      gstCents,
      totalCents: subtotalCents + gstCents,
    })
    setMessage(`${title.slice(0, -1)} ${form.number} created.`)
    setForm({
      number: `${prefix}-${String(rows.length + 2).padStart(4, '0')}`,
      contactName: '',
      issueDate: today,
      dueDate: today,
      status: 'draft',
      subtotalDollars: '0.00',
      gstDollars: '0.00',
    })
    await reload()
  }

  return (
    <section className="page">
      <PageHeader title={title} kicker="Documents" />
      {error && <p className="notice danger">{error}</p>}
      <div className="dashboard-grid">
        <Panel title={`Create ${title.slice(0, -1).toLowerCase()}`}>
          <div className="form-grid">
            <label>Number<input value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} /></label>
            <label>Contact<input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></label>
            <label>Issue date<input type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} /></label>
            <label>Due date<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
            <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Invoice['status'] })}><option value="draft">draft</option><option value="sent">sent</option><option value="paid">paid</option><option value="overdue">overdue</option></select></label>
            <label>Subtotal AUD<input inputMode="decimal" value={form.subtotalDollars} onChange={(event) => updateSubtotal(event.target.value)} /></label>
            <label>GST AUD<input inputMode="decimal" value={form.gstDollars} onChange={(event) => setForm({ ...form, gstDollars: event.target.value })} /></label>
            <p className="muted">Total {formatAud(dollarsToCents(form.subtotalDollars) + dollarsToCents(form.gstDollars))}</p>
            <ActionButton icon={Save} label={`Create ${title.slice(0, -1)}`} onClick={createDocument} />
            {message && <p className="notice success">{message}</p>}
          </div>
        </Panel>
        <Panel title="Document rules">
          <div className="period-values">
            <span>Amounts are stored in cents.</span>
            <span>GST defaults to 10 percent of subtotal and can be edited.</span>
            <span>Status and dates are captured for register tracking.</span>
          </div>
        </Panel>
      </div>
      <DataTable title={`${title} register`} rows={rows} columns={['number', 'contactName', 'issueDate', 'dueDate', 'status', 'totalCents']} />
    </section>
  )
}
