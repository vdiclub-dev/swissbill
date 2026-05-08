-- Table des profils categories pour campagnes mail Colixo
-- Permet de partager templates/cadences entre navigateurs via Supabase.

create table if not exists public.mail_category_profiles (
  key text primary key,
  label text not null,
  subject_prefix text not null,
  focus text not null,
  cadence_after1 integer not null default 3 check (cadence_after1 >= 1),
  cadence_after2 integer not null default 4 check (cadence_after2 >= 1),
  cadence_after3 integer not null default 7 check (cadence_after3 >= 1),
  updated_at timestamptz not null default now()
);

create or replace function public.mail_category_profiles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_mail_category_profiles_updated_at on public.mail_category_profiles;
create trigger trg_mail_category_profiles_updated_at
before update on public.mail_category_profiles
for each row
execute function public.mail_category_profiles_set_updated_at();

alter table public.mail_category_profiles enable row level security;

-- Adapter ces policies selon vos besoins de securite.
drop policy if exists "mail_category_profiles_select_anon" on public.mail_category_profiles;
create policy "mail_category_profiles_select_anon"
on public.mail_category_profiles
for select
to anon
using (true);

drop policy if exists "mail_category_profiles_insert_anon" on public.mail_category_profiles;
create policy "mail_category_profiles_insert_anon"
on public.mail_category_profiles
for insert
to anon
with check (true);

drop policy if exists "mail_category_profiles_update_anon" on public.mail_category_profiles;
create policy "mail_category_profiles_update_anon"
on public.mail_category_profiles
for update
to anon
using (true)
with check (true);

-- Valeurs par defaut
insert into public.mail_category_profiles (key, label, subject_prefix, focus, cadence_after1, cadence_after2, cadence_after3)
values
  ('regie', 'Regie immobiliere', 'Optimiser vos interventions', 'planification des interventions, communication locataire et suivi terrain', 2, 5, 10),
  ('pme', 'PME services', 'Gagner du temps operationnel', 'coordination equipe, suivi des missions et reactivite client', 3, 6, 12),
  ('ecommerce', 'E-commerce', 'Fluidifier vos livraisons', 'orchestration des tournees, suivi client et fiabilite des delais', 1, 3, 7),
  ('industrie', 'Industrie', 'Securiser vos flux logistiques', 'tracabilite, coordination quai/transport et pilotage des urgences', 4, 7, 14),
  ('sante', 'Sante', 'Fiabiliser vos operations sensibles', 'respect des contraintes, priorisation des urgences et visibilite temps reel', 2, 4, 9),
  ('autre', 'Autre', 'Presentation Colixo', 'pilotage des operations terrain, suivi client et performance quotidienne', 3, 4, 7)
on conflict (key) do update
set
  label = excluded.label,
  subject_prefix = excluded.subject_prefix,
  focus = excluded.focus,
  cadence_after1 = excluded.cadence_after1,
  cadence_after2 = excluded.cadence_after2,
  cadence_after3 = excluded.cadence_after3;
