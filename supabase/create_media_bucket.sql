-- ============================================================================
-- Media Storage bucket — run ONCE in the Supabase SQL Editor.
--
-- Creates a public bucket named "media" for product & attribute images, with
-- the same security posture as the rest of the catalogue:
--   • anyone may READ (public URLs work on the storefront)
--   • only an admin (profiles.is_admin) may UPLOAD / UPDATE / DELETE
--
-- Mirrors the app: reads are public, writes are gated behind is_admin(),
-- exactly like the products tables. Re-running is safe.
-- ============================================================================

-- 1. The bucket. public = true so getPublicUrl() links load without a token.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- 2. Policies on storage.objects, scoped to this bucket.
--    (storage.objects already has RLS enabled by Supabase.)

drop policy if exists "media public read" on storage.objects;
create policy "media public read"
  on storage.objects for select
  using (bucket_id = 'media');

drop policy if exists "media admin insert" on storage.objects;
create policy "media admin insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media admin update" on storage.objects;
create policy "media admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and public.is_admin());
