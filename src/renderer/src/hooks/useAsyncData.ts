import { useCallback, useEffect, useState } from 'react'
import type { IpcInvokeArgsTuple, IpcInvokeChannel, IpcInvokeResult } from '@shared/ipc'
import { invoke } from '../lib/api'

export function useAsyncData<C extends IpcInvokeChannel>(channel: C, fallback: IpcInvokeResult<C>, ...argsInput: IpcInvokeArgsTuple<C>): [IpcInvokeResult<C>, () => Promise<void>, string] {
  const [data, setData] = useState<IpcInvokeResult<C>>(fallback)
  const [error, setError] = useState('')
  const args = argsInput[0]
  const argsKey = JSON.stringify(args)

  const load = useCallback(async () => {
    try {
      setData(await invoke(channel, ...argsInput))
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load data')
    }
  }, [channel, argsKey])

  useEffect(() => {
    void load()
  }, [load])

  return [data, load, error]
}
