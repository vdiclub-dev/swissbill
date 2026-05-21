begin;

create table if not exists public.prime_rh_alerts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.utilisateurs(id) on delete restrict,
  period_year integer not null check (period_year between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),
  alert_type text not null check (alert_type in (
    'serious_count_2',
    'serious_count_3',
    'serious_points_10',
    'total_points_20',
    'manual_red'
  )),
  severity_level text not null check (severity_level in ('orange', 'red', 'follow_up')),
  trigger_reason text not null,
  serious_deductions_count integer not null default 0 check (serious_deductions_count >= 0),
  serious_points_total integer not null default 0 check (serious_points_total >= 0),
  total_points_deducted integer not null default 0 check (total_points_deducted >= 0),
  status text not null default 'open' check (status in (
    'open',
    'reviewed',
    'interview_scheduled',
    'warning_draft',
    'warning_sent',
    'closed_no_action'
  )),
  reviewed_by uuid references public.utilisateurs(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  warning_letter_text text,
  warning_letter_created_at timestamptz,
  warning_letter_validated_by uuid references public.utilisateurs(id) on delete set null,
  warning_letter_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prime_rh_alerts_unique_month_type unique (employee_id, period_year, period_month, alert_type)
);

create index if not exists idx_prime_rh_alerts_employee_period
on public.prime_rh_alerts(employee_id, period_year, period_month);

create index if not exists idx_prime_rh_alerts_period_status
on public.prime_rh_alerts(period_year, period_month, status);

create index if not exists idx_prime_rh_alerts_level
on public.prime_rh_alerts(severity_level);

drop trigger if exists trg_prime_rh_alerts_updated_at on public.prime_rh_alerts;
create trigger trg_prime_rh_alerts_updated_at
before update on public.prime_rh_alerts
for each row execute function public.prime_set_updated_at();

alter table public.prime_rh_alerts enable row level security;

drop policy if exists prime_rh_alerts_admin_select on public.prime_rh_alerts;
create policy prime_rh_alerts_admin_select
on public.prime_rh_alerts
for select to authenticated
using (public.prime_is_admin());

drop function if exists public.admin_prime_add_deduction(uuid, text, uuid, text, integer, integer, date, integer, text, text);

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
  p_comment text,
  p_immediate_red_alert boolean default false
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
    points_deducted, severity, comment, created_by, metadata
  )
  values (
    p_employee_id, v_category_id, p_period_year, p_period_month, p_incident_date,
    p_points_deducted, coalesce(nullif(p_severity, ''), 'medium'), p_comment, v_admin.id,
    jsonb_build_object('immediate_red_alert', coalesce(p_immediate_red_alert, false))
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_prime_generate_alerts(
  p_admin_id uuid,
  p_code text,
  p_year integer,
  p_month integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.utilisateurs;
  v_stat record;
  v_created integer := 0;
  v_updated integer := 0;
  v_row public.prime_rh_alerts;
  v_reason text;
  v_manual_red boolean;
begin
  select * into v_admin from public.colixo_assert_code_admin(p_admin_id, p_code);

  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Année invalide.';
  end if;

  if p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'Mois invalide.';
  end if;

  for v_stat in
    select
      d.employee_id,
      nullif(trim(concat_ws(' ', u.prenom, u.nom)), '') as employee_name,
      count(*) filter (where d.severity = 'serious')::integer as serious_deductions_count,
      coalesce(sum(d.points_deducted) filter (where d.severity = 'serious'), 0)::integer as serious_points_total,
      coalesce(sum(d.points_deducted), 0)::integer as total_points_deducted,
      bool_or(
        lower(coalesce(d.metadata->>'immediate_red_alert', d.metadata->>'rh_immediate_red_alert', 'false'))
        in ('true', '1', 'yes', 'oui')
      ) as has_manual_red
    from public.prime_point_deductions d
    join public.utilisateurs u on u.id = d.employee_id
    where d.period_year = p_year
      and d.period_month = p_month
      and d.voided_at is null
    group by d.employee_id, u.prenom, u.nom
  loop
    v_manual_red := coalesce(v_stat.has_manual_red, false);

    if v_manual_red then
      v_reason := 'Faute très grave marquée manuellement: alerte rouge immédiate. Direction requise.';
      insert into public.prime_rh_alerts (
        employee_id, period_year, period_month, alert_type, severity_level, trigger_reason,
        serious_deductions_count, serious_points_total, total_points_deducted
      )
      values (
        v_stat.employee_id, p_year, p_month, 'manual_red', 'red', v_reason,
        v_stat.serious_deductions_count, v_stat.serious_points_total, v_stat.total_points_deducted
      )
      on conflict on constraint prime_rh_alerts_unique_month_type do update
      set severity_level = excluded.severity_level,
          trigger_reason = excluded.trigger_reason,
          serious_deductions_count = excluded.serious_deductions_count,
          serious_points_total = excluded.serious_points_total,
          total_points_deducted = excluded.total_points_deducted,
          updated_at = now()
      returning * into v_row;

      if v_row.created_at = v_row.updated_at then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
    end if;

    if v_stat.serious_deductions_count >= 3 then
      v_reason := '3 incidents graves ou plus dans le même mois: alerte rouge et proposition de brouillon de lettre d’avertissement.';
      insert into public.prime_rh_alerts (
        employee_id, period_year, period_month, alert_type, severity_level, trigger_reason,
        serious_deductions_count, serious_points_total, total_points_deducted
      )
      values (
        v_stat.employee_id, p_year, p_month, 'serious_count_3', 'red', v_reason,
        v_stat.serious_deductions_count, v_stat.serious_points_total, v_stat.total_points_deducted
      )
      on conflict on constraint prime_rh_alerts_unique_month_type do update
      set severity_level = excluded.severity_level,
          trigger_reason = excluded.trigger_reason,
          serious_deductions_count = excluded.serious_deductions_count,
          serious_points_total = excluded.serious_points_total,
          total_points_deducted = excluded.total_points_deducted,
          updated_at = now()
      returning * into v_row;

      if v_row.created_at = v_row.updated_at then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
    elsif v_stat.serious_deductions_count >= 2 then
      v_reason := '2 incidents graves dans le même mois: alerte orange et recommandation d’entretien RH.';
      insert into public.prime_rh_alerts (
        employee_id, period_year, period_month, alert_type, severity_level, trigger_reason,
        serious_deductions_count, serious_points_total, total_points_deducted
      )
      values (
        v_stat.employee_id, p_year, p_month, 'serious_count_2', 'orange', v_reason,
        v_stat.serious_deductions_count, v_stat.serious_points_total, v_stat.total_points_deducted
      )
      on conflict on constraint prime_rh_alerts_unique_month_type do update
      set severity_level = excluded.severity_level,
          trigger_reason = excluded.trigger_reason,
          serious_deductions_count = excluded.serious_deductions_count,
          serious_points_total = excluded.serious_points_total,
          total_points_deducted = excluded.total_points_deducted,
          updated_at = now()
      returning * into v_row;

      if v_row.created_at = v_row.updated_at then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
    end if;

    if v_stat.serious_points_total >= 10 then
      v_reason := '10 points ou plus retirés en incidents graves sur le même mois: alerte orange.';
      insert into public.prime_rh_alerts (
        employee_id, period_year, period_month, alert_type, severity_level, trigger_reason,
        serious_deductions_count, serious_points_total, total_points_deducted
      )
      values (
        v_stat.employee_id, p_year, p_month, 'serious_points_10', 'orange', v_reason,
        v_stat.serious_deductions_count, v_stat.serious_points_total, v_stat.total_points_deducted
      )
      on conflict on constraint prime_rh_alerts_unique_month_type do update
      set severity_level = excluded.severity_level,
          trigger_reason = excluded.trigger_reason,
          serious_deductions_count = excluded.serious_deductions_count,
          serious_points_total = excluded.serious_points_total,
          total_points_deducted = excluded.total_points_deducted,
          updated_at = now()
      returning * into v_row;

      if v_row.created_at = v_row.updated_at then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
    end if;

    if v_stat.total_points_deducted >= 20 then
      v_reason := '20 points ou plus retirés toutes gravités confondues sur le même mois: suivi RH recommandé.';
      insert into public.prime_rh_alerts (
        employee_id, period_year, period_month, alert_type, severity_level, trigger_reason,
        serious_deductions_count, serious_points_total, total_points_deducted
      )
      values (
        v_stat.employee_id, p_year, p_month, 'total_points_20', 'follow_up', v_reason,
        v_stat.serious_deductions_count, v_stat.serious_points_total, v_stat.total_points_deducted
      )
      on conflict on constraint prime_rh_alerts_unique_month_type do update
      set severity_level = excluded.severity_level,
          trigger_reason = excluded.trigger_reason,
          serious_deductions_count = excluded.serious_deductions_count,
          serious_points_total = excluded.serious_points_total,
          total_points_deducted = excluded.total_points_deducted,
          updated_at = now()
      returning * into v_row;

      if v_row.created_at = v_row.updated_at then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
    end if;
  end loop;

  return jsonb_build_object(
    'created_or_matched', v_created,
    'updated', v_updated,
    'alerts', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.severity_level desc, a.created_at desc), '[]'::jsonb)
      from public.prime_rh_alerts a
      where a.period_year = p_year
        and a.period_month = p_month
    )
  );
end;
$$;

create or replace function public.admin_prime_prepare_warning_letter(
  p_admin_id uuid,
  p_code text,
  p_alert_id uuid
)
returns public.prime_rh_alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.utilisateurs;
  v_alert public.prime_rh_alerts;
  v_employee public.utilisateurs;
  v_incidents text;
  v_letter text;
begin
  select * into v_admin from public.colixo_assert_code_admin(p_admin_id, p_code);

  select * into v_alert
  from public.prime_rh_alerts
  where id = p_alert_id;

  if v_alert.id is null then
    raise exception 'Alerte RH introuvable.';
  end if;

  if v_alert.status = 'warning_sent' then
    raise exception 'Une lettre déjà remise ne peut pas être régénérée automatiquement.';
  end if;

  select * into v_employee
  from public.utilisateurs
  where id = v_alert.employee_id;

  select coalesce(
    string_agg(
      '- ' || to_char(d.incident_date, 'DD.MM.YYYY') || ' · ' || c.label || ' · '
      || d.points_deducted || ' point(s) retiré(s) · ' || d.comment,
      E'\n' order by d.incident_date, d.created_at
    ),
    '- Aucun incident grave détaillé trouvé pour ce mois. Vérifier le dossier avant toute décision.'
  )
    into v_incidents
  from public.prime_point_deductions d
  join public.prime_point_categories c on c.id = d.category_id
  where d.employee_id = v_alert.employee_id
    and d.period_year = v_alert.period_year
    and d.period_month = v_alert.period_month
    and d.severity = 'serious'
    and d.voided_at is null;

  v_letter := concat(
    'BROUILLON INTERNE - À VALIDER PAR LA DIRECTION AVANT REMISE À L’EMPLOYÉ', E'\n\n',
    'Objet: projet de lettre d’avertissement', E'\n\n',
    'Madame, Monsieur ', coalesce(nullif(trim(concat_ws(' ', v_employee.prenom, v_employee.nom)), ''), v_employee.email, ''), ',', E'\n\n',
    'Dans le cadre du suivi RH Colixo, plusieurs incidents graves ont été relevés durant la période ',
    lpad(v_alert.period_month::text, 2, '0'), '/', v_alert.period_year::text, '.', E'\n\n',
    'Incidents pris en compte:', E'\n', v_incidents, E'\n\n',
    'Ces éléments nécessitent un examen par la direction. Le présent texte est un brouillon et ne constitue pas une sanction automatique. ',
    'Toute décision finale, toute modification du texte et toute remise éventuelle à l’employé doivent être validées manuellement par la direction.', E'\n\n',
    'Décision direction: à compléter.', E'\n',
    'Date et signature: à compléter.'
  );

  update public.prime_rh_alerts
  set warning_letter_text = v_letter,
      warning_letter_created_at = now(),
      status = 'warning_draft',
      reviewed_by = v_admin.id,
      reviewed_at = now(),
      decision_note = coalesce(decision_note, 'Brouillon de lettre préparé, validation direction requise.')
  where id = p_alert_id
  returning * into v_alert;

  insert into public.prime_point_audit_logs (
    table_name, record_id, action, employee_id, actor_id, after_data, note
  )
  values (
    'prime_rh_alerts', v_alert.id, 'prepare_warning_letter', v_alert.employee_id, v_admin.id,
    to_jsonb(v_alert), 'Brouillon de lettre préparé sans envoi automatique.'
  );

  return v_alert;
end;
$$;

create or replace function public.admin_prime_update_alert_status(
  p_admin_id uuid,
  p_code text,
  p_alert_id uuid,
  p_status text,
  p_decision_note text
)
returns public.prime_rh_alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.utilisateurs;
  v_alert public.prime_rh_alerts;
begin
  select * into v_admin from public.colixo_assert_code_admin(p_admin_id, p_code);

  if p_status not in ('open','reviewed','interview_scheduled','warning_draft','warning_sent','closed_no_action') then
    raise exception 'Statut d’alerte RH invalide.';
  end if;

  select * into v_alert
  from public.prime_rh_alerts
  where id = p_alert_id;

  if v_alert.id is null then
    raise exception 'Alerte RH introuvable.';
  end if;

  if p_status = 'warning_sent' and nullif(trim(coalesce(v_alert.warning_letter_text, '')), '') is null then
    raise exception 'Préparez et validez un brouillon avant de passer l’alerte en warning_sent.';
  end if;

  update public.prime_rh_alerts
  set status = p_status,
      decision_note = nullif(trim(coalesce(p_decision_note, '')), ''),
      reviewed_by = v_admin.id,
      reviewed_at = now(),
      warning_letter_validated_by = case when p_status = 'warning_sent' then v_admin.id else warning_letter_validated_by end,
      warning_letter_validated_at = case when p_status = 'warning_sent' then now() else warning_letter_validated_at end
  where id = p_alert_id
  returning * into v_alert;

  insert into public.prime_point_audit_logs (
    table_name, record_id, action, employee_id, actor_id, after_data, note
  )
  values (
    'prime_rh_alerts', v_alert.id, 'update_alert_status', v_alert.employee_id, v_admin.id,
    to_jsonb(v_alert), coalesce(p_decision_note, p_status)
  );

  return v_alert;
end;
$$;

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
  v_alerts jsonb;
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

  select coalesce(jsonb_agg(to_jsonb(a) order by a.period_month desc, a.level_sort, a.created_at desc), '[]'::jsonb)
    into v_alerts
  from (
    select
      al.*,
      nullif(trim(concat_ws(' ', e.prenom, e.nom)), '') as employee_name,
      e.email as employee_email,
      nullif(trim(concat_ws(' ', r.prenom, r.nom)), '') as reviewed_by_name,
      nullif(trim(concat_ws(' ', w.prenom, w.nom)), '') as warning_letter_validated_by_name,
      case al.severity_level when 'red' then 1 when 'orange' then 2 else 3 end as level_sort
    from public.prime_rh_alerts al
    left join public.utilisateurs e on e.id = al.employee_id
    left join public.utilisateurs r on r.id = al.reviewed_by
    left join public.utilisateurs w on w.id = al.warning_letter_validated_by
    where al.period_year = p_year
  ) a;

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
       or exists (
         select 1 from public.prime_rh_alerts al
         where al.id = l.record_id and al.period_year = p_year
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
    'rh_alerts', v_alerts,
    'audit_logs', v_audit,
    'notice', 'Prime variable, non garantie, soumise à validation finale de la direction.'
  );
end;
$$;

revoke all on function public.admin_prime_add_deduction(uuid, text, uuid, text, integer, integer, date, integer, text, text, boolean) from public;
revoke all on function public.admin_prime_generate_alerts(uuid, text, integer, integer) from public;
revoke all on function public.admin_prime_prepare_warning_letter(uuid, text, uuid) from public;
revoke all on function public.admin_prime_update_alert_status(uuid, text, uuid, text, text) from public;
revoke all on function public.admin_prime_dashboard(uuid, text, integer) from public;

grant execute on function public.admin_prime_add_deduction(uuid, text, uuid, text, integer, integer, date, integer, text, text, boolean) to anon, authenticated;
grant execute on function public.admin_prime_generate_alerts(uuid, text, integer, integer) to anon, authenticated;
grant execute on function public.admin_prime_prepare_warning_letter(uuid, text, uuid) to anon, authenticated;
grant execute on function public.admin_prime_update_alert_status(uuid, text, uuid, text, text) to anon, authenticated;
grant execute on function public.admin_prime_dashboard(uuid, text, integer) to anon, authenticated;

grant select on public.prime_rh_alerts to authenticated;

notify pgrst, 'reload schema';

commit;
