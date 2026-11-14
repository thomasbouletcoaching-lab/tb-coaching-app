-- SÉCURITÉ PHASE 1 (f) — Le coach ne lit que les dossiers des personnes coachées ou consentantes (décision D8)
-- À RELIRE. RIEN N'EST APPLIQUÉ. Idempotent. Ne modifie ni ne supprime aucune donnée.
-- À appliquer APRÈS le fichier (e).
--
-- AVANT : le coach lit les données de TOUS les comptes.
-- APRÈS : le coach lit le dossier d'un compte seulement si l'une de ces conditions est vraie :
--   1) le compte a une formule coachée ou un accès Invité (liste ci-dessous) ;
--   2) le compte correspond à une fiche « clients » dont ce coach est le coach (ancienne app, rattachement par e-mail) ;
--   3) la personne a donné son consentement au suivi (nouvelle colonne cxs_profiles.consent_suivi, false par défaut).
-- Chaque membre garde l'accès à ses propres données, comme avant.
--
-- HYPOTHÈSE À VALIDER PAR THOMAS : la liste des formules « coachées » (rang 2 et plus dans js/config.js).
--
-- VOLONTAIREMENT NON RESTREINTS (écart avec la demande, expliqué dans docs/securite-phase1.md, § 8) :
--   - cxs_profiles : le coach a besoin du nom, de l'e-mail et de la formule de CHAQUE compte pour gérer les abonnés et
--     attribuer les formules. Les droits se règlent par ligne, pas par colonne : masquer la ligne casserait cet écran.
--   - cxs_messages : le coach est l'interlocuteur de chaque conversation ; lui cacher les messages qu'on lui écrit n'a pas de sens.

-- 3) Consentement : colonne ajoutée seulement si elle n'existe pas. false = pas de consentement.
alter table public.cxs_profiles add column if not exists consent_suivi boolean not null default false;
alter table public.cxs_profiles add column if not exists consent_suivi_at timestamptz; -- date du dernier changement (preuve)
comment on column public.cxs_profiles.consent_suivi is 'Consentement explicite, séparé et révocable de la personne à ce que le coach lise son dossier (D8). false par défaut.';

-- Règle unique, réutilisée par les politiques : « l'appelant est coach ET a le droit de lire le dossier de cette personne ».
create or replace function public.cxs_coach_peut_lire(cible uuid)
 returns boolean
 language sql
 stable security definer
 set search_path = ''
as $function$
  select public.cxs_is_coach()                                   -- l'appelant doit être coach
    and (
      exists (select 1 from public.cxs_profiles p
              where p.id = cible
                and (p.tier in ('essentiel', 'suivi', 'avance', 'invite', 'surmesure')  -- 1) formule coachée ou Invité
                     or p.consent_suivi))                                               -- 3) consentement donné
      or exists (select 1 from public.clients c
                 join public.cxs_profiles p on lower(p.email) = lower(c.email)
                 where p.id = cible
                   and c.coach_id = (select auth.uid())           -- 2) fiche de l'ancienne app dont il est le coach
                   and not coalesce(c.archived, false))
    )
$function$;
revoke all on function public.cxs_coach_peut_lire(uuid) from public, anon;
grant execute on function public.cxs_coach_peut_lire(uuid) to authenticated;

-- Politiques de LECTURE : « soi-même, ou le coach s'il a le droit de lire ce dossier ».
alter policy "cxs lire ses données ou coach" on public.cxs_member_data
  using ((user_id = (select auth.uid())) or public.cxs_coach_peut_lire(user_id));
alter policy "nutri lit ses totaux ou coach" on public.nutri_daily
  using ((user_id = (select auth.uid())) or public.cxs_coach_peut_lire(user_id));
-- Séance en direct : une seule politique couvre lecture et écriture ; même règle des deux côtés.
alter policy "cxs séance en direct : membre ou coach" on public.cxs_live_sessions
  using ((user_id = (select auth.uid())) or public.cxs_coach_peut_lire(user_id))
  with check ((user_id = (select auth.uid())) or public.cxs_coach_peut_lire(user_id));

-- RETOUR ARRIÈRE (les colonnes de consentement peuvent rester : elles ne gênent rien) :
--   alter policy "cxs lire ses données ou coach" on public.cxs_member_data using ((user_id = (select auth.uid())) or public.cxs_is_coach());
--   alter policy "nutri lit ses totaux ou coach" on public.nutri_daily using ((user_id = (select auth.uid())) or public.cxs_is_coach());
--   alter policy "cxs séance en direct : membre ou coach" on public.cxs_live_sessions
--     using ((user_id = (select auth.uid())) or public.cxs_is_coach()) with check ((user_id = (select auth.uid())) or public.cxs_is_coach());

-- TESTS (base de test, personas fictifs : COACH ; COACHEE formule 'avance' ; AUTONOME formule 'premium' sans consentement ;
--        CONSENTANTE formule 'premium' avec consent_suivi = true ; transaction annulée) :
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub', '<COACH>')::text, true); set local role authenticated;
--   select count(*) from cxs_member_data where user_id = '<AUTONOME>';     -- attendu : 0 (non autorisé)
--   select count(*) from nutri_daily     where user_id = '<AUTONOME>';     -- attendu : 0 (non autorisé)
--   select count(*) from cxs_member_data where user_id = '<COACHEE>';      -- attendu : 1 (autorisé)
--   select count(*) from cxs_member_data where user_id = '<CONSENTANTE>';  -- attendu : 1 (autorisé)
--   select count(*) from cxs_profiles;                                     -- attendu : tous les comptes (gestion des abonnés)
--   reset role;
--   select set_config('request.jwt.claims', json_build_object('sub', '<AUTONOME>')::text, true); set local role authenticated;
--   select count(*) from cxs_member_data where user_id = '<AUTONOME>';     -- attendu : 1 (ses propres données)
--   select count(*) from cxs_member_data where user_id = '<COACHEE>';      -- attendu : 0
--   select public.cxs_coach_peut_lire('<COACHEE>');                        -- attendu : false (l'appelant n'est pas coach)
--   update cxs_profiles set consent_suivi = true where id = '<AUTONOME>';  -- attendu : 1 ligne (elle consent)
--   reset role;
--   select set_config('request.jwt.claims', json_build_object('sub', '<COACH>')::text, true); set local role authenticated;
--   select count(*) from cxs_member_data where user_id = '<AUTONOME>';     -- attendu : 1 (consentement donné) ; 0 de nouveau après retrait
--   rollback;
