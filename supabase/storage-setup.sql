-- ==============================================================================
-- Supabase Storage: service-images Bucket Setup
-- ==============================================================================
-- Run this SQL in the Supabase SQL Editor (under your project → SQL Editor).
-- This creates the storage bucket and sets the required RLS policies so that:
--   • Anyone (public) can VIEW/download images (needed for customer-facing pages)
--   • Only the server-side service role key can UPLOAD/DELETE images
--     (the Express backend uses the service role key which bypasses RLS)
-- ==============================================================================

-- 1. Create the bucket (idempotent: safe to re-run)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-images',
  'service-images',
  true,                            -- public bucket so image URLs work without signing
  5242880,                         -- 5 MB max file size (matches server-side limit)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Allow public (unauthenticated) read access to all objects in this bucket
--    This is required so <img src="...supabase.co/storage/v1/object/public/service-images/...">
--    works for all website visitors without authentication.
DROP POLICY IF EXISTS "Public read access for service images" ON storage.objects;
CREATE POLICY "Public read access for service images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'service-images');

-- Note: UPLOAD and DELETE operations are performed by the Express backend using
-- the SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level Security entirely.
-- No additional INSERT/DELETE policies are required for the backend to work.
