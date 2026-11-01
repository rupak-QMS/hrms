/**
 * supabase.ts — Supabase Storage client with tenant-prefixed paths.
 *
 * All files are stored under `<tenantId>/<category>/<filename>` so that
 * storage RLS policies (path prefix checks) guarantee tenant isolation.
 *
 * Buckets:
 *   hrms-documents  — employee documents (compliance certs, WWCC, etc.)
 *   hrms-avatars    — employee profile photos
 *   hrms-logos      — tenant brand logos (public bucket)
 *   hrms-payslips   — payslip PDFs (private, employee-scoped)
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Service-role client — bypasses RLS for server-side operations.
// Never expose this client to the browser.
function getServiceClient() {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })
}

export type StorageBucket =
  | 'hrms-documents'
  | 'hrms-avatars'
  | 'hrms-logos'
  | 'hrms-payslips'

/**
 * Upload a file to Supabase Storage.
 * Path is always `<tenantId>/<category>/<filename>` for tenant isolation.
 * Returns the public URL (for public buckets) or signed URL.
 */
export async function uploadFile(
  bucket: StorageBucket,
  tenantId: string,
  category: string,
  filename: string,
  file: Buffer | Uint8Array | Blob,
  contentType: string,
): Promise<string> {
  const supabase = getServiceClient()
  const path = `${tenantId}/${category}/${filename}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: true,
    })

  if (error) throw new Error(`[storage] upload failed: ${error.message}`)

  // Return signed URL for private buckets, public URL for logos
  if (bucket === 'hrms-logos') {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  const { data, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60) // 1 hour

  if (signErr || !data?.signedUrl) throw new Error(`[storage] signed URL failed: ${signErr?.message}`)
  return data.signedUrl
}

/**
 * Delete a file from Supabase Storage.
 * Always verifies the path starts with tenantId to prevent cross-tenant deletion.
 */
export async function deleteFile(
  bucket: StorageBucket,
  tenantId: string,
  path: string,
): Promise<boolean> {
  if (!path.startsWith(`${tenantId}/`)) {
    throw new Error('[storage] cross-tenant delete blocked')
  }

  const supabase = getServiceClient()
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw new Error(`[storage] delete failed: ${error.message}`)
  return true
}

/**
 * Create a short-lived signed URL for a private file.
 * Verifies the path belongs to the tenant before signing.
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  tenantId: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  if (!path.startsWith(`${tenantId}/`)) {
    throw new Error('[storage] cross-tenant access blocked')
  }

  const supabase = getServiceClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds)

  if (error || !data?.signedUrl) throw new Error(`[storage] signed URL failed: ${error?.message}`)
  return data.signedUrl
}
