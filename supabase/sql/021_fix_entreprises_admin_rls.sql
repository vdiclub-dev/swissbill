-- ============================================================
-- Colixo - RLS entreprises admin
-- Objectif:
-- - autoriser les admins/super_admins a creer et modifier les clients
-- - resserrer la suppression aux admins/super_admins uniquement
-- - ne pas ouvrir INSERT/UPDATE/DELETE a tous les utilisateurs connectes
-- ============================================================

drop policy if exists "admin insert entreprises" on public.entreprises;
drop policy if exists "admin update entreprises" on public.entreprises;
drop policy if exists "admin can delete entreprises" on public.entreprises;
drop policy if exists "admin delete entreprises" on public.entreprises;

create policy "admin insert entreprises"
on public.entreprises
for insert
to authenticated
with check (
  exists (
    select 1
    from public.utilisateurs u
    where coalesce(u.actif, true) = true
      and u.role in ('admin', 'super_admin')
      and (
        u.id = auth.uid()
        or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create policy "admin update entreprises"
on public.entreprises
for update
to authenticated
using (
  exists (
    select 1
    from public.utilisateurs u
    where coalesce(u.actif, true) = true
      and u.role in ('admin', 'super_admin')
      and (
        u.id = auth.uid()
        or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
)
with check (
  exists (
    select 1
    from public.utilisateurs u
    where coalesce(u.actif, true) = true
      and u.role in ('admin', 'super_admin')
      and (
        u.id = auth.uid()
        or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create policy "admin delete entreprises"
on public.entreprises
for delete
to authenticated
using (
  exists (
    select 1
    from public.utilisateurs u
    where coalesce(u.actif, true) = true
      and u.role in ('admin', 'super_admin')
      and (
        u.id = auth.uid()
        or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);
