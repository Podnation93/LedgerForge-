import { contextBridge, ipcRenderer } from 'electron'
import { ipcEventChannels, ipcInvokeChannels } from '@shared/ipc'
import type { IpcEventChannel, IpcEventPayload, IpcInvokeChannel, IpcInvokeResult } from '@shared/ipc'
import type { IpcResult } from '@shared/types'

const allowedInvokeChannels = new Set<string>(ipcInvokeChannels)
const allowedEventChannels = new Set<string>(ipcEventChannels)

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: async <C extends IpcInvokeChannel>(channel: C, args?: unknown): Promise<IpcResult<IpcInvokeResult<C>>> => {
    if (!allowedInvokeChannels.has(channel)) return { error: `Blocked IPC channel: ${channel}` }
    return ipcRenderer.invoke(channel, args) as Promise<IpcResult<IpcInvokeResult<C>>>
  },
  on: <C extends IpcEventChannel>(channel: C, callback: (payload: IpcEventPayload<C>) => void) => {
    if (!allowedEventChannels.has(channel)) return () => undefined
    const listener = (_event: Electron.IpcRendererEvent, payload: IpcEventPayload<C>) => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
