-- Complément à 20261029000000_cxs_tables.sql (à appliquer après lui).
-- 1) Un membre crée son propre profil à la première connexion (sinon l'app ne peut pas démarrer).
create policy "cxs membre crée son profil" on public.cxs_profiles for insert to authenticated
  with check (id = auth.uid() and is_coach = false);

-- 2) Quota de messages : un membre sans profil n'écrit plus ; formule « surmesure » (illimitée) acceptée.
drop policy if exists "cxs membre écrit dans son fil (quota)" on public.cxs_messages;
create policy "cxs membre écrit dans son fil (quota)" on public.cxs_messages for insert to authenticated
  with check (
    sender = auth.uid() and (
      public.cxs_is_coach()
      or (
        user_id = auth.uid()
        and exists (
          select 1 from public.cxs_profiles p join public.cxs_tiers t on t.id = p.tier
          where p.id = auth.uid() and (t.msgs_per_week is null or public.cxs_msgs_left() > 0)
        )
      )
    )
  );
