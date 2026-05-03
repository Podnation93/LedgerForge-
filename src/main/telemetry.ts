import { app } from 'electron'
import * as Sentry from '@sentry/electron/main'
import { logger } from './logger'

function sentryDsn(): string {
  return process.env.LEDGERFORGE_SENTRY_DSN?.trim() ?? ''
}

function sentryEnabled(): boolean {
  return process.env.LEDGERFORGE_SENTRY_ENABLED === 'true' && sentryDsn().length > 0
}

function scrubString(value: string): string {
  return value
    .replace(/\b\d{2} ?\d{3} ?\d{3} ?\d{3}\b/g, '[redacted-abn]')
    .replace(/\b\d{3}-?\d{3}\b/g, '[redacted-bsb]')
    .replace(/\$?\b\d{1,3}(?:,\d{3})*(?:\.\d{2})\b/g, '[redacted-amount]')
}

function scrubEvent<TEvent extends Sentry.Event>(event: TEvent): TEvent {
  const text = JSON.stringify(event)
  return JSON.parse(scrubString(text)) as TEvent
}

export function initMainTelemetry(): void {
  if (!sentryEnabled()) {
    logger.info('Sentry telemetry disabled')
    return
  }

  Sentry.init({
    dsn: sentryDsn(),
    release: `ledgerforge-ai@${app.getVersion()}`,
    environment: app.isPackaged ? 'production' : 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    attachStacktrace: true,
    attachScreenshot: false,
    beforeSend: (event) => scrubEvent(event),
  })
  logger.info('Sentry telemetry enabled')
}

export function captureMainException(error: unknown, source: string): void {
  if (!Sentry.isInitialized()) return
  Sentry.captureException(error, { tags: { source } })
}
