import type { BasFrequency, GstBasis, Settings } from './types'

const BAS_FREQUENCIES: BasFrequency[] = ['monthly', 'quarterly', 'annual']
const GST_BASES: GstBasis[] = ['cash', 'accrual']

export function normaliseSettings(input: Partial<Settings>): Partial<Settings> {
  const output: Partial<Settings> = {}
  if (input.businessName !== undefined) output.businessName = cleanText(input.businessName, 'Business name', 120)
  if (input.abn !== undefined) output.abn = validateAbn(input.abn)
  if (input.gstRegistered !== undefined) output.gstRegistered = Boolean(input.gstRegistered)
  if (input.gstBasis !== undefined) {
    if (!GST_BASES.includes(input.gstBasis)) throw new Error('GST basis must be cash or accrual')
    output.gstBasis = input.gstBasis
  }
  if (input.basFrequency !== undefined) {
    if (!BAS_FREQUENCIES.includes(input.basFrequency)) throw new Error('BAS frequency must be monthly, quarterly, or annual')
    output.basFrequency = input.basFrequency
  }
  if (input.ollamaBaseUrl !== undefined) output.ollamaBaseUrl = validateLocalHttpUrl(input.ollamaBaseUrl, 'Ollama URL')
  if (input.cloudAiEnabled !== undefined) output.cloudAiEnabled = Boolean(input.cloudAiEnabled)
  return output
}

export function validateLocalHttpUrl(value: string, label: string): string {
  const trimmed = cleanText(value, label, 300)
  const parsed = new URL(trimmed)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error(`${label} must use http or https`)
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) throw new Error(`${label} must point to a local Ollama server`)
  return parsed.toString().replace(/\/$/, '')
}

function validateAbn(value: string): string {
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length !== 11) throw new Error('ABN must contain 11 digits')
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')
}

function cleanText(value: string, label: string, maxLength: number): string {
  const trimmed = String(value).trim()
  if (!trimmed) throw new Error(`${label} is required`)
  if (trimmed.length > maxLength) throw new Error(`${label} is too long`)
  return trimmed
}
