begin;

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
  v_upserted integer := 0;
  v_closed integer := 0;
begin
  select * into v_admin from public.colixo_assert_code_admin(p_admin_id, p_code);

  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Année invalide.';
  end if;

  if p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'Mois invalide.';
  end if;

  drop table if exists pg_temp.prime_expected_alerts;

  create temporary table prime_expected_alerts on commit drop as
  with stats as (
    select
      d.employee_id,
      count(*) filter (where d.severity = 'serious')::integer as serious_deductions_count,
      coalesce(sum(d.points_deducted) filter (where d.severity = 'serious'), 0)::integer as serious_points_total,
      coalesce(sum(d.points_deducted), 0)::integer as total_points_deducted,
      bool_or(
        lower(coalesce(d.metadata->>'immediate_red_alert', d.metadata->>'rh_immediate_red_alert', 'false'))
        in ('true', '1', 'yes', 'oui')
      ) as has_manual_red
    from public.prime_point_deductions d
    where d.period_year = p_year
      and d.period_month = p_month
      and d.voided_at is null
    group by d.employee_id
  ),
  candidates as (
    select
      employee_id,
      'manual_red'::text as alert_type,
      'red'::text as severity_level,
      'Faute très grave marquée manuellement: alerte rouge immédiate. Direction requise.'::text as trigger_reason,
      serious_deductions_count,
      serious_points_total,
      total_points_deducted
    from stats
    where has_manual_red = true

    union all

    select
      employee_id,
      'serious_count_3',
      'red',
      '3 incidents graves ou plus dans le même mois: alerte rouge et proposition de brouillon de lettre d’avertissement.',
      serious_deductions_count,
      serious_points_total,
      total_points_deducted
    from stats
    where serious_deductions_count >= 3

    union all

    select
      employee_id,
      'serious_count_2',
      'orange',
      '2 incidents graves dans le même mois: alerte orange et recommandation d’entretien RH.',
      serious_deductions_count,
      serious_points_total,
      total_points_deducted
    from stats
    where serious_deductions_count = 2

    union all

    select
      employee_id,
      'serious_points_10',
      'orange',
      '10 points ou plus retirés en incidents graves sur le même mois: alerte orange.',
      serious_deductions_count,
      serious_points_total,
      total_points_deducted
    from stats
    where serious_points_total >= 10

    union all

    select
      employee_id,
      'total_points_20',
      'follow_up',
      '20 points ou plus retirés toutes gravités confondues sur le même mois: suivi RH recommandé.',
      serious_deductions_count,
      serious_points_total,
      total_points_deducted
    from stats
    where total_points_deducted >= 20
  )
  select *
  from candidates;

  insert into public.prime_rh_alerts (
    employee_id,
    period_year,
    period_month,
    alert_type,
    severity_level,
    trigger_reason,
    serious_deductions_count,
    serious_points_total,
    total_points_deducted
  )
  select
    employee_id,
    p_year,
    p_month,
    alert_type,
    severity_level,
    trigger_reason,
    serious_deductions_count,
    serious_points_total,
    total_points_deducted
  from pg_temp.prime_expected_alerts
  on conflict on constraint prime_rh_alerts_unique_month_type do update
  set severity_level = excluded.severity_level,
      trigger_reason = excluded.trigger_reason,
      serious_deductions_count = excluded.serious_deductions_count,
      serious_points_total = excluded.serious_points_total,
      total_points_deducted = excluded.total_points_deducted,
      status = case
        when prime_rh_alerts.status = 'closed_no_action' then 'open'
        else prime_rh_alerts.status
      end,
      reviewed_by = case
        when prime_rh_alerts.status = 'closed_no_action' then null
        else prime_rh_alerts.reviewed_by
      end,
      reviewed_at = case
        when prime_rh_alerts.status = 'closed_no_action' then null
        else prime_rh_alerts.reviewed_at
      end,
      decision_note = case
        when prime_rh_alerts.status = 'closed_no_action' then 'Alerte réouverte automatiquement: la règle RH est de nouveau remplie après recalcul.'
        else prime_rh_alerts.decision_note
      end,
      updated_at = now();

  get diagnostics v_upserted = row_count;

  with closed as (
    update public.prime_rh_alerts al
    set status = 'closed_no_action',
        reviewed_by = v_admin.id,
        reviewed_at = now(),
        decision_note = trim(both E'\n' from concat(
          coalesce(al.decision_note || E'\n', ''),
          'Alerte clôturée automatiquement: la règle RH n’est plus remplie après annulation ou recalcul des incidents.'
        )),
        updated_at = now()
    where al.period_year = p_year
      and al.period_month = p_month
      and al.status <> 'warning_sent'
      and not exists (
        select 1
        from pg_temp.prime_expected_alerts e
        where e.employee_id = al.employee_id
          and e.alert_type = al.alert_type
      )
    returning al.*
  )
  insert into public.prime_point_audit_logs (
    table_name,
    record_id,
    action,
    employee_id,
    actor_id,
    after_data,
    note
  )
  select
    'prime_rh_alerts',
    c.id,
    'auto_close_alert_after_recalc',
    c.employee_id,
    v_admin.id,
    to_jsonb(c),
    'Alerte RH clôturée automatiquement après annulation ou recalcul des incidents.'
  from closed c;

  get diagnostics v_closed = row_count;

  return jsonb_build_object(
    'upserted', v_upserted,
    'auto_closed', v_closed,
    'alerts', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.severity_level desc, a.created_at desc), '[]'::jsonb)
      from public.prime_rh_alerts a
      where a.period_year = p_year
        and a.period_month = p_month
    )
  );
end;
$$;

revoke all on function public.admin_prime_generate_alerts(uuid, text, integer, integer) from public;
grant execute on function public.admin_prime_generate_alerts(uuid, text, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
