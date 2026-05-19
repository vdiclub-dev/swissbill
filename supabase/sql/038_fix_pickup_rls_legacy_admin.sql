-- Colixo - Correctif RLS ramasses recurrentes
-- Le portail Colixo supporte encore une connexion legacy par code.
-- Dans ce mode, Supabase voit parfois les requetes frontend avec le role anon.
-- Ces policies debloquent les ramasses recurrentes pour le portail statique.

alter table public.pickup_schedules enable row level security;
alter table public.pickups enable row level security;

grant select, insert, update, delete on public.pickup_schedules to anon, authenticated;
grant select, insert, update, delete on public.pickups to anon, authenticated;

drop policy if exists auth_all_pickup_schedules on public.pickup_schedules;
create policy auth_all_pickup_schedules
on public.pickup_schedules
for all
to authenticated
using (true)
with check (true);

drop policy if exists anon_all_pickup_schedules on public.pickup_schedules;
create policy anon_all_pickup_schedules
on public.pickup_schedules
for all
to anon
using (true)
with check (true);

drop policy if exists service_all_pickup_schedules on public.pickup_schedules;
create policy service_all_pickup_schedules
on public.pickup_schedules
for all
to service_role
using (true)
with check (true);

drop policy if exists auth_all_pickups on public.pickups;
create policy auth_all_pickups
on public.pickups
for all
to authenticated
using (true)
with check (true);

drop policy if exists anon_all_pickups on public.pickups;
create policy anon_all_pickups
on public.pickups
for all
to anon
using (true)
with check (true);

drop policy if exists service_all_pickups on public.pickups;
create policy service_all_pickups
on public.pickups
for all
to service_role
using (true)
with check (true);

notify pgrst, 'reload schema';
