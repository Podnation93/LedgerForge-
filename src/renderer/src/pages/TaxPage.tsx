import { useState } from 'react'
import { LockKeyhole, Search } from 'lucide-react'
import type { BasPeriodReview } from '@shared/types'
import { formatAud } from '@shared/formatters'
import { ActionButton } from '../components/ActionButton'
import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { SummaryTile } from '../components/SummaryTile'
import { useAsyncData } from '../hooks/useAsyncData'
import { invoke } from '../lib/api'

export default function TaxPage() {
  const [periods, reload] = useAsyncData('tax:get-bas-periods', [])
  const [review, setReview] = useState<BasPeriodReview | null>(null)

  async function loadReview(periodId: string) {
    setReview(await invoke('tax:get-bas-review', { periodId }))
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
