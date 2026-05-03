import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { useAsyncData } from '../hooks/useAsyncData'

export default function ReportsPage() {
  const [accounts] = useAsyncData('accounts:list', [])

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
