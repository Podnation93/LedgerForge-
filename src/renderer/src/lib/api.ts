import type { IpcInvokeArgsTuple, IpcInvokeChannel, IpcInvokeResult } from '@shared/ipc'
import type { IpcResult } from '@shared/types'

export async function invoke<C extends IpcInvokeChannel>(channel: C, ...args: IpcInvokeArgsTuple<C>): Promise<IpcInvokeResult<C>> {
  const result: IpcResult<IpcInvokeResult<C>> = await window.electronAPI.invoke(channel, args[0])
  if ('error' in result) throw new Error(result.error)
  return result.data
}
