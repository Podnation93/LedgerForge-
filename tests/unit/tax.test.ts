import { describe, expect, it } from 'vitest'
import { australianFinancialYear, calculateGstCents, generateBasPeriods, summariseGstForPeriod } from '../../src/shared/tax'
import type { Transaction } from '../../src/shared/types'

describe('Australian GST and BAS helpers', () => {
  it('calculates GST-inclusive 10 percent tax as one eleventh', () => {
    expect(calculateGstCents(11000, 'GST_SALES')).toBe(1000)
    expect(calculateGstCents(-22000, 'GST_PURCHASES')).toBe(2000)
    expect(calculateGstCents(11000, 'BAS_EXCLUDED')).toBe(0)
  })

  it('uses a July to June Australian financial year', () => {
    expect(australianFinancialYear('2026-06-30')).toBe('2025-2026')
    expect(australianFinancialYear('2026-07-01')).toBe('2026-2027')
  })

  it('generates quarterly BAS periods and summaries', () => {
    const periods = generateBasPeriods(2025, 'quarterly')
    const transaction: Transaction = {
      id: 'txn',
      date: '2025-07-15',
      description: 'Sale',
      contactName: 'Client',
      amountCents: 110000,
      currency: 'AUD',
      status: 'categorised',
      hasReceipt: true,
      splits: [
        {
          id: 'split',
          transactionId: 'txn',
          accountId: 'sales',
          amountCents: 110000,
          taxCode: 'GST_SALES',
          gstCents: 10000,
          businessUsePercent: 100,
        },
      ],
    }
    expect(periods).toHaveLength(4)
    expect(summariseGstForPeriod([transaction], periods[0]).netGstCents).toBe(10000)
  })
})
