import { useState } from 'react'
import { Download, FolderOpen } from 'lucide-react'
import type { ExportJob } from '@shared/types'
import { ActionButton } from '../components/ActionButton'
import { IconButton } from '../components/IconButton'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { useAsyncData } from '../hooks/useAsyncData'
import { exportPresets } from '../lib/data'
import { invoke } from '../lib/api'

export default function ExportsPage() {
  const [lastExport, setLastExport] = useState<ExportJob | null>(null)
  const [history, reloadHistory] = useAsyncData('exports:list', [])

  async function createExport(preset: string) {
    const created = await invoke('exports:create-pack', { preset })
    setLastExport(created)
    await reloadHistory()
  }

  return (
    <section className="page">
      <PageHeader title="Exports" kicker="Accountant and AI packs" />
      <div className="module-grid">
        {exportPresets.map((preset) => (
          <Panel title={preset} key={preset}>
            <p className="muted">Includes metadata, reports, selected data, redaction warnings, and audit trace.</p>
            <ActionButton icon={Download} label="Create Pack" onClick={() => createExport(preset)} />
          </Panel>
        ))}
      </div>
      {lastExport && <p className="notice success">Created {lastExport.filePath}</p>}
      <Panel title="Export history">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Created</th><th>Preset</th><th>Path</th><th>Warnings</th><th>Action</th></tr></thead>
            <tbody>
              {history.length === 0 ? <tr><td colSpan={5}>No exports yet.</td></tr> : history.map((job) => (
                <tr key={job.id}>
                  <td>{job.createdAt}</td>
                  <td>{job.preset}</td>
                  <td>{job.filePath}</td>
                  <td>{job.warnings.length}</td>
                  <td><IconButton icon={FolderOpen} label="Show" onClick={async () => { await invoke('exports:show-in-folder', { filePath: job.filePath }) }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  )
}
