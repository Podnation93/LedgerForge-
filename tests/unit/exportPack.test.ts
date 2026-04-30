import { describe, expect, it } from 'vitest'
import { buildExportMetadata } from '../../src/shared/exportPack'
import type { DashboardSummary, Settings } from '../../src/shared/types'

describe('export pack metadata', () => {
  it('captures Australia-first tax settings and warnings', () => {
    const settings: Settings = {
      businessName: 'Demo',
      abn: '',
      gstRegistered: true,
      gstBasis: 'cash',
      basFrequency: 'quarterly',
      ollamaBaseUrl: 'http://localhost:11434',
      cloudAiEnabled: false,
    }
    const summary: DashboardSummary = {
      revenueCents: 0,
      expensesCents: 0,
      profitCents: 0,
      gstOwedCents: 0,
      cashflow: [],
      categoryBreakdown: [],
      recentTransactions: [],
      warnings: ['Missing receipts'],
    }
    const metadata = buildExportMetadata(settings, summary, 'AI Analysis Pack')
    expect(metadata.currency).toBe('AUD')
    expect(metadata.basFrequency).toBe('quarterly')
    expect(metadata.warnings).toContain('Missing receipts')
  })
})
