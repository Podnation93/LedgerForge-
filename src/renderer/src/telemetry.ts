import * as Sentry from '@sentry/electron/renderer'

function sentryDsn(): string {
  return import.meta.env.VITE_LEDGERFORGE_SENTRY_DSN?.trim() ?? ''
}

function sentryEnabled(): boolean {
  return import.meta.env.VITE_LEDGERFORGE_SENTRY_ENABLED === 'true' && sentryDsn().length > 0
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

export function initRendererTelemetry(): void {
  if (!sentryEnabled()) return
  Sentry.init({
    dsn: sentryDsn(),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
  })
}

export function captureRendererException(error: unknown): void {
  if (!Sentry.isInitialized()) return
  Sentry.captureException(error)
}
