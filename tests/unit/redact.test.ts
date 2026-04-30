import { describe, expect, it } from 'vitest'
import { redactSensitiveText } from '../../src/shared/redact'

describe('redaction', () => {
  it('redacts common Australian identifiers before AI/export use', () => {
    const text = 'ABN 12 345 678 901, BSB 123-456, hello@example.com, 0412 345 678'
    const redacted = redactSensitiveText(text)
    expect(redacted).toContain('[ABN]')
    expect(redacted).toContain('[BSB]')
    expect(redacted).toContain('[EMAIL]')
    expect(redacted).toContain('[PHONE]')
  })
})
