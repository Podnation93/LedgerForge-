import { contextBridge, ipcRenderer } from 'electron'
import type { IpcResult } from '@shared/types'

const allowedInvokeChannels = new Set([
  'settings:get',
  'settings:update',
  'dashboard:summary',
  'accounts:list',
  'contacts:list',
  'contacts:upsert',
  'transactions:list',
  'transactions:create',
  'transactions:update-categorisation',
  'documents:list',
  'documents:create',
  'documents:pick-files',
  'documents:pick-folder',
  'documents:imports:list',
  'documents:imports:create',
  'documents:ocr:process',
  'documents:ocr:process-pending',
  'tax:get-bas-periods',
  'tax:get-bas-review',
  'tax:lock-bas-period',
  'ai:test-connection',
  'ai:stream-chat',
  'ai:suggestions:list',
  'ai:suggestions:create',
  'ai:suggestions:generate-review',
  'ai:suggestions:generate-ai-review',
  'ai:suggestions:update-status',
  'imports:pick-csv',
  'imports:csv-preview',
  'imports:csv',
  'receipts:list',
  'receipts:attach',
  'exports:create-pack',
  'exports:list',
  'exports:show-in-folder',
  'audit:list',
])

const allowedEventChannels = new Set(['ai:token-stream'])

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: async <T>(channel: string, args?: unknown): Promise<IpcResult<T>> => {
    if (!allowedInvokeChannels.has(channel)) return { error: `Blocked IPC channel: ${channel}` }
    return ipcRenderer.invoke(channel, args) as Promise<IpcResult<T>>
  },
  on: (channel: string, callback: (payload: unknown) => void) => {
    if (!allowedEventChannels.has(channel)) return () => undefined
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
