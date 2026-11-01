/**
 * Server-side file upload validation helpers.
 * Used by any API route that accepts a File via multipart/form-data or base64.
 */

export const UPLOAD_LIMITS = {
  /** General documents (PDFs, Word, Excel, images) */
  document: {
    maxBytes: 25 * 1024 * 1024, // 25 MB
    allowedMime: new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ]),
  },
  /** Resume / CV uploads from job applicants */
  resume: {
    maxBytes: 10 * 1024 * 1024, // 10 MB
    allowedMime: new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]),
  },
  /** Expense receipts */
  receipt: {
    maxBytes: 5 * 1024 * 1024, // 5 MB
    allowedMime: new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]),
  },
  /** CSV / Excel bulk imports */
  import: {
    maxBytes: 5 * 1024 * 1024, // 5 MB
    allowedMime: new Set(['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  },
  /** Tenant logos (base64, checked by approximate byte count) */
  logo: {
    maxBytes: 512 * 1024, // 512 KB
    allowedMime: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']),
  },
} as const

export type UploadKind = keyof typeof UPLOAD_LIMITS

/**
 * Validate a File object (from formData.get('file')) against a named limit set.
 * Returns an error string, or null if the file is acceptable.
 */
export function validateFile(file: File, kind: UploadKind): string | null {
  const limit = UPLOAD_LIMITS[kind]
  if (file.size === 0) return 'File is empty'
  if (file.size > limit.maxBytes) {
    const mb = (limit.maxBytes / 1024 / 1024).toFixed(0)
    return `File too large — maximum ${mb} MB`
  }
  const mime = file.type || 'application/octet-stream'
  if (!(limit.allowedMime as Set<string>).has(mime)) {
    return `File type "${mime}" is not allowed for this upload`
  }
  return null
}
