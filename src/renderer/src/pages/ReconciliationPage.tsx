import { RefreshCw } from 'lucide-react'
import { ModulePage } from '../components/ModulePage'

export default function ReconciliationPage() {
  return (
    <ModulePage
      title="Reconciliation"
      icon={RefreshCw}
      description="Match bank lines to invoices, bills, expenses, and transfers with undo support."
    />
  )
}
