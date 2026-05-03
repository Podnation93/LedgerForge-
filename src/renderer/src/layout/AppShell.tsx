import { useState, type ReactNode } from 'react'
import type { Settings as AppSettings } from '@shared/types'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface AppShellProps {
  settings: AppSettings
  children: ReactNode
}

export function AppShell({ settings, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <main>
        <Topbar settings={settings} />
        {children}
      </main>
    </div>
  )
}
