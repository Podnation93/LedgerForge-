import { Bot, Building2, Search } from 'lucide-react'
import type { Settings as AppSettings } from '@shared/types'

interface TopbarProps {
  settings: AppSettings
}

export function Topbar({ settings }: TopbarProps) {
  return (
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
  )
}
