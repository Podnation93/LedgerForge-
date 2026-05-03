import { dialog, ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
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
  handle('transactions:update-categorisation', (_event, args) => service.updateTransactionCategorisation(args as Parameters<AccountingService['updateTransactionCategorisation']>[0]))
  handle('documents:list', (_event, args) => service.listDocuments((args as { kind?: 'invoice' | 'quote' | 'bill' } | undefined)?.kind))
  handle('documents:create', (_event, args) => service.createDocument(args as Parameters<AccountingService['createDocument']>[0]))
  handle('tax:get-bas-periods', () => service.getBasPeriods())
  handle('tax:get-bas-review', (_event, args) => service.getBasReview((args as { periodId: string }).periodId))
  handle('tax:lock-bas-period', (_event, args) => service.lockBasPeriod((args as { periodId: string }).periodId))
  handle('ai:test-connection', (_event, args) => ai.testConnection((args as { baseUrl: string }).baseUrl))
  handle('ai:stream-chat', (event, args) => {
    const input = args as { baseUrl: string; model: string; prompt: string }
    return ai.streamChat(event.sender, input.baseUrl, input.model, input.prompt)
  })
  handle('ai:suggestions:list', () => service.listAiSuggestions())
  handle('ai:suggestions:create', (_event, args) => service.createAiSuggestion(args as Parameters<AccountingService['createAiSuggestion']>[0]))
  handle('ai:suggestions:generate-review', () => service.generateAiReviewSuggestions())
  handle('ai:suggestions:generate-ai-review', async (_event, args) => {
    const input = args as { baseUrl: string; model: string }
    const suggestions = await ai.reviewLedger(input.baseUrl, input.model, service.buildAiReviewContext())
    return service.createAiSuggestionsFromReview(suggestions)
  })
  handle('ai:suggestions:update-status', (_event, args) => {
    const input = args as { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' }
    return service.updateSuggestionStatus(input.id, input.status)
  })
  handle('imports:csv', (_event, args) => {
    const input = args as { sourceName: string; csvText: string }
    return service.importCsv(input.sourceName, input.csvText)
  })
  handle('imports:csv-preview', (_event, args) => {
    const input = args as { sourceName: string; csvText: string }
    return service.previewCsv(input.sourceName, input.csvText)
  })
  handle('imports:pick-csv', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import bank CSV',
      properties: ['openFile'],
      filters: [{ name: 'CSV files', extensions: ['csv'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    return { sourceName: basename(filePath), csvText: readFileSync(filePath, 'utf8') }
  })
  handle('documents:pick-files', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import documents',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Documents and images', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff'] }],
    })
    return result.canceled ? [] : result.filePaths
  })
  handle('documents:pick-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import a document folder',
      properties: ['openDirectory'],
    })
    return result.canceled ? [] : result.filePaths
  })
  handle('documents:imports:list', () => service.listDocumentImports())
  handle('documents:imports:create', (_event, args) => {
    const input = args as { paths?: string[] }
    return service.importDocumentFiles(input.paths ?? [])
  })
  handle('documents:ocr:process', (_event, args) => service.processDocumentOcr((args as { id: string }).id))
  handle('documents:ocr:process-pending', (_event, args) => service.processPendingDocumentOcr((args as { limit?: number } | undefined)?.limit))
  handle('receipts:list', () => service.listReceipts())
  handle('receipts:attach', (_event, args) => service.attachDocumentToTransaction(args as Parameters<AccountingService['attachDocumentToTransaction']>[0]))
  handle('exports:create-pack', (_event, args) => service.createExportPack((args as { preset: string }).preset))
  handle('exports:list', () => service.listExportJobs())
  handle('exports:show-in-folder', (_event, args) => {
    const input = args as { filePath: string }
    shell.showItemInFolder(input.filePath)
    return true
  })
  handle('audit:list', () => service.listAuditLogs())
}
