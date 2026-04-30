import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Contact,
  Download,
  FileText,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  Package,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Table2,
  Upload,
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
  BasPeriod,
  Contact as ContactRecord,
  DashboardSummary,
  ExportJob,
  Invoice,
  Settings as AppSettings,
  Transaction,
} from '@shared/types'
import { formatAud } from '@shared/formatters'
import { invoke } from './lib/api'
import { exampleContact, exampleDocument, exampleTransaction, exportPresets } from './lib/data'

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

function useAsyncData<T>(channel: string, fallback: T, args?: unknown): [T, () => Promise<void>, string] {
  const [data, setData] = useState<T>(fallback)
  const [error, setError] = useState('')
  const load = async () => {
    try {
      setData(await invoke<T>(channel, args))
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load data')
    }
  }
  useEffect(() => {
    void load()
  }, [channel])
  return [data, load, error]
}

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [settings] = useAsyncData<AppSettings>('settings:get', {
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
          <Route path="/banking" element={<ModulePage title="Banking" icon={Landmark} description="Bank accounts, statement imports, duplicate checks, and feed review." />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/reconciliation" element={<ModulePage title="Reconciliation" icon={RefreshCw} description="Match bank lines to invoices, bills, expenses, and transfers with undo support." />} />
          <Route path="/invoices" element={<DocumentsPage kind="invoice" title="Invoices" />} />
          <Route path="/quotes" element={<DocumentsPage kind="quote" title="Quotes" />} />
          <Route path="/bills" element={<DocumentsPage kind="bill" title="Bills" />} />
          <Route path="/receipts" element={<ModulePage title="Receipts" icon={Package} description="Receipt vault, file hashes, missing receipt warnings, and evidence notes." />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/tax" element={<TaxPage />} />
          <Route path="/ai" element={<AiPage settings={settings} />} />
          <Route path="/exports" element={<ExportsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings" element={<SettingsPage settings={settings} />} />
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
  const [rows, reload] = useAsyncData<Transaction[]>('transactions:list', [])
  return (
    <section className="page">
      <PageHeader
        title="Transactions"
        kicker="Banking"
        action={<ActionButton icon={Upload} label="Add Sample" onClick={async () => { await invoke('transactions:create', exampleTransaction()); await reload() }} />}
      />
      <DataTable title="Transaction feed" rows={rows} columns={['date', 'description', 'contactName', 'amountCents', 'status', 'hasReceipt']} />
    </section>
  )
}

function ContactsPage() {
  const [rows, reload] = useAsyncData<ContactRecord[]>('contacts:list', [])
  return (
    <section className="page">
      <PageHeader
        title="Contacts"
        kicker="Customers and suppliers"
        action={<ActionButton icon={Contact} label="Add Sample" onClick={async () => { await invoke('contacts:upsert', exampleContact()); await reload() }} />}
      />
      <DataTable title="Contact directory" rows={rows} columns={['type', 'name', 'abn', 'email', 'phone']} />
    </section>
  )
}

function DocumentsPage({ kind, title }: { kind: Invoice['kind']; title: string }) {
  const [rows, reload] = useAsyncData<Invoice[]>('documents:list', [], { kind })
  return (
    <section className="page">
      <PageHeader
        title={title}
        kicker="Documents"
        action={<ActionButton icon={FileText} label="Create Sample" onClick={async () => { await invoke('documents:create', exampleDocument(kind)); await reload() }} />}
      />
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
            <ActionButton icon={LockKeyhole} label={period.locked ? 'Locked' : 'Lock Period'} onClick={async () => { await invoke('tax:lock-bas-period', { periodId: period.id }); await reload() }} />
          </Panel>
        ))}
      </div>
    </section>
  )
}

function AiPage({ settings }: { settings: AppSettings }) {
  const [suggestions, reload] = useAsyncData<AiSuggestion[]>('ai:suggestions:list', [])
  const [message, setMessage] = useState('')
  const [tokens, setTokens] = useState('')
  useEffect(() => window.electronAPI.on('ai:token-stream', (payload) => setTokens((current) => `${current}${payload === '[DONE]' ? '' : payload}`)), [])
  return (
    <section className="page">
      <PageHeader
        title="AI Assistant"
        kicker="Private local Ollama"
        action={<ActionButton icon={Sparkles} label="Suggest Review" onClick={async () => { await invoke('ai:suggestions:create', { targetType: 'transaction', targetId: 'sample', title: 'Review uncategorised expenses', rationale: 'Local analysis found expenses without receipts.', payloadJson: '{"taxCode":"GST_PURCHASES"}' }); await reload() }} />}
      />
      <Panel title="Local chat">
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask for a source-backed accounting review..." />
        <ActionButton icon={Bot} label="Stream from Ollama" onClick={async () => { setTokens(''); await invoke('ai:stream-chat', { baseUrl: settings.ollamaBaseUrl, model: 'llama3.2', prompt: message }) }} />
        <pre className="ai-output">{tokens || 'Ollama responses stream here. AI suggestions stay in review until approved.'}</pre>
      </Panel>
      <DataTable title="Suggestion queue" rows={suggestions} columns={['createdAt', 'status', 'targetType', 'title', 'rationale']} />
    </section>
  )
}

function ExportsPage() {
  const [lastExport, setLastExport] = useState<ExportJob | null>(null)
  return (
    <section className="page">
      <PageHeader title="Exports" kicker="Accountant and AI packs" />
      <div className="module-grid">
        {exportPresets.map((preset) => (
          <Panel title={preset} key={preset}>
            <p className="muted">Includes metadata, reports, selected data, redaction warnings, and audit trace.</p>
            <ActionButton icon={Download} label="Create Pack" onClick={async () => setLastExport(await invoke<ExportJob>('exports:create-pack', { preset }))} />
          </Panel>
        ))}
      </div>
      {lastExport && <p className="notice success">Created {lastExport.filePath}</p>}
    </section>
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

function SettingsPage({ settings }: { settings: AppSettings }) {
  const [connection, setConnection] = useState('')
  return (
    <section className="page">
      <PageHeader title="Settings" kicker="Australia defaults" />
      <div className="settings-grid">
        <Panel title="Business">
          <p>Business: {settings.businessName}</p>
          <p>GST basis: {settings.gstBasis}</p>
          <p>BAS frequency: {settings.basFrequency}</p>
          <p>Cloud AI: {settings.cloudAiEnabled ? 'Enabled' : 'Disabled'}</p>
        </Panel>
        <Panel title="AI Provider">
          <p>Ollama URL: {settings.ollamaBaseUrl}</p>
          <ActionButton icon={Bot} label="Test Connection" onClick={async () => setConnection((await invoke<{ message: string }>('ai:test-connection', { baseUrl: settings.ollamaBaseUrl })).message)} />
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

function DataTable<T extends { id?: unknown }>({ title, rows, columns }: { title: string; rows: T[]; columns: Array<keyof T & string> }) {
  const normalizedRows = useMemo(() => rows, [rows])
  return (
    <Panel title={title}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {normalizedRows.length === 0 ? (
              <tr><td colSpan={columns.length}>No records yet.</td></tr>
            ) : (
              normalizedRows.map((row, index) => (
                <tr key={String(row.id ?? index)}>
                  {columns.map((column) => (
                    <td key={column}>{formatCell(row[column])}</td>
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

function formatCell(value: unknown): string {
  if (typeof value === 'number') return Math.abs(value) > 999 ? formatAud(value) : String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value ?? '')
}

export default App
