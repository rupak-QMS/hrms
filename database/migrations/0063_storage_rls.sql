-- Migration 0063: Supabase Storage buckets + RLS policies
-- Run this in the Supabase dashboard SQL editor or via supabase db push.
-- Storage RLS policies enforce tenant isolation by path prefix.

-- ── Create buckets ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('hrms-documents', 'hrms-documents', false, 52428800,  -- 50 MB
   ARRAY['application/pdf','image/jpeg','image/png','image/webp','application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('hrms-avatars',   'hrms-avatars',   false, 5242880,   -- 5 MB
   ARRAY['image/jpeg','image/png','image/webp']),
  ('hrms-logos',     'hrms-logos',     true,  5242880,   -- 5 MB
   ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('hrms-payslips',  'hrms-payslips',  false, 10485760,  -- 10 MB
   ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Storage RLS helpers ───────────────────────────────────────────────────────

-- Extract tenant_id (first path segment) from a storage object path
CREATE OR REPLACE FUNCTION storage.path_tenant_id(obj_name TEXT)
RETURNS UUID AS $$
  SELECT split_part(obj_name, '/', 1)::UUID
$$ LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '';

-- ── hrms-documents RLS ────────────────────────────────────────────────────────

CREATE POLICY "documents_tenant_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'hrms-documents'
    AND EXISTS (
      SELECT 1 FROM public.hrms_users u
      WHERE u.id::TEXT = auth.uid()::TEXT
        AND u.tenant_id = storage.path_tenant_id(name)
        AND u.is_active = TRUE
    )
  );

CREATE POLICY "documents_tenant_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'hrms-documents'
    AND EXISTS (
      SELECT 1 FROM public.hrms_users u
      WHERE u.id::TEXT = auth.uid()::TEXT
        AND u.tenant_id = storage.path_tenant_id(name)
        AND u.is_active = TRUE
    )
  );

CREATE POLICY "documents_tenant_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'hrms-documents'
    AND EXISTS (
      SELECT 1 FROM public.hrms_users u
      WHERE u.id::TEXT = auth.uid()::TEXT
        AND u.tenant_id = storage.path_tenant_id(name)
        AND u.is_active = TRUE
    )
  );

-- ── hrms-avatars RLS ──────────────────────────────────────────────────────────

CREATE POLICY "avatars_tenant_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'hrms-avatars'
    AND EXISTS (
      SELECT 1 FROM public.hrms_users u
      WHERE u.id::TEXT = auth.uid()::TEXT
        AND u.tenant_id = storage.path_tenant_id(name)
        AND u.is_active = TRUE
    )
  );

CREATE POLICY "avatars_tenant_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'hrms-avatars'
    AND EXISTS (
      SELECT 1 FROM public.hrms_users u
      WHERE u.id::TEXT = auth.uid()::TEXT
        AND u.tenant_id = storage.path_tenant_id(name)
        AND u.is_active = TRUE
    )
  );

-- ── hrms-logos (public bucket — anyone can read, only super-admin can write) ──

CREATE POLICY "logos_public_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'hrms-logos');

CREATE POLICY "logos_service_role_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'hrms-logos'
    AND (auth.role() = 'service_role' OR EXISTS (
      SELECT 1 FROM public.hrms_super_admins sa WHERE sa.id::TEXT = auth.uid()::TEXT AND sa.is_active = TRUE
    ))
  );

-- ── hrms-payslips RLS ─────────────────────────────────────────────────────────

-- Employee can read their own payslips; payroll officers can read all for their tenant
CREATE POLICY "payslips_tenant_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'hrms-payslips'
    AND EXISTS (
      SELECT 1 FROM public.hrms_users u
      WHERE u.id::TEXT = auth.uid()::TEXT
        AND u.tenant_id = storage.path_tenant_id(name)
        AND u.is_active = TRUE
        AND (
          u.role::TEXT IN ('payroll_officer', 'hr_officer', 'director', 'super_admin')
          OR split_part(name, '/', 2) = u.id::TEXT  -- employee can see own payslips
        )
    )
  );

CREATE POLICY "payslips_service_role_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'hrms-payslips'
    AND auth.role() = 'service_role'
  );
