-- ============================================================
-- COLIXO PROSPECTING SYSTEM — Schéma Supabase
-- Exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE : prospects
-- ============================================================
create table if not exists prospects (
  id               uuid primary key default uuid_generate_v4(),

  -- Données entreprise
  entreprise       text not null,
  ville            text,
  secteur          text,
  site_web         text,

  -- Contact
  contact_nom      text,
  contact_role     text,
  linkedin_url     text,
  email            text,
  telephone        text,
  notes            text,

  -- Enrichissement IA
  resume                text,
  besoin_detecte        text,
  angle_commercial      text,
  objections_probables  text,
  score                 integer default 0 check (score >= 0 and score <= 100),
  score_classe          text check (score_classe in ('A','B','C')) default 'C',

  -- Messages générés
  message_connexion text,
  message_1         text,
  relance_1         text,
  relance_2         text,
  email_1           text,
  email_relance     text,
  script_appel      text,

  -- CRM
  statut text default 'a_contacter' check (statut in (
    'a_contacter',
    'analyse_en_cours',
    'pret_a_contacter',
    'contact_envoye',
    'en_attente',
    'repondu',
    'relance_a_faire',
    'rdv',
    'opportunite',
    'perdu'
  )),

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- TABLE : prospect_events  (journal d'activité)
-- ============================================================
create table if not exists prospect_events (
  id           uuid primary key default uuid_generate_v4(),
  prospect_id  uuid not null references prospects(id) on delete cascade,
  event_type   text not null,   -- ex: created, enriched, status_changed, message_generated...
  event_value  text,
  created_at   timestamptz default now()
);

-- ============================================================
-- TABLE : prospect_tasks
-- ============================================================
create table if not exists prospect_tasks (
  id           uuid primary key default uuid_generate_v4(),
  prospect_id  uuid not null references prospects(id) on delete cascade,
  title        text not null,
  due_date     date,
  status       text default 'pending' check (status in ('pending','done','cancelled')),
  created_at   timestamptz default now()
);

-- ============================================================
-- TABLE : replies  (assistant réponse)
-- ============================================================
create table if not exists replies (
  id                    uuid primary key default uuid_generate_v4(),
  prospect_id           uuid not null references prospects(id) on delete cascade,
  source                text,          -- email | linkedin | phone
  raw_message           text not null,
  suggested_reply_short text,
  suggested_reply_sales text,
  suggested_reply_meeting text,
  objection_type        text,
  next_best_action      text,
  created_at            timestamptz default now()
);

-- ============================================================
-- Trigger : updated_at automatique sur prospects
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger prospects_updated_at
  before update on prospects
  for each row execute function set_updated_at();

-- ============================================================
-- Index pour les performances
-- ============================================================
create index if not exists idx_prospects_statut      on prospects(statut);
create index if not exists idx_prospects_score       on prospects(score desc);
create index if not exists idx_events_prospect       on prospect_events(prospect_id, created_at desc);
create index if not exists idx_tasks_prospect        on prospect_tasks(prospect_id);
create index if not exists idx_tasks_due             on prospect_tasks(due_date) where status = 'pending';
create index if not exists idx_replies_prospect      on replies(prospect_id);

-- ============================================================
-- Row Level Security (désactivé pour usage admin uniquement)
-- Si vous ajoutez de l'auth, activez et adaptez les policies
-- ============================================================
alter table prospects       disable row level security;
alter table prospect_events disable row level security;
alter table prospect_tasks  disable row level security;
alter table replies         disable row level security;
