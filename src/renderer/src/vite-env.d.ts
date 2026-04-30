/// <reference types="vite/client" />

import type { IpcResult } from '@shared/types'

declare global {
  interface Window {
    electronAPI: {
      invoke<T>(channel: string, args?: unknown): Promise<IpcResult<T>>
      on(channel: string, callback: (payload: unknown) => void): () => void
    }
  }
}
