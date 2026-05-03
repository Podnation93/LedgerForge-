import { describe, expect, it } from 'vitest'
import { normaliseSettings, validateLocalHttpUrl } from '../../src/shared/settingsValidation'

describe('settings validation', () => {
  it('normalises ABN formatting and accepts local Ollama URLs', () => {
    const settings = normaliseSettings({
      businessName: 'Demo Co',
      abn: '12345678901',
      ollamaBaseUrl: 'http://localhost:11434/',
      gstBasis: 'cash',
      basFrequency: 'quarterly',
    })
    expect(settings.abn).toBe('12 345 678 901')
    expect(settings.ollamaBaseUrl).toBe('http://localhost:11434')
  })

  it('rejects non-local AI provider URLs', () => {
    expect(() => validateLocalHttpUrl('https://example.com', 'Ollama URL')).toThrow('local Ollama server')
  })
})
