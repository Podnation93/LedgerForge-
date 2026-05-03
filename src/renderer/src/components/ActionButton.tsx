import type { LucideIcon } from 'lucide-react'

interface ActionButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void | Promise<void>
}

export function ActionButton({ icon: Icon, label, onClick }: ActionButtonProps) {
  return (
    <button className="action-button" type="button" onClick={() => void onClick()}>
      <Icon size={16} />
      {label}
    </button>
  )
}
