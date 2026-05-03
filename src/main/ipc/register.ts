import { dialog, ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { getDatabase } from '@main/db'
import { logger } from '@main/logger'
import { captureMainException } from '@main/telemetry'
import { AccountingService } from '@main/services/accounting-service'
import { AiService } from '@main/services/ai-service'
import type { IpcInvokeArgs, IpcInvokeChannel, IpcInvokeResult } from '@shared/ipc'
import type { IpcResult } from '@shared/types'

type Handler<C extends IpcInvokeChannel> = (event: IpcMainInvokeEvent, args: IpcInvokeArgs<C>) => Promise<IpcInvokeResult<C>> | IpcInvokeResult<C>

function safeHandle<C extends IpcInvokeChannel>(channel: C, handler: Handler<C>): void {
  ipcMain.handle(channel, async (event, args): Promise<IpcResult<IpcInvokeResult<C>>> => {
    try {
      return { data: await handler(event, args as IpcInvokeArgs<C>) }
    } catch (error) {
      logger.error({ err: error, channel }, 'IPC handler failed')
      captureMainException(error, `ipc:${channel}`)
      return { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
}

export function registerIpc(): void {
  const service = new AccountingService(getDatabase())
  const ai = new AiService()

  safeHandle('settings:get', () => service.getSettings())
  safeHandle('settings:update', (_event, args) => service.updateSettings(args))
  safeHandle('dashboard:summary', () => service.dashboard())
  safeHandle('accounts:list', () => service.listAccounts())
  safeHandle('contacts:list', () => service.listContacts())
  safeHandle('contacts:upsert', (_event, args) => service.upsertContact(args))
  safeHandle('transactions:list', () => service.listTransactions())
  safeHandle('transactions:create', (_event, args) => service.createTransaction(args))
  safeHandle('transactions:update-categorisation', (_event, args) => service.updateTransactionCategorisation(args))
  safeHandle('documents:list', (_event, args) => service.listDocuments(args?.kind))
  safeHandle('documents:create', (_event, args) => service.createDocument(args))
  safeHandle('tax:get-bas-periods', () => service.getBasPeriods())
  safeHandle('tax:get-bas-review', (_event, args) => service.getBasReview(args.periodId))
  safeHandle('tax:lock-bas-period', (_event, args) => service.lockBasPeriod(args.periodId))
  safeHandle('ai:test-connection', (_event, args) => ai.testConnection(args.baseUrl))
  safeHandle('ai:stream-chat', (event, args) => ai.streamChat(event.sender, args.baseUrl, args.model, args.prompt))
  safeHandle('ai:suggestions:list', () => service.listAiSuggestions())
  safeHandle('ai:suggestions:create', (_event, args) => service.createAiSuggestion(args))
  safeHandle('ai:suggestions:generate-review', () => service.generateAiReviewSuggestions())
  safeHandle('ai:suggestions:generate-ai-review', async (_event, args) => {
    const suggestions = await ai.reviewLedger(args.baseUrl, args.model, service.buildAiReviewContext())
    return service.createAiSuggestionsFromReview(suggestions)
  })
  safeHandle('ai:suggestions:update-status', (_event, args) => service.updateSuggestionStatus(args.id, args.status))
  safeHandle('imports:csv', (_event, args) => service.importCsv(args.sourceName, args.csvText))
  safeHandle('imports:csv-preview', (_event, args) => service.previewCsv(args.sourceName, args.csvText))
  safeHandle('imports:pick-csv', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import bank CSV',
      properties: ['openFile'],
      filters: [{ name: 'CSV files', extensions: ['csv'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    return { sourceName: basename(filePath), csvText: readFileSync(filePath, 'utf8') }
  })
  safeHandle('documents:pick-files', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import documents',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Documents and images', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff'] }],
    })
    return result.canceled ? [] : result.filePaths
  })
  safeHandle('documents:pick-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import a document folder',
      properties: ['openDirectory'],
    })
    return result.canceled ? [] : result.filePaths
  })
  safeHandle('documents:imports:list', () => service.listDocumentImports())
  safeHandle('documents:imports:create', (_event, args) => service.importDocumentFiles(args.paths ?? []))
  safeHandle('documents:ocr:process', (_event, args) => service.processDocumentOcr(args.id))
  safeHandle('documents:ocr:process-pending', (_event, args) => service.processPendingDocumentOcr(args?.limit))
  safeHandle('receipts:list', () => service.listReceipts())
  safeHandle('receipts:attach', (_event, args) => service.attachDocumentToTransaction(args))
  safeHandle('exports:create-pack', (_event, args) => service.createExportPack(args.preset))
  safeHandle('exports:list', () => service.listExportJobs())
  safeHandle('exports:show-in-folder', (_event, args) => {
    shell.showItemInFolder(args.filePath)
    return true
  })
  safeHandle('audit:list', () => service.listAuditLogs())
}
