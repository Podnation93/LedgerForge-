import { motion } from 'framer-motion'
import { BarChart3, Calculator, CircleDollarSign, Receipt, RefreshCw } from 'lucide-react'
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
import { formatAud } from '@shared/formatters'
import { ActionButton } from '../components/ActionButton'
import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { emptySummary } from '../constants'
import { useAsyncData } from '../hooks/useAsyncData'

export default function DashboardPage() {
  const [summary, reload, error] = useAsyncData('dashboard:summary', emptySummary)
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
