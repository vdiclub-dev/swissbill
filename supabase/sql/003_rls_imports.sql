alter table public.orders enable row level security;
alter table public.import_batches enable row level security;
alter table public.client_import_profiles enable row level security;
alter table public.client_tariff_rules enable row level security;

grant select, insert, update on public.orders to authenticated;
grant select, insert, update on public.import_batches to authenticated;
grant select, insert, update on public.client_import_profiles to authenticated;
grant select on public.client_tariff_rules to authenticated;

drop policy if exists orders_client_select on public.orders;
drop policy if exists orders_client_insert on public.orders;
drop policy if exists orders_client_update on public.orders;
drop policy if exists import_batches_client_select on public.import_batches;
drop policy if exists import_batches_client_insert on public.import_batches;
drop policy if exists import_batches_client_update on public.import_batches;
drop policy if exists client_import_profiles_select on public.client_import_profiles;
drop policy if exists client_import_profiles_insert on public.client_import_profiles;
drop policy if exists client_import_profiles_update on public.client_import_profiles;
drop policy if exists client_tariff_rules_select on public.client_tariff_rules;

create policy orders_client_select
on public.orders for select to authenticated
using (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
);

create policy orders_client_insert
on public.orders for insert to authenticated
with check (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
);

create policy orders_client_update
on public.orders for update to authenticated
using (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
)
with check (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
);

create policy import_batches_client_select
on public.import_batches for select to authenticated
using (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
);

create policy import_batches_client_insert
on public.import_batches for insert to authenticated
with check (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
);

create policy import_batches_client_update
on public.import_batches for update to authenticated
using (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
)
with check (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
);

create policy client_import_profiles_select
on public.client_import_profiles for select to authenticated
using (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
);

create policy client_import_profiles_insert
on public.client_import_profiles for insert to authenticated
with check (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
);

create policy client_import_profiles_update
on public.client_import_profiles for update to authenticated
using (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
)
with check (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
);

create policy client_tariff_rules_select
on public.client_tariff_rules for select to authenticated
using (
  client_id = coalesce(
    (select u.entreprise_id from public.utilisateurs u where u.id = auth.uid()),
    auth.uid()
  )
);
