import { describe, it, expect } from 'vitest'
import { validateFile, UPLOAD_LIMITS } from '@/lib/validateUpload'

function makeFile(name: string, type: string, sizeBytes: number): File {
  const buf = new Uint8Array(sizeBytes)
  return new File([buf], name, { type })
}

describe('validateFile', () => {
  describe('resume', () => {
    it('accepts a valid PDF under 10 MB', () => {
      const f = makeFile('cv.pdf', 'application/pdf', 1 * 1024 * 1024)
      expect(validateFile(f, 'resume')).toBeNull()
    })

    it('rejects a PDF over 10 MB', () => {
      const f = makeFile('cv.pdf', 'application/pdf', 11 * 1024 * 1024)
      expect(validateFile(f, 'resume')).toMatch(/too large/)
    })

    it('rejects a JPEG (not allowed for resumes)', () => {
      const f = makeFile('photo.jpg', 'image/jpeg', 100 * 1024)
      expect(validateFile(f, 'resume')).toMatch(/not allowed/)
    })

    it('accepts a Word document', () => {
      const f = makeFile('cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 500 * 1024)
      expect(validateFile(f, 'resume')).toBeNull()
    })

    it('rejects an empty file', () => {
      const f = makeFile('cv.pdf', 'application/pdf', 0)
      expect(validateFile(f, 'resume')).toMatch(/empty/)
    })
  })

  describe('receipt', () => {
    it('accepts a JPEG under 5 MB', () => {
      const f = makeFile('receipt.jpg', 'image/jpeg', 2 * 1024 * 1024)
      expect(validateFile(f, 'receipt')).toBeNull()
    })

    it('rejects a file over 5 MB', () => {
      const f = makeFile('receipt.jpg', 'image/jpeg', 6 * 1024 * 1024)
      expect(validateFile(f, 'receipt')).toMatch(/too large/)
    })

    it('rejects a Word doc (not allowed for receipts)', () => {
      const f = makeFile('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 100 * 1024)
      expect(validateFile(f, 'receipt')).toMatch(/not allowed/)
    })
  })

  describe('document', () => {
    it('accepts a 25 MB PDF exactly at the limit', () => {
      const f = makeFile('big.pdf', 'application/pdf', 25 * 1024 * 1024)
      expect(validateFile(f, 'document')).toBeNull()
    })

    it('rejects a file 1 byte over 25 MB', () => {
      const f = makeFile('toobig.pdf', 'application/pdf', 25 * 1024 * 1024 + 1)
      expect(validateFile(f, 'document')).toMatch(/too large/)
    })
  })

  describe('import', () => {
    it('accepts a CSV', () => {
      const f = makeFile('employees.csv', 'text/csv', 100 * 1024)
      expect(validateFile(f, 'import')).toBeNull()
    })

    it('rejects an image as an import', () => {
      const f = makeFile('photo.png', 'image/png', 100 * 1024)
      expect(validateFile(f, 'import')).toMatch(/not allowed/)
    })
  })
})
