begin;

create extension if not exists pgcrypto;

create or replace function public.prime_is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.utilisateurs u
    where u.id = auth.uid()
      and coalesce(u.actif, true) = true
      and u.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.prime_bonus_percent(p_points integer)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_points, 0) < 600 then 0
    when p_points between 600 and 749 then 25
    when p_points between 750 and 899 then 50
    when p_points between 900 and 1049 then 75
    when p_points between 1050 and 1200 then 100
    else 100
  end;
$$;

create table if not exists public.prime_point_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  monthly_max_points integer not null check (monthly_max_points > 0 and monthly_max_points <= 100),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prime_point_deductions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.utilisateurs(id) on delete restrict,
  category_id uuid not null references public.prime_point_categories(id) on delete restrict,
  period_year integer not null check (period_year between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),
  incident_date date not null,
  points_deducted integer not null check (points_deducted > 0),
  severity text not null default 'medium' check (severity in ('light', 'medium', 'serious')),
  comment text not null check (length(trim(comment)) >= 3),
  created_by uuid references public.utilisateurs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.utilisateurs(id) on delete set null,
  void_reason text,
  metadata jsonb not null default '{}'::jsonb,
  constraint prime_deduction_void_reason_required check (
    voided_at is null
    or (voided_by is not null and length(trim(coalesce(void_reason, ''))) >= 3)
  )
);

create table if not exists public.prime_annual_validations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.utilisateurs(id) on delete restrict,
  period_year integer not null check (period_year between 2000 and 2100),
  estimated_points integer not null default 0 check (estimated_points between 0 and 1200),
  estimated_prime_percent integer not null default 0 check (estimated_prime_percent in (0,25,50,75,100)),
  final_prime_percent integer check (final_prime_percent in (0,25,50,75,100)),
  status text not null default 'draft' check (status in ('draft','pending_direction','validated','rejected','paid')),
  direction_note text,
  validated_by uuid references public.utilisateurs(id) on delete set null,
  validated_at timestamptz,
  created_by uuid references public.utilisateurs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, period_year)
);

create table if not exists public.prime_point_audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null,
  employee_id uuid references public.utilisateurs(id) on delete set null,
  actor_id uuid references public.utilisateurs(id) on delete set null,
  event_at timestamptz not null default now(),
  before_data jsonb,
  after_data jsonb,
  note text
);

insert into public.prime_point_categories (code, label, monthly_max_points, sort_order)
values
  ('ponctualite', 'Ponctualité', 15, 10),
  ('fiabilite_planning', 'Fiabilité planning', 10, 20),
  ('procedures_livraison', 'Procédures livraison', 15, 30),
  ('qualite_travail', 'Qualité travail', 15, 40),
  ('consommation_carburant', 'Consommation carburant', 10, 50),
  ('vehicule', 'Véhicule', 10, 60),
  ('securite_routiere', 'Sécurité routière', 10, 70),
  ('comportement_collegues', 'Comportement collègues', 5, 80),
  ('directives_colixo', 'Directives Colixo', 5, 90),
  ('tenue_colixo', 'Tenue Colixo', 5, 100)
on conflict (code) do update
set label = excluded.label,
    monthly_max_points = excluded.monthly_max_points,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

create index if not exists idx_prime_deductions_employee_period
on public.prime_point_deductions(employee_id, period_year, period_month);

create index if not exists idx_prime_deductions_category_period
on public.prime_point_deductions(category_id, period_year, period_month);

create index if not exists idx_prime_deductions_voided
on public.prime_point_deductions(voided_at);

create index if not exists idx_prime_validations_employee_year
on public.prime_annual_validations(employee_id, period_year);

create index if not exists idx_prime_audit_employee
on public.prime_point_audit_logs(employee_id, event_at desc);

create or replace function public.prime_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_prime_categories_updated_at on public.prime_point_categories;
create trigger trg_prime_categories_updated_at
before update on public.prime_point_categories
for each row execute function public.prime_set_updated_at();

drop trigger if exists trg_prime_deductions_updated_at on public.prime_point_deductions;
create trigger trg_prime_deductions_updated_at
before update on public.prime_point_deductions
for each row execute function public.prime_set_updated_at();

drop trigger if exists trg_prime_validations_updated_at on public.prime_annual_validations;
create trigger trg_prime_validations_updated_at
before update on public.prime_annual_validations
for each row execute function public.prime_set_updated_at();

create or replace function public.prime_validate_deduction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_max integer;
  v_category_total integer;
  v_month_total integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'Les retraits de points ne peuvent pas être supprimés. Utilisez voided_at, voided_by et void_reason.';
  end if;

  if tg_op = 'UPDATE' and old.voided_at is not null then
    raise exception 'Un retrait annulé ne peut plus être modifié.';
  end if;

  if new.voided_at is not null then
    if new.voided_by is null or length(trim(coalesce(new.void_reason, ''))) < 3 then
      raise exception 'Annulation impossible sans voided_by et void_reason.';
    end if;
    return new;
  end if;

  select c.monthly_max_points
    into v_category_max
  from public.prime_point_categories c
  where c.id = new.category_id
    and c.is_active = true;

  if v_category_max is null then
    raise exception 'Catégorie de points invalide ou inactive.';
  end if;

  if new.points_deducted > v_category_max then
    raise exception 'Le retrait dépasse le maximum mensuel de cette catégorie.';
  end if;

  select coalesce(sum(d.points_deducted), 0)
    into v_category_total
  from public.prime_point_deductions d
  where d.employee_id = new.employee_id
    and d.category_id = new.category_id
    and d.period_year = new.period_year
    and d.period_month = new.period_month
    and d.voided_at is null
    and d.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_category_total + new.points_deducted > v_category_max then
    raise exception 'Le cumul mensuel de cette catégorie dépasse le maximum autorisé.';
  end if;

  select coalesce(sum(d.points_deducted), 0)
    into v_month_total
  from public.prime_point_deductions d
  where d.employee_id = new.employee_id
    and d.period_year = new.period_year
    and d.period_month = new.period_month
    and d.voided_at is null
    and d.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_month_total + new.points_deducted > 100 then
    raise exception 'Le total des retraits du mois ne peut pas dépasser 100 points.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prime_deductions_validate on public.prime_point_deductions;
create trigger trg_prime_deductions_validate
before insert or update or delete on public.prime_point_deductions
for each row execute function public.prime_validate_deduction();

create or replace function public.prime_prevent_audit_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Les journaux d’audit ne peuvent pas être supprimés.';
end;
$$;

drop trigger if exists trg_prime_audit_no_delete on public.prime_point_audit_logs;
create trigger trg_prime_audit_no_delete
before delete on public.prime_point_audit_logs
for each row execute function public.prime_prevent_audit_delete();

create or replace function public.prime_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_employee uuid;
  v_record uuid;
  v_note text;
begin
  if tg_table_name = 'prime_point_deductions' then
    if tg_op = 'INSERT' then
      v_actor := new.created_by;
      v_employee := new.employee_id;
      v_record := new.id;
    else
      v_actor := coalesce(new.voided_by, new.created_by, old.created_by);
      v_employee := coalesce(new.employee_id, old.employee_id);
      v_record := coalesce(new.id, old.id);
      if tg_op = 'UPDATE' and new.voided_at is not null then
        v_note := new.void_reason;
      end if;
    end if;
  elsif tg_table_name = 'prime_annual_validations' then
    if tg_op = 'INSERT' then
      v_actor := coalesce(new.validated_by, new.created_by);
      v_employee := new.employee_id;
      v_record := new.id;
      v_note := new.direction_note;
    else
      v_actor := coalesce(new.validated_by, new.created_by, old.validated_by, old.created_by);
      v_employee := coalesce(new.employee_id, old.employee_id);
      v_record := coalesce(new.id, old.id);
      v_note := new.direction_note;
    end if;
  else
    raise exception 'Table audit prime non prise en charge: %', tg_table_name;
  end if;

  insert into public.prime_point_audit_logs (
    table_name, record_id, action, employee_id, actor_id, before_data, after_data, note
  )
  values (
    tg_table_name,
    v_record,
    lower(tg_op),
    v_employee,
    v_actor,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
    v_note
  );

  return new;
end;
$$;

drop trigger if exists trg_prime_deductions_audit on public.prime_point_deductions;
create trigger trg_prime_deductions_audit
after insert or update on public.prime_point_deductions
for each row execute function public.prime_audit_log();

drop trigger if exists trg_prime_validations_audit on public.prime_annual_validations;
create trigger trg_prime_validations_audit
after insert or update on public.prime_annual_validations
for each row execute function public.prime_audit_log();

create or replace view public.v_prime_monthly_category_totals
with (security_invoker = true)
as
with employees as (
  select
    u.id as employee_id,
    nullif(trim(concat_ws(' ', u.prenom, u.nom)), '') as employee_name,
    u.email,
    u.role
  from public.utilisateurs u
  where coalesce(u.actif, true) = true
    and u.role in ('chauffeur', 'magasinier', 'auxiliaire')
),
years as (
  select generate_series(
    extract(year from current_date)::integer - 3,
    extract(year from current_date)::integer + 3
  ) as period_year
),
months as (
  select generate_series(1, 12) as period_month
),
categories as (
  select *
  from public.prime_point_categories
  where is_active = true
),
deductions as (
  select
    d.employee_id,
    d.category_id,
    d.period_year,
    d.period_month,
    coalesce(sum(d.points_deducted), 0)::integer as points_deducted,
    count(*)::integer as deductions_count
  from public.prime_point_deductions d
  where d.voided_at is null
  group by d.employee_id, d.category_id, d.period_year, d.period_month
)
select
  e.employee_id,
  coalesce(e.employee_name, e.email, e.employee_id::text) as employee_name,
  e.email,
  e.role,
  y.period_year,
  m.period_month,
  c.id as category_id,
  c.code as category_code,
  c.label as category_label,
  c.monthly_max_points,
  coalesce(d.points_deducted, 0)::integer as points_deducted,
  greatest(c.monthly_max_points - coalesce(d.points_deducted, 0)::integer, 0) as category_balance,
  coalesce(d.deductions_count, 0)::integer as deductions_count
from employees e
cross join years y
cross join months m
cross join categories c
left join deductions d
  on d.employee_id = e.employee_id
 and d.category_id = c.id
 and d.period_year = y.period_year
 and d.period_month = m.period_month;

create or replace view public.v_prime_monthly_balances
with (security_invoker = true)
as
with employees as (
  select
    u.id as employee_id,
    nullif(trim(concat_ws(' ', u.prenom, u.nom)), '') as employee_name,
    u.email,
    u.role
  from public.utilisateurs u
  where coalesce(u.actif, true) = true
    and u.role in ('chauffeur', 'magasinier', 'auxiliaire')
),
years as (
  select generate_series(
    extract(year from current_date)::integer - 3,
    extract(year from current_date)::integer + 3
  ) as period_year
),
months as (
  select generate_series(1, 12) as period_month
),
deductions as (
  select
    employee_id,
    period_year,
    period_month,
    coalesce(sum(points_deducted), 0)::integer as points_deducted,
    count(*)::integer as deductions_count
  from public.prime_point_deductions
  where voided_at is null
  group by employee_id, period_year, period_month
)
select
  e.employee_id,
  coalesce(e.employee_name, e.email, e.employee_id::text) as employee_name,
  e.email,
  e.role,
  y.period_year,
  m.period_month,
  100 as monthly_start_points,
  coalesce(d.points_deducted, 0)::integer as points_deducted,
  greatest(100 - coalesce(d.points_deducted, 0)::integer, 0) as monthly_balance,
  coalesce(d.deductions_count, 0)::integer as deductions_count
from employees e
cross join years y
cross join months m
left join deductions d
  on d.employee_id = e.employee_id
 and d.period_year = y.period_year
 and d.period_month = m.period_month;

create or replace view public.v_prime_annual_balances
with (security_invoker = true)
as
select
  employee_id,
  employee_name,
  email,
  role,
  period_year,
  1200 as annual_max_points,
  coalesce(sum(points_deducted), 0)::integer as annual_points_deducted,
  coalesce(sum(monthly_balance), 0)::integer as annual_points,
  public.prime_bonus_percent(coalesce(sum(monthly_balance), 0)::integer) as estimated_prime_percent
from public.v_prime_monthly_balances
group by employee_id, employee_name, email, role, period_year;

alter table public.prime_point_categories enable row level security;
alter table public.prime_point_deductions enable row level security;
alter table public.prime_annual_validations enable row level security;
alter table public.prime_point_audit_logs enable row level security;

drop policy if exists prime_categories_admin_select on public.prime_point_categories;
drop policy if exists prime_deductions_admin_select on public.prime_point_deductions;
drop policy if exists prime_validations_admin_select on public.prime_annual_validations;
drop policy if exists prime_audit_admin_select on public.prime_point_audit_logs;

create policy prime_categories_admin_select
on public.prime_point_categories
for select to authenticated
using (public.prime_is_admin());

create policy prime_deductions_admin_select
on public.prime_point_deductions
for select to authenticated
using (public.prime_is_admin());

create policy prime_validations_admin_select
on public.prime_annual_validations
for select to authenticated
using (public.prime_is_admin());

create policy prime_audit_admin_select
on public.prime_point_audit_logs
for select to authenticated
using (public.prime_is_admin());

create or replace function public.admin_prime_dashboard(
  p_admin_id uuid,
  p_code text,
  p_year integer default extract(year from current_date)::integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categories jsonb;
  v_employees jsonb;
  v_monthly jsonb;
  v_category_totals jsonb;
  v_annual jsonb;
  v_deductions jsonb;
  v_validations jsonb;
  v_audit jsonb;
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order), '[]'::jsonb)
    into v_categories
  from public.prime_point_categories c
  where c.is_active = true;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.nom, e.prenom), '[]'::jsonb)
    into v_employees
  from (
    select id, prenom, nom, email, role, actif
    from public.utilisateurs
    where coalesce(actif, true) = true
      and role in ('chauffeur', 'magasinier', 'auxiliaire')
  ) e;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.employee_name, m.period_month), '[]'::jsonb)
    into v_monthly
  from public.v_prime_monthly_balances m
  where m.period_year = p_year;

  select coalesce(jsonb_agg(to_jsonb(ct) order by ct.employee_name, ct.period_month, ct.category_code), '[]'::jsonb)
    into v_category_totals
  from public.v_prime_monthly_category_totals ct
  where ct.period_year = p_year;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.employee_name), '[]'::jsonb)
    into v_annual
  from public.v_prime_annual_balances a
  where a.period_year = p_year;

  select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at desc), '[]'::jsonb)
    into v_deductions
  from (
    select
      d.*,
      c.code as category_code,
      c.label as category_label,
      nullif(trim(concat_ws(' ', e.prenom, e.nom)), '') as employee_name,
      nullif(trim(concat_ws(' ', a.prenom, a.nom)), '') as created_by_name,
      nullif(trim(concat_ws(' ', v.prenom, v.nom)), '') as voided_by_name
    from public.prime_point_deductions d
    join public.prime_point_categories c on c.id = d.category_id
    left join public.utilisateurs e on e.id = d.employee_id
    left join public.utilisateurs a on a.id = d.created_by
    left join public.utilisateurs v on v.id = d.voided_by
    where d.period_year = p_year
  ) d;

  select coalesce(jsonb_agg(to_jsonb(v) order by v.employee_name), '[]'::jsonb)
    into v_validations
  from (
    select
      val.*,
      nullif(trim(concat_ws(' ', e.prenom, e.nom)), '') as employee_name,
      nullif(trim(concat_ws(' ', u.prenom, u.nom)), '') as validated_by_name
    from public.prime_annual_validations val
    left join public.utilisateurs e on e.id = val.employee_id
    left join public.utilisateurs u on u.id = val.validated_by
    where val.period_year = p_year
  ) v;

  select coalesce(jsonb_agg(to_jsonb(l) order by l.event_at desc), '[]'::jsonb)
    into v_audit
  from (
    select
      l.*,
      nullif(trim(concat_ws(' ', e.prenom, e.nom)), '') as employee_name,
      nullif(trim(concat_ws(' ', a.prenom, a.nom)), '') as actor_name
    from public.prime_point_audit_logs l
    left join public.utilisateurs e on e.id = l.employee_id
    left join public.utilisateurs a on a.id = l.actor_id
    where extract(year from l.event_at)::integer = p_year
       or exists (
         select 1 from public.prime_point_deductions d
         where d.id = l.record_id and d.period_year = p_year
       )
       or exists (
         select 1 from public.prime_annual_validations val
         where val.id = l.record_id and val.period_year = p_year
       )
  ) l;

  return jsonb_build_object(
    'year', p_year,
    'categories', v_categories,
    'employees', v_employees,
    'monthly_balances', v_monthly,
    'category_totals', v_category_totals,
    'annual_balances', v_annual,
    'deductions', v_deductions,
    'validations', v_validations,
    'audit_logs', v_audit,
    'notice', 'Prime variable, non garantie, soumise à validation finale de la direction.'
  );
end;
$$;

create or replace function public.admin_prime_add_deduction(
  p_admin_id uuid,
  p_code text,
  p_employee_id uuid,
  p_category_code text,
  p_period_year integer,
  p_period_month integer,
  p_incident_date date,
  p_points_deducted integer,
  p_severity text,
  p_comment text
)
returns public.prime_point_deductions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.utilisateurs;
  v_category_id uuid;
  v_row public.prime_point_deductions;
begin
  select * into v_admin from public.colixo_assert_code_admin(p_admin_id, p_code);

  if coalesce(p_severity, 'medium') not in ('light', 'medium', 'serious') then
    raise exception 'Gravité invalide.';
  end if;

  if length(trim(coalesce(p_comment, ''))) < 3 then
    raise exception 'Commentaire obligatoire.';
  end if;

  if not exists (
    select 1
    from public.utilisateurs u
    where u.id = p_employee_id
      and coalesce(u.actif, true) = true
      and u.role in ('chauffeur', 'magasinier', 'auxiliaire')
  ) then
    raise exception 'Employé invalide ou inactif.';
  end if;

  select id into v_category_id
  from public.prime_point_categories
  where code = p_category_code
    and is_active = true;

  if v_category_id is null then
    raise exception 'Catégorie invalide.';
  end if;

  insert into public.prime_point_deductions (
    employee_id, category_id, period_year, period_month, incident_date,
    points_deducted, severity, comment, created_by
  )
  values (
    p_employee_id, v_category_id, p_period_year, p_period_month, p_incident_date,
    p_points_deducted, coalesce(nullif(p_severity, ''), 'medium'), p_comment, v_admin.id
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_prime_void_deduction(
  p_admin_id uuid,
  p_code text,
  p_deduction_id uuid,
  p_void_reason text
)
returns public.prime_point_deductions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.utilisateurs;
  v_row public.prime_point_deductions;
begin
  select * into v_admin from public.colixo_assert_code_admin(p_admin_id, p_code);

  if length(trim(coalesce(p_void_reason, ''))) < 3 then
    raise exception 'Motif d’annulation obligatoire.';
  end if;

  select * into v_row
  from public.prime_point_deductions
  where id = p_deduction_id;

  if v_row.id is null then
    raise exception 'Retrait introuvable.';
  end if;

  if v_row.voided_at is not null then
    raise exception 'Ce retrait est déjà annulé.';
  end if;

  update public.prime_point_deductions
  set voided_at = now(),
      voided_by = v_admin.id,
      void_reason = p_void_reason
  where id = p_deduction_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_prime_validate_annual(
  p_admin_id uuid,
  p_code text,
  p_employee_id uuid,
  p_year integer,
  p_final_prime_percent integer,
  p_status text default 'validated',
  p_direction_note text default null
)
returns public.prime_annual_validations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.utilisateurs;
  v_points integer;
  v_estimated integer;
  v_row public.prime_annual_validations;
begin
  select * into v_admin from public.colixo_assert_code_admin(p_admin_id, p_code);

  if p_final_prime_percent not in (0,25,50,75,100) then
    raise exception 'Pourcentage final invalide.';
  end if;

  select annual_points, estimated_prime_percent
    into v_points, v_estimated
  from public.v_prime_annual_balances
  where employee_id = p_employee_id
    and period_year = p_year;

  if v_points is null then
    raise exception 'Solde annuel introuvable.';
  end if;

  insert into public.prime_annual_validations (
    employee_id, period_year, estimated_points, estimated_prime_percent,
    final_prime_percent, status, direction_note, validated_by, validated_at, created_by
  )
  values (
    p_employee_id, p_year, v_points, v_estimated,
    p_final_prime_percent, coalesce(nullif(p_status, ''), 'validated'),
    p_direction_note, v_admin.id, now(), v_admin.id
  )
  on conflict (employee_id, period_year) do update
  set estimated_points = excluded.estimated_points,
      estimated_prime_percent = excluded.estimated_prime_percent,
      final_prime_percent = excluded.final_prime_percent,
      status = excluded.status,
      direction_note = excluded.direction_note,
      validated_by = excluded.validated_by,
      validated_at = excluded.validated_at,
      updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_prime_dashboard(uuid, text, integer) from public;
revoke all on function public.admin_prime_add_deduction(uuid, text, uuid, text, integer, integer, date, integer, text, text) from public;
revoke all on function public.admin_prime_void_deduction(uuid, text, uuid, text) from public;
revoke all on function public.admin_prime_validate_annual(uuid, text, uuid, integer, integer, text, text) from public;

grant execute on function public.admin_prime_dashboard(uuid, text, integer) to anon, authenticated;
grant execute on function public.admin_prime_add_deduction(uuid, text, uuid, text, integer, integer, date, integer, text, text) to anon, authenticated;
grant execute on function public.admin_prime_void_deduction(uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.admin_prime_validate_annual(uuid, text, uuid, integer, integer, text, text) to anon, authenticated;

grant select on public.prime_point_categories to authenticated;
grant select on public.prime_point_deductions to authenticated;
grant select on public.prime_annual_validations to authenticated;
grant select on public.prime_point_audit_logs to authenticated;
grant select on public.v_prime_monthly_category_totals to authenticated;
grant select on public.v_prime_monthly_balances to authenticated;
grant select on public.v_prime_annual_balances to authenticated;

notify pgrst, 'reload schema';

commit;
