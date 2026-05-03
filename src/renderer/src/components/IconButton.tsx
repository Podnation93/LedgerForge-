import type { LucideIcon } from 'lucide-react'

interface IconButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void | Promise<void>
}

export function IconButton({ icon: Icon, label, onClick }: IconButtonProps) {
  return (
    <button className="icon-button" type="button" title={label} aria-label={label} onClick={() => void onClick()}>
      <Icon size={15} />
    </button>
  )
}
