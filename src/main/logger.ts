import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import pino from 'pino'

const redactPaths = [
  'abn',
  'settings.abn',
  'amountCents',
  'gstCents',
  'subtotalCents',
  'totalCents',
  'description',
  'contactName',
  'csvText',
  'prompt',
  'args.abn',
  'args.amountCents',
  'args.gstCents',
  'args.subtotalCents',
  'args.totalCents',
  'args.description',
  'args.contactName',
  'args.csvText',
  'args.prompt',
  '*.abn',
  '*.amountCents',
  '*.gstCents',
  '*.subtotalCents',
  '*.totalCents',
  '*.description',
  '*.contactName',
]

const loggerOptions: pino.LoggerOptions = {
  level: process.env.LEDGERFORGE_LOG_LEVEL ?? (app.isPackaged ? 'info' : 'debug'),
  base: undefined,
  redact: {
    paths: redactPaths,
    censor: '[redacted]',
  },
}

export let logger = pino(loggerOptions)

export function configureLogger(): void {
  const logsDir = join(app.getPath('userData'), 'logs')
  mkdirSync(logsDir, { recursive: true })

  const fileDestination = pino.destination({ dest: join(logsDir, 'main.log'), sync: false, mkdir: true })
  const streams: pino.StreamEntry[] = [{ stream: process.stdout }, { stream: fileDestination }]
  logger = pino(loggerOptions, pino.multistream(streams))
}

export function flushLogger(): void {
  logger.flush()
}
