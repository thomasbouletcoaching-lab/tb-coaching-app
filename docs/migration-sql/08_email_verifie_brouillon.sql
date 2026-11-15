-- BROUILLON, NON EXÉCUTÉ. À relire avec Thomas avant application.
-- Constat : trois fonctions identifient la personne par auth.jwt()->>'email' (valeur déclarée, pas forcément confirmée).
-- Correctif : elles utilisent public.my_email() (déjà existante), qui ne renvoie l'e-mail que s'il est confirmé.
-- Effet sur les 18 comptes actuels : aucun (tous confirmés). Effet sur un futur compte non confirmé : aucune donnée.

-- 1. gx_my_client (utilisée par gx_me, gx_join, gx_post_record : elles suivent automatiquement).
create or replace function public.gx_my_client() returns uuid
language sql stable security definer set search_path = 'public' as $$
  select c.id from clients c
  where c.email is not null and lower(c.email) = my_email() and not c.archived
  order by c.created_at limit 1
$$;

-- 2. is_client_of.
create or replace function public.is_client_of(coach uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists(select 1 from public.clients c where c.coach_id = coach and c.email is not null
    and lower(c.email) = my_email())
$$;

-- 3. my_payments : même règle de sélection, e-mail confirmé seulement.
create or replace function public.my_payments() returns jsonb
language sql stable security definer set search_path = 'public' as $$
  select jsonb_build_object(
    'pays', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'label',p.label,'due',p.due,'amount',p.amount,'status',p.status,'paid_at',p.paid_at,'method',p.method,'invoice_no',p.invoice_no,'invoice',p.invoice,'client_name',p.client_name) order by p.due)
      from biz_payments p join clients c on c.id = p.client_id
      where lower(c.email) = my_email() and p.coach_id = c.coach_id), '[]'::jsonb),
    'paylink', (select s.data->>'paylink' from biz_settings s join clients c on c.coach_id = s.coach_id
      where lower(c.email) = my_email() limit 1))
$$;

-- Vérification à faire après application (sans afficher d'adresse) :
--  * comptages identiques avant/après pour my_payments, gx_me, is_client_of sur les 18 comptes ;
--  * l'app Membre (Mes paiements, gamification, fiche client) fonctionne sur un compte de test.
