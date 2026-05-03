/// <reference types="vite/client" />

import type { IpcResult } from '@shared/types'
import type { IpcEventChannel, IpcEventPayload, IpcInvokeArgs, IpcInvokeChannel, IpcInvokeResult } from '@shared/ipc'

declare global {
  interface Window {
    electronAPI: {
      invoke<C extends IpcInvokeChannel>(channel: C, args?: IpcInvokeArgs<C>): Promise<IpcResult<IpcInvokeResult<C>>>
      on<C extends IpcEventChannel>(channel: C, callback: (payload: IpcEventPayload<C>) => void): () => void
    }
  }
}
