create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_client_id uuid not null,
  referrer_user_id uuid not null,
  recommended_company_name text not null,
  recommended_contact_name text,
  recommended_contact_role text,
  recommended_email text,
  recommended_phone text,
  recommended_city text,
  recommended_canton text,
  recommended_sector text,
  estimated_daily_parcels integer,
  message text,
  consent_confirmed boolean default false,
  status text default 'submitted',
  referred_client_id uuid,
  referred_client_revenue_paid_chf numeric default 0,
  reward_amount_chf numeric default 100,
  reward_status text default 'not_eligible',
  reward_approved_at timestamptz,
  reward_used_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint referrals_status_check check (status in (
    'submitted','contacted','qualified','converted','reward_pending','reward_approved','reward_used','rejected'
  )),
  constraint referrals_reward_status_check check (reward_status in (
    'not_eligible','pending','approved','used','rejected'
  )),
  constraint referrals_consent_required check (consent_confirmed = true),
  constraint referrals_email_or_phone_check check (
    nullif(trim(coalesce(recommended_email, '')), '') is not null
    or nullif(trim(coalesce(recommended_phone, '')), '') is not null
  )
);

create table if not exists public.client_reward_credits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  referral_id uuid references public.referrals(id) on delete set null,
  credit_type text default 'referral',
  amount_chf numeric not null,
  status text default 'available',
  used_amount_chf numeric default 0,
  remaining_amount_chf numeric not null,
  applied_invoice_id uuid,
  created_at timestamptz default now(),
  used_at timestamptz,
  constraint client_reward_credits_status_check check (status in ('available','partially_used','used','cancelled')),
  constraint client_reward_credits_amount_check check (amount_chf >= 0 and used_amount_chf >= 0 and remaining_amount_chf >= 0)
);

create table if not exists public.referral_settings (
  id uuid primary key default gen_random_uuid(),
  reward_amount_chf numeric default 100,
  minimum_paid_revenue_chf numeric default 500,
  max_invoice_deduction_percent numeric default 50,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.referral_settings (reward_amount_chf, minimum_paid_revenue_chf, max_invoice_deduction_percent, is_active)
select 100, 500, 50, true
where not exists (select 1 from public.referral_settings);

create index if not exists idx_referrals_referrer_client on public.referrals(referrer_client_id);
create index if not exists idx_referrals_referrer_user on public.referrals(referrer_user_id);
create index if not exists idx_referrals_status on public.referrals(status);
create index if not exists idx_referrals_reward_status on public.referrals(reward_status);
create index if not exists idx_reward_credits_client on public.client_reward_credits(client_id);
create index if not exists idx_reward_credits_status on public.client_reward_credits(status);

create unique index if not exists uniq_referrals_client_email
  on public.referrals(referrer_client_id, lower(trim(recommended_email)))
  where recommended_email is not null and trim(recommended_email) <> '';

alter table public.referrals enable row level security;
alter table public.client_reward_credits enable row level security;
alter table public.referral_settings enable row level security;

grant select, insert on public.referrals to authenticated;
grant select on public.client_reward_credits to authenticated;
grant select on public.referral_settings to authenticated;
grant execute on function public.colixo_assert_code_admin(uuid, text) to anon, authenticated;

create or replace function public.colixo_current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.entreprise_id, u.id)
  from public.utilisateurs u
  where u.id = auth.uid()
    and coalesce(u.actif, true) = true
    and u.role in ('client', 'gestionnaire', 'comptable', 'sous_utilisateur')
  limit 1;
$$;

revoke all on function public.colixo_current_client_id() from public;
grant execute on function public.colixo_current_client_id() to anon, authenticated;

drop policy if exists referrals_client_select on public.referrals;
create policy referrals_client_select
on public.referrals for select to authenticated
using (
  referrer_client_id = public.colixo_current_client_id()
);

drop policy if exists referrals_client_insert on public.referrals;
create policy referrals_client_insert
on public.referrals for insert to authenticated
with check (
  referrer_user_id = auth.uid()
  and referrer_client_id = public.colixo_current_client_id()
  and status = 'submitted'
  and reward_status = 'not_eligible'
  and coalesce(referred_client_revenue_paid_chf, 0) = 0
);

drop policy if exists reward_credits_client_select on public.client_reward_credits;
create policy reward_credits_client_select
on public.client_reward_credits for select to authenticated
using (
  client_id = public.colixo_current_client_id()
);

drop policy if exists referral_settings_read on public.referral_settings;
create policy referral_settings_read
on public.referral_settings for select to authenticated
using (is_active = true);

create or replace function public.colixo_referral_client_scope_by_code(
  p_user_id uuid,
  p_code text
)
returns public.utilisateurs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.utilisateurs;
begin
  select *
    into v_profile
  from public.utilisateurs u
  where u.id = p_user_id
    and coalesce(u.actif, true) = true
    and u.role in ('client', 'gestionnaire', 'comptable', 'sous_utilisateur')
    and upper(trim(coalesce(p_code, ''))) in (
      upper(trim(coalesce(u.code_usr, ''))),
      upper(trim(coalesce(u.code, ''))),
      upper(trim(coalesce(u.code_acces, ''))),
      upper(trim(coalesce(u.code_connexion, '')))
    )
  limit 1;

  if v_profile.id is null then
    raise exception 'Session client code invalide ou expirée';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.colixo_referral_client_scope_by_code(uuid, text) from public;

create or replace function public.client_submit_referral_by_code(
  p_user_id uuid,
  p_code text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.utilisateurs;
  v_client_id uuid;
  v_referral_id uuid;
begin
  v_profile := public.colixo_referral_client_scope_by_code(p_user_id, p_code);
  v_client_id := coalesce(v_profile.entreprise_id, v_profile.id);

  insert into public.referrals (
    referrer_client_id,
    referrer_user_id,
    recommended_company_name,
    recommended_contact_name,
    recommended_contact_role,
    recommended_email,
    recommended_phone,
    recommended_city,
    recommended_canton,
    recommended_sector,
    estimated_daily_parcels,
    message,
    consent_confirmed
  ) values (
    v_client_id,
    v_profile.id,
    nullif(trim(p_payload->>'recommended_company_name'), ''),
    nullif(trim(p_payload->>'recommended_contact_name'), ''),
    nullif(trim(p_payload->>'recommended_contact_role'), ''),
    lower(nullif(trim(p_payload->>'recommended_email'), '')),
    nullif(trim(p_payload->>'recommended_phone'), ''),
    nullif(trim(p_payload->>'recommended_city'), ''),
    nullif(trim(p_payload->>'recommended_canton'), ''),
    nullif(trim(p_payload->>'recommended_sector'), ''),
    nullif(p_payload->>'estimated_daily_parcels', '')::integer,
    nullif(trim(p_payload->>'message'), ''),
    coalesce((p_payload->>'consent_confirmed')::boolean, false)
  )
  returning id into v_referral_id;

  return v_referral_id;
exception
  when unique_violation then
    raise exception 'Cette entreprise ou cet email a déjà été recommandé par votre compte.';
end;
$$;

create or replace function public.client_referral_dashboard_by_code(
  p_user_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.utilisateurs;
  v_client_id uuid;
  v_referrals jsonb;
  v_credits jsonb;
  v_settings jsonb;
begin
  v_profile := public.colixo_referral_client_scope_by_code(p_user_id, p_code);
  v_client_id := coalesce(v_profile.entreprise_id, v_profile.id);

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
    into v_referrals
  from public.referrals r
  where r.referrer_client_id = v_client_id;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb)
    into v_credits
  from public.client_reward_credits c
  where c.client_id = v_client_id;

  select to_jsonb(s)
    into v_settings
  from public.referral_settings s
  where s.is_active = true
  order by s.created_at desc
  limit 1;

  return jsonb_build_object(
    'client_id', v_client_id,
    'referrals', v_referrals,
    'credits', v_credits,
    'settings', coalesce(v_settings, '{}'::jsonb)
  );
end;
$$;

create or replace function public.admin_approve_referral_reward(
  p_admin_id uuid,
  p_code text,
  p_referral_id uuid,
  p_referred_client_id uuid default null,
  p_paid_revenue_chf numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals;
  v_settings public.referral_settings;
  v_credit_id uuid;
  v_paid numeric;
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  select * into v_ref from public.referrals where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'Recommandation introuvable';
  end if;

  select * into v_settings
  from public.referral_settings
  where is_active = true
  order by created_at desc
  limit 1;

  v_paid := coalesce(p_paid_revenue_chf, v_ref.referred_client_revenue_paid_chf, 0);
  if v_paid < coalesce(v_settings.minimum_paid_revenue_chf, 500) then
    raise exception 'Seuil de chiffre d’affaires payé non atteint';
  end if;

  update public.referrals
  set status = 'reward_approved',
      reward_status = 'approved',
      reward_amount_chf = coalesce(v_settings.reward_amount_chf, 100),
      referred_client_id = coalesce(p_referred_client_id, referred_client_id),
      referred_client_revenue_paid_chf = v_paid,
      reward_approved_at = coalesce(reward_approved_at, now()),
      updated_at = now()
  where id = p_referral_id
  returning * into v_ref;

  select id into v_credit_id
  from public.client_reward_credits
  where referral_id = p_referral_id
  limit 1;

  if v_credit_id is null then
    insert into public.client_reward_credits (
      client_id, referral_id, credit_type, amount_chf, status, used_amount_chf, remaining_amount_chf
    ) values (
      v_ref.referrer_client_id,
      v_ref.id,
      'referral',
      v_ref.reward_amount_chf,
      'available',
      0,
      v_ref.reward_amount_chf
    )
    returning id into v_credit_id;
  end if;

  return v_credit_id;
end;
$$;

create or replace function public.simulate_referral_credit_deduction(
  p_invoice_total numeric,
  p_available_credit numeric,
  p_max_percent numeric default 50
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'invoice_total_chf', greatest(coalesce(p_invoice_total, 0), 0),
    'available_credit_chf', greatest(coalesce(p_available_credit, 0), 0),
    'max_deduction_chf', round(greatest(coalesce(p_invoice_total, 0), 0) * greatest(coalesce(p_max_percent, 0), 0) / 100, 2),
    'credit_applied_chf', least(
      greatest(coalesce(p_available_credit, 0), 0),
      round(greatest(coalesce(p_invoice_total, 0), 0) * greatest(coalesce(p_max_percent, 0), 0) / 100, 2)
    ),
    'amount_to_pay_chf', greatest(coalesce(p_invoice_total, 0), 0) - least(
      greatest(coalesce(p_available_credit, 0), 0),
      round(greatest(coalesce(p_invoice_total, 0), 0) * greatest(coalesce(p_max_percent, 0), 0) / 100, 2)
    ),
    'remaining_credit_chf', greatest(coalesce(p_available_credit, 0), 0) - least(
      greatest(coalesce(p_available_credit, 0), 0),
      round(greatest(coalesce(p_invoice_total, 0), 0) * greatest(coalesce(p_max_percent, 0), 0) / 100, 2)
    )
  );
$$;

revoke all on function public.client_submit_referral_by_code(uuid, text, jsonb) from public;
revoke all on function public.client_referral_dashboard_by_code(uuid, text) from public;
revoke all on function public.admin_approve_referral_reward(uuid, text, uuid, uuid, numeric) from public;

grant execute on function public.client_submit_referral_by_code(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.client_referral_dashboard_by_code(uuid, text) to anon, authenticated;
grant execute on function public.admin_approve_referral_reward(uuid, text, uuid, uuid, numeric) to anon, authenticated;
grant execute on function public.simulate_referral_credit_deduction(numeric, numeric, numeric) to anon, authenticated;
