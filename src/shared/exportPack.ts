import type { DashboardSummary, Settings } from './types'

export function buildExportMetadata(settings: Settings, summary: DashboardSummary, preset: string) {
  return {
    app: 'LedgerForge AI',
    preset,
    generatedAt: new Date().toISOString(),
    country: 'AU',
    currency: 'AUD',
    businessName: settings.businessName,
    gstRegistered: settings.gstRegistered,
    gstBasis: settings.gstBasis,
    basFrequency: settings.basFrequency,
    warnings: summary.warnings,
  }
}

export const aiExportPrompt = `You are reviewing my Australian local accounting export.
Please analyse the included data for possible missing categories, GST/BAS issues,
duplicate transactions, missing receipts, unusual spending, deduction items that
need human review, and questions I should ask my accountant. Do not assume final
tax treatment. Return findings grouped by urgency.`
