-- Personas fictifs (aucun client réel)
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000c0ac', 'coach-test@exemple.invalid'),
 ('00000000-0000-0000-0000-0000000000a1', 'femme-reprise@exemple.invalid'),
 ('00000000-0000-0000-0000-0000000000a2', 'homme-avance@exemple.invalid'),
 ('00000000-0000-0000-0000-0000000000a3', 'debutante-sans-materiel@exemple.invalid'),
 ('00000000-0000-0000-0000-0000000000b1', 'autonome-sans-consentement@exemple.invalid'),
 ('00000000-0000-0000-0000-0000000000b2', 'autonome-avec-consentement@exemple.invalid'),
 ('00000000-0000-0000-0000-0000000000b3', 'invite@exemple.invalid')
on conflict do nothing;
insert into public.cxs_profiles (id, email, tier, is_coach) values
 ('00000000-0000-0000-0000-00000000c0ac', 'coach-test@exemple.invalid', 'surmesure', true),
 ('00000000-0000-0000-0000-0000000000a1', 'femme-reprise@exemple.invalid', 'avance', false),
 ('00000000-0000-0000-0000-0000000000a2', 'homme-avance@exemple.invalid', 'surmesure', false),
 ('00000000-0000-0000-0000-0000000000a3', 'debutante-sans-materiel@exemple.invalid', 'avance', false),
 ('00000000-0000-0000-0000-0000000000b1', 'autonome-sans-consentement@exemple.invalid', 'premium', false),
 ('00000000-0000-0000-0000-0000000000b2', 'autonome-avec-consentement@exemple.invalid', 'premium', false),
 ('00000000-0000-0000-0000-0000000000b3', 'invite@exemple.invalid', 'invite', false)
on conflict do nothing;
