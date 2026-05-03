interface SummaryTileProps {
  label: string
  value: number
}

export function SummaryTile({ label, value }: SummaryTileProps) {
  return (
    <div className="metric-card compact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
