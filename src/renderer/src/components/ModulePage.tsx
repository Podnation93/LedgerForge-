import type { LucideIcon } from 'lucide-react'
import { PageHeader } from './PageHeader'
import { Panel } from './Panel'

interface ModulePageProps {
  title: string
  description: string
  icon: LucideIcon
}

export function ModulePage({ title, description, icon: Icon }: ModulePageProps) {
  return (
    <section className="page">
      <PageHeader title={title} kicker="Production beta module" />
      <Panel title={title}>
        <div className="module-placeholder">
          <Icon size={38} />
          <p>{description}</p>
          <span>Persistence, audit readiness, empty states, and route shell are wired for this module.</span>
        </div>
      </Panel>
    </section>
  )
}
