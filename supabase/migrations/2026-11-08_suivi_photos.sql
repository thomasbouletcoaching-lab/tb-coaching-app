-- =====================================================================
-- 2026-11-08 · Photos de progrès envoyées volontairement au coach
--
-- L'app garde les photos sur le téléphone. Avec cette migration, le membre
-- peut en envoyer certaines (bouton « Envoyer ces 2 photos à Thomas » du
-- comparateur, ou témoignage avec photos). Elles vont dans le dossier privé
--   media/progress/<auth.uid()>/<fichier>.jpg
-- Droits :
--   · le membre dépose, lit, remplace et supprime SES photos ;
--   · le coach (cxs_is_coach()) les lit toutes ;
--   · personne d'autre n'y a accès (le bucket reste privé, liens signés 1 h).
--
-- Sans cette migration, le bouton d'envoi affiche « L'envoi de photos n'est
-- pas encore activé par Thomas » et rien d'autre ne change.
--
-- Les politiques existantes du bucket « media » (media_read, media_insert,
-- media_delete, media_lib_*) ne sont pas modifiées : les politiques
-- PERMISSIVE s'additionnent.
--
-- À relire puis appliquer dans l'éditeur SQL de Supabase.
-- =====================================================================

begin;

drop policy if exists "progress_insert_own" on storage.objects;
create policy "progress_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'progress'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "progress_update_own" on storage.objects;
create policy "progress_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'progress'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'progress'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "progress_read_own_or_coach" on storage.objects;
create policy "progress_read_own_or_coach" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'progress'
    and ((storage.foldername(name))[2] = auth.uid()::text or public.cxs_is_coach())
  );

drop policy if exists "progress_delete_own" on storage.objects;
create policy "progress_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'progress'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

commit;

-- IMPORTANT : appliquer d'abord 2026-11-08_securite_profils.sql.
-- Sans lui, n'importe quel membre peut se déclarer coach (cxs_is_coach())
-- et lire ces photos.
--
-- RETOUR ARRIÈRE :
--   drop policy if exists "progress_insert_own" on storage.objects;
--   drop policy if exists "progress_update_own" on storage.objects;
--   drop policy if exists "progress_read_own_or_coach" on storage.objects;
--   drop policy if exists "progress_delete_own" on storage.objects;
