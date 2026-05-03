import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  kicker: string
  action?: ReactNode
}

export function PageHeader({ title, kicker, action }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <span className="kicker">{kicker}</span>
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  )
}
