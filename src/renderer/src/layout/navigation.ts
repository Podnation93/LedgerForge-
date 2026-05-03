import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Calculator,
  Contact,
  Download,
  FileText,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  Table2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/banking', label: 'Banking', icon: Landmark },
  { path: '/transactions', label: 'Transactions', icon: Table2 },
  { path: '/reconciliation', label: 'Reconciliation', icon: RefreshCw },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/quotes', label: 'Quotes', icon: BriefcaseBusiness },
  { path: '/bills', label: 'Bills', icon: Receipt },
  { path: '/receipts', label: 'Receipts', icon: Package },
  { path: '/contacts', label: 'Contacts', icon: Contact },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/tax', label: 'Tax & BAS', icon: Calculator },
  { path: '/ai', label: 'AI Assistant', icon: Bot },
  { path: '/exports', label: 'Exports', icon: Download },
  { path: '/audit', label: 'Audit Log', icon: ShieldCheck },
  { path: '/settings', label: 'Settings', icon: Settings },
]
