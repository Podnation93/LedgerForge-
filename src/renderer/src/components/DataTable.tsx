import { formatAud } from '@shared/formatters'
import { Panel } from './Panel'

interface DataTableProps<T> {
  title: string
  rows: T[]
  columns: Array<keyof T & string>
}

export function DataTable<T extends { id?: unknown }>({ title, rows, columns }: DataTableProps<T>) {
  return (
    <Panel title={title}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length}>No records yet.</td></tr>
            ) : (
              rows.map((row, index) => (
                <tr key={String(row.id ?? index)}>
                  {columns.map((column) => (
                    <td key={column}>{formatCell(column, row[column])}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function formatCell(column: string, value: unknown): string {
  if (typeof value === 'number') {
    if (column === 'sizeBytes') return formatBytes(value)
    if (column.toLowerCase().includes('cents')) return formatAud(value)
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value ?? '')
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
