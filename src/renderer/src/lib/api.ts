import type { IpcResult } from '@shared/types'

export async function invoke<T>(channel: string, args?: unknown): Promise<T> {
  const result: IpcResult<T> = await window.electronAPI.invoke<T>(channel, args)
  if ('error' in result) throw new Error(result.error)
  return result.data
}
