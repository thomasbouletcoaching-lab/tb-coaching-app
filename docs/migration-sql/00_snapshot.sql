-- Instantané interne (filet de sécurité contre une erreur de migration). N'est PAS la sauvegarde exportée du plan (§ 11).
create schema if not exists bak_20261114;
create table bak_20261114.clients      as table public.clients;
create table bak_20261114.carnet       as table public.carnet;
create table bak_20261114.suivi        as table public.suivi;
create table bak_20261114.nutri_log    as table public.nutri_log;
create table bak_20261114.mesures      as table public.mesures;
create table bak_20261114.messages     as table public.messages;
create table bak_20261114.coach_notes  as table public.coach_notes;
create table bak_20261114.prog_hist    as table public.prog_hist;
create table bak_20261114.onboarding   as table public.onboarding;
create table bak_20261114.cycles       as table public.cycles;
create table bak_20261114.cxs_profiles       as table public.cxs_profiles;
create table bak_20261114.cxs_member_data    as table public.cxs_member_data;
create table bak_20261114.cxs_messages       as table public.cxs_messages;
create table bak_20261114.cxs_coach_store    as table public.cxs_coach_store;
create table bak_20261114.cxs_coach_food_plans as table public.cxs_coach_food_plans;
-- Le schéma n'est pas exposé à l'API. Comptages à noter : select 'x', count(*) from bak_20261114.<table>;
