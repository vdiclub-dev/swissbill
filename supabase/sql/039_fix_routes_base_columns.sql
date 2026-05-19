-- Colixo - Correctif colonnes routes pour dispatch national
-- A executer si Supabase affiche :
-- "Could not find the 'base_lat' column of 'routes' in the schema cache"

alter table public.routes add column if not exists base_lat numeric(10,7);
alter table public.routes add column if not exists base_lng numeric(10,7);
alter table public.routes add column if not exists color_hex text;
alter table public.routes add column if not exists order_locked boolean not null default false;
alter table public.routes add column if not exists reoptimization_blocked boolean not null default false;
alter table public.routes add column if not exists reoptimization_pending jsonb not null default '{}'::jsonb;
alter table public.routes add column if not exists estimated_gain_min integer;

notify pgrst, 'reload schema';
