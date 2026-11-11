-- Créateur de programme individualisé, étape 1 : bibliothèque d'exercices classée selon les 8 patterns.
-- Une ligne = un exercice, avec son pattern principal, sa couche (squelette / isolation / module),
-- le matériel possible, le niveau, le coût nerveux et les zones de contre-indication.
--
-- Migration ADDITIVE : crée une nouvelle table, ne lit et ne modifie aucune table existante.
-- Sans danger à relancer (if not exists / drop policy if exists).
-- Retour arrière : drop table public.cxs_exercices;  (aucune autre table n'en dépend)

create table if not exists public.cxs_exercices (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,            -- identifiant stable (sert aux variantes et aux préférences à venir)
  nom                text not null unique,            -- nom français, identique à celui des fiches de l'app
  pattern_principal  text check (pattern_principal in ('PH','PV','TH','TV','SG','SH','CH','FG')),
  pattern_secondaire text check (pattern_secondaire in ('PH','PV','TH','TV','SG','SH','CH','FG')),
  couche             text not null check (couche in ('squelette','isolation','module')),
  categorie          text check (categorie in ('biceps','triceps','elevations_laterales','deltoides_posterieurs','mollets','abdos','avant_bras',
                                               'pectoraux','quadriceps','fessiers','adducteurs','trapezes','epaules_avant','coiffe','puissance','skills',
                                               'unilateral','portes','rotation','cardio','mobilite')),
  muscles            text[] not null default '{}',
  materiel           text[] not null default '{}'
                     check (materiel <@ array['salle_complete','salle_basique','halteres_maison','poids_du_corps','barre_traction','elastique']::text[]),
  niveau             text not null default 'debutant' check (niveau in ('debutant','intermediaire','avance')),
  cout_nerveux       smallint not null default 1 check (cout_nerveux between 1 and 3),
  variantes          text[] not null default '{}',    -- slugs des variantes liées (même pattern)
  contre_indications text[] not null default '{}'
                     check (contre_indications <@ array['epaule','coude','poignet','bas_du_dos','genou','hanche','cheville']::text[]),
  video_url          text,
  note               text,
  actif              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Un exercice du squelette porte forcément un pattern ; isolation et modules portent une catégorie
  constraint cxs_exercices_squelette_pattern check (couche <> 'squelette' or pattern_principal is not null),
  constraint cxs_exercices_hors_squelette_categorie check (couche = 'squelette' or categorie is not null)
);

create index if not exists cxs_exercices_pattern_idx on public.cxs_exercices (pattern_principal) where actif;

alter table public.cxs_exercices enable row level security;

-- Droits : aucun accès sans connexion ; un membre connecté lit les exercices actifs ; seul le coach écrit.
revoke all on public.cxs_exercices from anon;
revoke all on public.cxs_exercices from authenticated;
grant select, insert, update, delete on public.cxs_exercices to authenticated;

drop policy if exists "exercices : lecture des actifs" on public.cxs_exercices;
create policy "exercices : lecture des actifs"
  on public.cxs_exercices for select to authenticated
  using (actif or public.cxs_is_coach());

drop policy if exists "exercices : le coach ajoute" on public.cxs_exercices;
create policy "exercices : le coach ajoute"
  on public.cxs_exercices for insert to authenticated
  with check (public.cxs_is_coach());

drop policy if exists "exercices : le coach modifie" on public.cxs_exercices;
create policy "exercices : le coach modifie"
  on public.cxs_exercices for update to authenticated
  using (public.cxs_is_coach())
  with check (public.cxs_is_coach());

drop policy if exists "exercices : le coach supprime" on public.cxs_exercices;
create policy "exercices : le coach supprime"
  on public.cxs_exercices for delete to authenticated
  using (public.cxs_is_coach());
