import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import type { TaxCode, Transaction } from '@shared/types'
import { formatAud } from '@shared/formatters'
import { ActionButton } from '../components/ActionButton'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { taxCodes, transactionStatuses } from '../constants'
import { useAsyncData } from '../hooks/useAsyncData'
import { invoke } from '../lib/api'

export default function TransactionsPage() {
  const [rows, reload, error] = useAsyncData('transactions:list', [])
  const [accounts] = useAsyncData('accounts:list', [])
  const [selectedId, setSelectedId] = useState('')
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0]
  const [form, setForm] = useState({ accountId: '', taxCode: 'GST_PURCHASES' as TaxCode, hasReceipt: false, businessUsePercent: 100, status: 'imported' as Transaction['status'] })

  useEffect(() => {
    if (!selected) return
    const split = selected.splits[0]
    setSelectedId(selected.id)
    setForm({
      accountId: split?.accountId ?? accounts[0]?.id ?? '',
      taxCode: split?.taxCode ?? (selected.amountCents >= 0 ? 'GST_SALES' : 'GST_PURCHASES'),
      hasReceipt: selected.hasReceipt,
      businessUsePercent: split?.businessUsePercent ?? 100,
      status: selected.status,
    })
  }, [selected?.id, accounts])

  async function saveCategorisation() {
    if (!selected) return
    await invoke('transactions:update-categorisation', { id: selected.id, ...form })
    await reload()
  }

  return (
    <section className="page">
      <PageHeader title="Transactions" kicker="Banking" />
      {error && <p className="notice danger">{error}</p>}
      <div className="dashboard-grid">
        <Panel title="Transaction feed">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Contact</th><th>Amount</th><th>Status</th><th>Receipt</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={6}>No records yet.</td></tr> : rows.map((row) => (
                  <tr key={row.id} className={row.id === selected?.id ? 'selected-row' : ''} onClick={() => setSelectedId(row.id)}>
                    <td>{row.date}</td>
                    <td>{row.description}</td>
                    <td>{row.contactName}</td>
                    <td>{formatAud(row.amountCents)}</td>
                    <td>{row.status}</td>
                    <td>{row.hasReceipt ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Categorisation">
          {selected ? (
            <div className="form-grid">
              <p className="muted">{selected.description} · {formatAud(selected.amountCents)}</p>
              <label>Account<select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} {account.name}</option>)}</select></label>
              <label>GST code<select value={form.taxCode} onChange={(event) => setForm({ ...form, taxCode: event.target.value as TaxCode })}>{taxCodes.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
              <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Transaction['status'] })}>{transactionStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
              <label>Business use %<input type="number" min={0} max={100} value={form.businessUsePercent} onChange={(event) => setForm({ ...form, businessUsePercent: Number(event.target.value) })} /></label>
              <label className="check-row"><input type="checkbox" checked={form.hasReceipt} onChange={(event) => setForm({ ...form, hasReceipt: event.target.checked })} /> Receipt attached</label>
              <ActionButton icon={Save} label="Save Categorisation" onClick={saveCategorisation} />
            </div>
          ) : <p className="muted">Select a transaction to categorise.</p>}
        </Panel>
      </div>
    </section>
  )
}
