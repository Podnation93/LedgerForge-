import { lazy, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import type { Settings as AppSettings } from '@shared/types'
import { RouteErrorBoundary } from './layout/RouteErrorBoundary'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const BankingPage = lazy(() => import('./pages/BankingPage'))
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'))
const ReconciliationPage = lazy(() => import('./pages/ReconciliationPage'))
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'))
const QuotesPage = lazy(() => import('./pages/QuotesPage'))
const BillsPage = lazy(() => import('./pages/BillsPage'))
const DocumentIntakePage = lazy(() => import('./pages/DocumentIntakePage'))
const ContactsPage = lazy(() => import('./pages/ContactsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const TaxPage = lazy(() => import('./pages/TaxPage'))
const AiPage = lazy(() => import('./pages/AiPage'))
const ExportsPage = lazy(() => import('./pages/ExportsPage'))
const AuditPage = lazy(() => import('./pages/AuditPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

interface AppRoute {
  path: string
  element: ReactNode
}

interface AppRoutesProps {
  settings: AppSettings
  onSettingsSaved: () => Promise<void>
}

export function AppRoutes({ settings, onSettingsSaved }: AppRoutesProps) {
  const routes: AppRoute[] = [
    { path: '/', element: <DashboardPage /> },
    { path: '/banking', element: <BankingPage /> },
    { path: '/transactions', element: <TransactionsPage /> },
    { path: '/reconciliation', element: <ReconciliationPage /> },
    { path: '/invoices', element: <InvoicesPage /> },
    { path: '/quotes', element: <QuotesPage /> },
    { path: '/bills', element: <BillsPage /> },
    { path: '/receipts', element: <DocumentIntakePage /> },
    { path: '/contacts', element: <ContactsPage /> },
    { path: '/reports', element: <ReportsPage /> },
    { path: '/tax', element: <TaxPage /> },
    { path: '/ai', element: <AiPage settings={settings} /> },
    { path: '/exports', element: <ExportsPage /> },
    { path: '/audit', element: <AuditPage /> },
    { path: '/settings', element: <SettingsPage settings={settings} onSaved={onSettingsSaved} /> },
  ]

  return (
    <Routes>
      {routes.map((route) => (
        <Route key={route.path} path={route.path} element={<RouteErrorBoundary>{route.element}</RouteErrorBoundary>} />
      ))}
    </Routes>
  )
}
