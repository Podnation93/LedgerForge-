import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { getDatabase } from '@main/db'
import { AccountingService } from '@main/services/accounting-service'
import { AiService } from '@main/services/ai-service'
import type { IpcResult } from '@shared/types'

type Handler<T> = (event: IpcMainInvokeEvent, args: unknown) => Promise<T> | T

function handle<T>(channel: string, handler: Handler<T>): void {
  ipcMain.handle(channel, async (event, args): Promise<IpcResult<T>> => {
    try {
      return { data: await handler(event, args) }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
}

export function registerIpc(): void {
  const service = new AccountingService(getDatabase())
  const ai = new AiService()

  handle('settings:get', () => service.getSettings())
  handle('settings:update', (_event, args) => service.updateSettings(args as Parameters<AccountingService['updateSettings']>[0]))
  handle('dashboard:summary', () => service.dashboard())
  handle('accounts:list', () => service.listAccounts())
  handle('contacts:list', () => service.listContacts())
  handle('contacts:upsert', (_event, args) => service.upsertContact(args as Parameters<AccountingService['upsertContact']>[0]))
  handle('transactions:list', () => service.listTransactions())
  handle('transactions:create', (_event, args) => service.createTransaction(args as Parameters<AccountingService['createTransaction']>[0]))
  handle('documents:list', (_event, args) => service.listDocuments((args as { kind?: 'invoice' | 'quote' | 'bill' } | undefined)?.kind))
  handle('documents:create', (_event, args) => service.createDocument(args as Parameters<AccountingService['createDocument']>[0]))
  handle('tax:get-bas-periods', () => service.getBasPeriods())
  handle('tax:lock-bas-period', (_event, args) => service.lockBasPeriod((args as { periodId: string }).periodId))
  handle('ai:test-connection', (_event, args) => ai.testConnection((args as { baseUrl: string }).baseUrl))
  handle('ai:stream-chat', (event, args) => {
    const input = args as { baseUrl: string; model: string; prompt: string }
    return ai.streamChat(event.sender, input.baseUrl, input.model, input.prompt)
  })
  handle('ai:suggestions:list', () => service.listAiSuggestions())
  handle('ai:suggestions:create', (_event, args) => service.createAiSuggestion(args as Parameters<AccountingService['createAiSuggestion']>[0]))
  handle('ai:suggestions:update-status', (_event, args) => {
    const input = args as { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' }
    return service.updateSuggestionStatus(input.id, input.status)
  })
  handle('imports:csv', (_event, args) => {
    const input = args as { sourceName: string; csvText: string }
    return service.importCsv(input.sourceName, input.csvText)
  })
  handle('exports:create-pack', (_event, args) => service.createExportPack((args as { preset: string }).preset))
  handle('audit:list', () => service.listAuditLogs())
}
