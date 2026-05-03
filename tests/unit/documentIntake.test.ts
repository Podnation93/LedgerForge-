import { describe, expect, it } from 'vitest'
import { initialOcrStatus, intakeMimeType, isSupportedIntakeFile, sanitizeIntakeFileName } from '../../src/shared/documentIntake'

describe('document intake helpers', () => {
  it('allows PDFs and common image files for OCR intake', () => {
    expect(isSupportedIntakeFile('/tmp/receipt.PDF')).toBe(true)
    expect(isSupportedIntakeFile('/tmp/photo.jpeg')).toBe(true)
    expect(isSupportedIntakeFile('/tmp/archive.zip')).toBe(false)
  })

  it('normalises unsafe file names before vault storage', () => {
    expect(sanitizeIntakeFileName(' invoice:april?.pdf ')).toBe('invoice-april-.pdf')
    expect(sanitizeIntakeFileName('')).toBe('document')
  })

  it('sets mime type and OCR queue status from the extension', () => {
    expect(intakeMimeType('statement.pdf')).toBe('application/pdf')
    expect(intakeMimeType('receipt.tiff')).toBe('image/tiff')
    expect(initialOcrStatus('receipt.png')).toBe('PENDING')
    expect(initialOcrStatus('notes.txt')).toBe('UNSUPPORTED')
  })
})
