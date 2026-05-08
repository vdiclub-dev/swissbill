-- Keep only one active rule per client/product pair.

with ranked as (
  select
    id,
    row_number() over (
      partition by client_id, produit_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.client_tariff_rules
  where is_active = true
    and produit_id is not null
)
update public.client_tariff_rules r
set is_active = false,
    updated_at = now()
from ranked x
where r.id = x.id
  and x.rn > 1;
