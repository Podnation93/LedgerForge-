import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { useAsyncData } from '../hooks/useAsyncData'

export default function ContactsPage() {
  const [rows] = useAsyncData('contacts:list', [])

  return (
    <section className="page">
      <PageHeader title="Contacts" kicker="Customers and suppliers" />
      <DataTable title="Contact directory" rows={rows} columns={['type', 'name', 'abn', 'email', 'phone']} />
    </section>
  )
}
