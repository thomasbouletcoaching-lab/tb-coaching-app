-- BROUILLON, NON EXÉCUTÉ. Exiger un e-mail confirmé dans les fonctions qui identifient la personne par son e-mail.
-- Aujourd'hui : auth.jwt()->>'email' est pris tel quel. Sûr seulement si la confirmation d'e-mail est obligatoire à l'inscription.
-- Les 18 comptes actuels sont tous confirmés (vérifié le 15/11). Ce correctif ferme le cas des futurs comptes.

-- 1. Une seule source : l'e-mail du compte, seulement s'il est confirmé.
create or replace function public.cxs_verified_email()
returns text language sql stable security definer set search_path = '' as $$
  select u.email::text from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null
$$;
revoke execute on function public.cxs_verified_email() from anon, public;

-- 2. Les fonctions qui lisent l'e-mail passent par cette source.
create or replace function public.gx_my_client() returns uuid
language sql stable security definer set search_path = 'public' as $$
  select c.id from clients c
  where c.email is not null and lower(c.email) = lower(public.cxs_verified_email()) and not c.archived
  order by c.created_at limit 1
$$;

create or replace function public.is_client_of(coach uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists(select 1 from public.clients c where c.coach_id = coach and c.email is not null
    and lower(c.email) = lower(public.cxs_verified_email()))
$$;

-- my_payments : même principe. Corps à reprendre tel quel en remplaçant
--   (select auth.jwt()->>'email')  par  public.cxs_verified_email()
-- (la règle de sélection est identique ; voir la définition en place avant application).

-- Effet attendu : pour un compte confirmé (les 18 actuels), résultat identique. Pour un compte non confirmé : aucune donnée.
-- À appliquer seulement après relecture par Thomas, et vérification sur les 18 comptes (comptages avant/après, sans adresse affichée).
