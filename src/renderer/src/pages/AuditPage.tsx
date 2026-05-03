import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { useAsyncData } from '../hooks/useAsyncData'

export default function AuditPage() {
  const [rows] = useAsyncData('audit:list', [])

  return (
    <section className="page">
      <PageHeader title="Audit Log" kicker="Local accountability" />
      <DataTable title="Recent audit entries" rows={rows} columns={['createdAt', 'actor', 'action', 'entityType', 'entityId']} />
    </section>
  )
}
