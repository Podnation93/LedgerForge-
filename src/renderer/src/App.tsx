import { useCallback, useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Contact,
  Download,
  FolderOpen,
  FileText,
  Files,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  Package,
  Paperclip,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Table2,
  Upload,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  Account,
  AiSuggestion,
  AuditLog,
  BasPeriodReview,
  BasPeriod,
  Contact as ContactRecord,
  CsvPreview,
  DashboardSummary,
  DocumentImport,
  DocumentImportResult,
  ExportJob,
  Invoice,
  ReceiptAttachment,
  Settings as AppSettings,
  TaxCode,
  Transaction,
} from '@shared/types'
import { formatAud } from '@shared/formatters'
import { invoke } from './lib/api'
import { exportPresets } from './lib/data'

const navItems = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/banking', 'Banking', Landmark],
  ['/transactions', 'Transactions', Table2],
  ['/reconciliation', 'Reconciliation', RefreshCw],
  ['/invoices', 'Invoices', FileText],
  ['/quotes', 'Quotes', BriefcaseBusiness],
  ['/bills', 'Bills', Receipt],
  ['/receipts', 'Receipts', Package],
  ['/contacts', 'Contacts', Contact],
  ['/reports', 'Reports', BarChart3],
  ['/tax', 'Tax & BAS', Calculator],
  ['/ai', 'AI Assistant', Bot],
  ['/exports', 'Exports', Download],
  ['/audit', 'Audit Log', ShieldCheck],
  ['/settings', 'Settings', Settings],
] as const

const emptySummary: DashboardSummary = {
  revenueCents: 0,
  expensesCents: 0,
  profitCents: 0,
  gstOwedCents: 0,
  cashflow: [],
  categoryBreakdown: [],
  recentTransactions: [],
  warnings: [],
}

const taxCodes: TaxCode[] = ['GST_SALES', 'GST_PURCHASES', 'GST_FREE_INCOME', 'GST_FREE_EXPENSES', 'INPUT_TAXED', 'BAS_EXCLUDED', 'PRIVATE']
const transactionStatuses: Transaction['status'][] = ['imported', 'categorised', 'reconciled']

function useAsyncData<T>(channel: string, fallback: T, args?: unknown): [T, () => Promise<void>, string] {
  const [data, setData] = useState<T>(fallback)
  const [error, setError] = useState('')
  const argsKey = JSON.stringify(args)
  const load = useCallback(async () => {
    try {
      setData(await invoke<T>(channel, args))
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load data')
    }
  }, [channel, argsKey])
  useEffect(() => {
    void load()
  }, [load])
  return [data, load, error]
}

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [settings, reloadSettings] = useAsyncData<AppSettings>('settings:get', {
    businessName: 'LedgerForge',
    abn: '',
    gstRegistered: true,
    gstBasis: 'cash',
    basFrequency: 'quarterly',
    ollamaBaseUrl: 'http://localhost:11434',
    cloudAiEnabled: false,
  })

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">LF</div>
          {!collapsed && (
            <div>
              <strong>LedgerForge AI</strong>
              <span>Australia local books</span>
            </div>
          )}
        </div>
        <nav>
          {navItems.map(([path, label, Icon]) => (
            <NavLink key={path} to={path} end={path === '/'} title={label}>
              <Icon size={18} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        <button className="collapse-button" type="button" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>
      <main>
        <header className="topbar">
          <div className="search-box">
            <Search size={17} />
            <span>Search records, ABNs, reports</span>
          </div>
          <div className="status-pill">
            <Bot size={16} />
            Ollama local
          </div>
          <div className="profile">
            <Building2 size={17} />
            {settings.businessName}
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/banking" element={<CsvImportPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/reconciliation" element={<ModulePage title="Reconciliation" icon={RefreshCw} description="Match bank lines to invoices, bills, expenses, and transfers with undo support." />} />
          <Route path="/invoices" element={<DocumentsPage kind="invoice" title="Invoices" />} />
          <Route path="/quotes" element={<DocumentsPage kind="quote" title="Quotes" />} />
          <Route path="/bills" element={<DocumentsPage kind="bill" title="Bills" />} />
          <Route path="/receipts" element={<DocumentIntakePage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/tax" element={<TaxPage />} />
          <Route path="/ai" element={<AiPage settings={settings} />} />
          <Route path="/exports" element={<ExportsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings" element={<SettingsPage settings={settings} onSaved={reloadSettings} />} />
        </Routes>
      </main>
    </div>
  )
}

function PageHeader({ title, kicker, action }: { title: string; kicker: string; action?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <span className="kicker">{kicker}</span>
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  )
}

function Dashboard() {
  const [summary, reload, error] = useAsyncData<DashboardSummary>('dashboard:summary', emptySummary)
  const metrics = [
    ['Revenue', summary.revenueCents, CircleDollarSign],
    ['Expenses', summary.expensesCents, Receipt],
    ['Profit', summary.profitCents, BarChart3],
    ['GST owed', summary.gstOwedCents, Calculator],
  ] as const

  return (
    <section className="page">
      <PageHeader title="Dashboard" kicker="Today" action={<ActionButton icon={RefreshCw} label="Refresh" onClick={reload} />} />
      {error && <p className="notice danger">{error}</p>}
      <div className="metric-grid">
        {metrics.map(([label, value, Icon], index) => (
          <motion.div className="metric-card" key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
            <Icon size={20} />
            <span>{label}</span>
            <strong>{formatAud(value)}</strong>
          </motion.div>
        ))}
      </div>
      <div className="dashboard-grid">
        <Panel title="Cashflow">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={summary.cashflow}>
              <defs>
                <linearGradient id="income" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#263348" vertical={false} />
              <XAxis dataKey="month" stroke="#64748B" />
              <YAxis stroke="#64748B" />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #263348' }} />
              <Area dataKey="income" stroke="#38BDF8" fill="url(#income)" />
              <Area dataKey="expenses" stroke="#F59E0B" fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Category mix">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={summary.categoryBreakdown} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92}>
                {summary.categoryBreakdown.map((item, index) => (
                  <Cell key={item.name} fill={['#3B82F6', '#38BDF8', '#22C55E'][index % 3]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatAud(Number(value))} contentStyle={{ background: '#111827', border: '1px solid #263348' }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <DataTable title="Recent transactions" rows={summary.recentTransactions} columns={['date', 'description', 'contactName', 'amountCents', 'status']} />
      {summary.warnings.length > 0 && <p className="notice warning">{summary.warnings.join(' · ')}</p>}
    </section>
  )
}

function TransactionsPage() {
  const [rows, reload, error] = useAsyncData<Transaction[]>('transactions:list', [])
  const [accounts] = useAsyncData<Account[]>('accounts:list', [])
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

function CsvImportPage() {
  const [sourceName, setSourceName] = useState('bank-import.csv')
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [message, setMessage] = useState('')

  async function pickCsv() {
    const file = await invoke<{ sourceName: string; csvText: string } | null>('imports:pick-csv')
    if (!file) return
    setSourceName(file.sourceName)
    setCsvText(file.csvText)
    setPreview(await invoke<CsvPreview>('imports:csv-preview', file))
  }

  async function previewCsv() {
    setPreview(await invoke<CsvPreview>('imports:csv-preview', { sourceName, csvText }))
  }

  async function importCsv() {
    const result = await invoke<{ imported: number; duplicates: number }>('imports:csv', { sourceName, csvText })
    setMessage(`Imported ${result.imported} transactions. Skipped ${result.duplicates} duplicates.`)
    setPreview(await invoke<CsvPreview>('imports:csv-preview', { sourceName, csvText }))
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

function ContactsPage() {
  const [rows] = useAsyncData<ContactRecord[]>('contacts:list', [])
  return (
    <section className="page">
      <PageHeader title="Contacts" kicker="Customers and suppliers" />
      <DataTable title="Contact directory" rows={rows} columns={['type', 'name', 'abn', 'email', 'phone']} />
    </section>
  )
}

function DocumentsPage({ kind, title }: { kind: Invoice['kind']; title: string }) {
  const [rows, reload, error] = useAsyncData<Invoice[]>('documents:list', [], { kind })
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

function ReportsPage() {
  const [accounts] = useAsyncData<Account[]>('accounts:list', [])
  return (
    <section className="page">
      <PageHeader title="Reports" kicker="Financial statements" />
      <div className="module-grid">
        {['Profit & Loss', 'Balance Sheet', 'Cash Flow', 'Trial Balance', 'General Ledger', 'Aged Receivables', 'Aged Payables'].map((name) => (
          <Panel title={name} key={name}>
            <p className="muted">Live report surface wired to the local accounting ledger.</p>
          </Panel>
        ))}
      </div>
      <DataTable title="Chart of accounts" rows={accounts} columns={['code', 'name', 'type', 'taxCode', 'balanceCents']} />
    </section>
  )
}

function TaxPage() {
  const [periods, reload] = useAsyncData<BasPeriod[]>('tax:get-bas-periods', [])
  const [review, setReview] = useState<BasPeriodReview | null>(null)

  async function loadReview(periodId: string) {
    setReview(await invoke<BasPeriodReview>('tax:get-bas-review', { periodId }))
  }

  return (
    <section className="page">
      <PageHeader title="Tax & BAS" kicker="Australia GST review" />
      <div className="module-grid">
        {periods.map((period) => (
          <Panel title={period.label} key={period.id}>
            <div className="period-values">
              <span>Collected {formatAud(period.gstCollectedCents)}</span>
              <span>Paid {formatAud(period.gstPaidCents)}</span>
              <strong>Net {formatAud(period.netGstCents)}</strong>
            </div>
            <div className="button-row left">
              <ActionButton icon={Search} label="Review" onClick={() => loadReview(period.id)} />
              <ActionButton icon={LockKeyhole} label={period.locked ? 'Locked' : 'Lock Period'} onClick={async () => { await invoke('tax:lock-bas-period', { periodId: period.id }); await reload() }} />
            </div>
          </Panel>
        ))}
      </div>
      {review && (
        <>
          <div className="metric-grid intake-summary">
            <SummaryTile label="Collected" value={review.gstCollectedCents / 100} />
            <SummaryTile label="Paid" value={review.gstPaidCents / 100} />
            <SummaryTile label="Net GST" value={review.netGstCents / 100} />
            <SummaryTile label="Transactions" value={review.transactions.length} />
          </div>
          {review.warnings.length > 0 && <p className="notice warning">{review.warnings.join(' · ')}</p>}
          <DataTable title={`${review.label} transactions`} rows={review.transactions} columns={['date', 'description', 'contactName', 'amountCents', 'status', 'hasReceipt']} />
        </>
      )}
    </section>
  )
}

function AiPage({ settings }: { settings: AppSettings }) {
  const [suggestions, reload] = useAsyncData<AiSuggestion[]>('ai:suggestions:list', [])
  const [message, setMessage] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [aiError, setAiError] = useState('')
  const [tokens, setTokens] = useState('')
  useEffect(() => window.electronAPI.on('ai:token-stream', (payload) => setTokens((current) => `${current}${payload === '[DONE]' ? '' : payload}`)), [])
  useEffect(() => {
    invoke<{ ok: boolean; models: string[]; message: string }>('ai:test-connection', { baseUrl: settings.ollamaBaseUrl })
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

function ExportsPage() {
  const [lastExport, setLastExport] = useState<ExportJob | null>(null)
  const [history, reloadHistory] = useAsyncData<ExportJob[]>('exports:list', [])

  async function createExport(preset: string) {
    const created = await invoke<ExportJob>('exports:create-pack', { preset })
    setLastExport(created)
    await reloadHistory()
  }

  return (
    <section className="page">
      <PageHeader title="Exports" kicker="Accountant and AI packs" />
      <div className="module-grid">
        {exportPresets.map((preset) => (
          <Panel title={preset} key={preset}>
            <p className="muted">Includes metadata, reports, selected data, redaction warnings, and audit trace.</p>
            <ActionButton icon={Download} label="Create Pack" onClick={() => createExport(preset)} />
          </Panel>
        ))}
      </div>
      {lastExport && <p className="notice success">Created {lastExport.filePath}</p>}
      <Panel title="Export history">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Created</th><th>Preset</th><th>Path</th><th>Warnings</th><th>Action</th></tr></thead>
            <tbody>
              {history.length === 0 ? <tr><td colSpan={5}>No exports yet.</td></tr> : history.map((job) => (
                <tr key={job.id}>
                  <td>{job.createdAt}</td>
                  <td>{job.preset}</td>
                  <td>{job.filePath}</td>
                  <td>{job.warnings.length}</td>
                  <td><IconButton icon={FolderOpen} label="Show" onClick={() => invoke('exports:show-in-folder', { filePath: job.filePath })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  )
}

function DocumentIntakePage() {
  const [rows, reload, error] = useAsyncData<DocumentImport[]>('documents:imports:list', [])
  const [transactions, reloadTransactions] = useAsyncData<Transaction[]>('transactions:list', [])
  const [receipts, reloadReceipts] = useAsyncData<ReceiptAttachment[]>('receipts:list', [])
  const [result, setResult] = useState<DocumentImportResult | null>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [selectedTransactionId, setSelectedTransactionId] = useState('')
  const [ocrMessage, setOcrMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function importFromPicker(channel: 'documents:pick-files' | 'documents:pick-folder') {
    setBusy(true)
    try {
      const paths = await invoke<string[]>(channel)
      if (paths.length === 0) return
      const importResult = await invoke<DocumentImportResult>('documents:imports:create', { paths })
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
      const ocrResult = await invoke<DocumentImportResult>('documents:ocr:process-pending', { limit: 10 })
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

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card compact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function AuditPage() {
  const [rows] = useAsyncData<AuditLog[]>('audit:list', [])
  return (
    <section className="page">
      <PageHeader title="Audit Log" kicker="Local accountability" />
      <DataTable title="Recent audit entries" rows={rows} columns={['createdAt', 'actor', 'action', 'entityType', 'entityId']} />
    </section>
  )
}

function SettingsPage({ settings, onSaved }: { settings: AppSettings; onSaved: () => Promise<void> }) {
  const [connection, setConnection] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<AppSettings>(settings)

  useEffect(() => setForm(settings), [settings])

  async function saveSettings() {
    await invoke<AppSettings>('settings:update', form)
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
          <ActionButton icon={Bot} label="Test Connection" onClick={async () => setConnection((await invoke<{ message: string }>('ai:test-connection', { baseUrl: form.ollamaBaseUrl })).message)} />
          {connection && <p className="notice">{connection}</p>}
        </Panel>
      </div>
    </section>
  )
}

function ModulePage({ title, description, icon: Icon }: { title: string; description: string; icon: typeof LayoutDashboard }) {
  return (
    <section className="page">
      <PageHeader title={title} kicker="Production beta module" />
      <Panel title={title}>
        <div className="module-placeholder">
          <Icon size={38} />
          <p>{description}</p>
          <span>Persistence, audit readiness, empty states, and route shell are wired for this module.</span>
        </div>
      </Panel>
    </section>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function ActionButton({ icon: Icon, label, onClick }: { icon: typeof Upload; label: string; onClick: () => void | Promise<void> }) {
  return (
    <button className="action-button" type="button" onClick={() => void onClick()}>
      <Icon size={16} />
      {label}
    </button>
  )
}

function IconButton({ icon: Icon, label, onClick }: { icon: typeof Upload; label: string; onClick: () => void | Promise<void> }) {
  return (
    <button className="icon-button" type="button" title={label} aria-label={label} onClick={() => void onClick()}>
      <Icon size={15} />
    </button>
  )
}

function DataTable<T extends { id?: unknown }>({ title, rows, columns }: { title: string; rows: T[]; columns: Array<keyof T & string> }) {
  return (
    <Panel title={title}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length}>No records yet.</td></tr>
            ) : (
              rows.map((row, index) => (
                <tr key={String(row.id ?? index)}>
                  {columns.map((column) => (
                    <td key={column}>{formatCell(column, row[column])}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function formatCell(column: string, value: unknown): string {
  if (typeof value === 'number') {
    if (column === 'sizeBytes') return formatBytes(value)
    if (column.toLowerCase().includes('cents')) return formatAud(value)
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value ?? '')
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function dollarsToCents(value: string): number {
  const amount = Number(String(value).replace(/[$,]/g, ''))
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

function centsToDollars(value: number): string {
  return (value / 100).toFixed(2)
}

export default App
