-- SPEC-ADMIN-FORECAST-CYCLE-S1-DATA-01
-- store_forecast_settings table + fn_forecast_store_list / fn_forecast_store_detail

create table if not exists store_forecast_settings (
  store_code text primary key references stores(store_code) on delete cascade,
  cycle_start_date date null,
  next_collection_date date null,
  updated_at timestamptz not null default now(),
  updated_by text null
);

alter table store_forecast_settings enable row level security;

create policy anon_select on store_forecast_settings
  for select using (true);

create policy authenticated_select on store_forecast_settings
  for select using (true);

create policy admin_insert on store_forecast_settings
  for insert with check (current_staff_role() = any (array['admin','manager']));

create policy admin_update on store_forecast_settings
  for update using (current_staff_role() = any (array['admin','manager']));

-- ---------------------------------------------------------------------------
-- next_collection auto rule: +30 days, capped at 20th-of-month hard rule
-- ---------------------------------------------------------------------------
create or replace function _forecast_next_collection_auto(p_cycle_start date)
returns date
language sql
immutable
as $$
  select least(
    p_cycle_start + 30,
    case
      when extract(day from p_cycle_start) <= 20
        then (date_trunc('month', p_cycle_start) + interval '1 month')::date + 19
      else (date_trunc('month', p_cycle_start) + interval '2 month')::date + 19
    end
  )
$$;

-- ---------------------------------------------------------------------------
-- store cycle: cycle_start / next_collection / origin_source
-- ---------------------------------------------------------------------------
create or replace function _forecast_store_cycle(p_store_code text)
returns table(cycle_start date, next_collection date, origin_source text)
language sql
stable
set search_path = public
as $$
  with settings as (
    select cycle_start_date, next_collection_date
    from store_forecast_settings
    where store_code = p_store_code
  ),
  last_collection as (
    select max(collected_at) as d
    from cash_collections
    where store_code = p_store_code
  ),
  origin as (
    select
      coalesce((select d from last_collection), (select cycle_start_date from settings)) as cs,
      case
        when (select d from last_collection) is not null then 'collection'
        when (select cycle_start_date from settings) is not null then 'manual'
        else 'none'
      end as src
  )
  select
    o.cs as cycle_start,
    coalesce(
      (select next_collection_date from settings),
      case when o.cs is not null then _forecast_next_collection_auto(o.cs) end
    ) as next_collection,
    o.src as origin_source
  from origin o
$$;

-- ---------------------------------------------------------------------------
-- active revenue IN slots for a booth + resolved unit price
-- priority: booths.meter_overrides > machine_models.meter_layout > booths.play_price
-- ---------------------------------------------------------------------------
create or replace function _forecast_booth_slots(p_booth_code text)
returns table(meter_col text, unit_price numeric)
language sql
stable
set search_path = public
as $$
  with b as (
    select bo.booth_code, bo.meter_overrides, bo.play_price, mm.meter_layout
    from booths bo
    join machines m on m.machine_code = bo.machine_code
    left join machine_models mm on mm.model_id = m.model_id
    where bo.booth_code = p_booth_code
  )
  select
    case (rm->>'slot')
      when 'in_1' then 'in_meter'
      when 'in_2' then 'in_meter_2'
      when 'in_3' then 'in_meter_3'
      when 'in_4' then 'in_meter_4'
    end as meter_col,
    coalesce(
      (b.meter_overrides -> (rm->>'key') ->> 'unit_price')::numeric,
      (rm->>'unit_price')::numeric,
      b.play_price
    ) as unit_price
  from b, jsonb_array_elements(b.meter_layout->'meters') as rm
  where b.meter_layout is not null
    and rm->>'purpose' = 'revenue'
    and (rm->>'active')::boolean = true
    and (rm->>'slot') in ('in_1','in_2','in_3','in_4')

  union all

  select 'in_meter' as meter_col, b.play_price as unit_price
  from b
  where b.meter_layout is null
$$;

-- ---------------------------------------------------------------------------
-- unpivot meter_readings in_meter/in_meter_2/3/4 into (meter_col, patrol_date, val)
-- entry_type restricted to patrol/replace (real business meter events; excludes
-- config/carry_forward/ocr_test one-off/deprecated rows). late-entry safe:
-- same-date duplicates resolved by latest created_at (matches fetchBoothDiffMap
-- composite-sort convention).
-- ---------------------------------------------------------------------------
create or replace function _forecast_readings_unpivoted(p_booth_code text)
returns table(meter_col text, patrol_date date, val numeric)
language sql
stable
set search_path = public
as $$
  select distinct on (u.meter_col, mr.patrol_date)
    u.meter_col, mr.patrol_date, u.val
  from meter_readings mr
  cross join lateral (values
    ('in_meter', mr.in_meter),
    ('in_meter_2', mr.in_meter_2),
    ('in_meter_3', mr.in_meter_3),
    ('in_meter_4', mr.in_meter_4)
  ) as u(meter_col, val)
  where mr.booth_code = p_booth_code
    and mr.entry_type in ('patrol','replace')
    and u.val is not null
  order by u.meter_col, mr.patrol_date, mr.created_at desc
$$;

-- ---------------------------------------------------------------------------
-- interpolated/held-flat cumulative meter value for a slot at a specific date
-- ---------------------------------------------------------------------------
create or replace function _forecast_slot_value_at(
  p_booth_code text, p_meter_col text, p_target_date date
) returns numeric
language sql
stable
set search_path = public
as $$
  with readings as (
    select patrol_date, val
    from _forecast_readings_unpivoted(p_booth_code)
    where meter_col = p_meter_col
  ),
  before_r as (
    select patrol_date, val from readings
    where patrol_date <= p_target_date
    order by patrol_date desc limit 1
  ),
  after_r as (
    select patrol_date, val from readings
    where patrol_date > p_target_date
    order by patrol_date asc limit 1
  )
  select
    case
      when (select patrol_date from before_r) is null then null
      when (select patrol_date from after_r) is null then (select val from before_r)
      when (select patrol_date from before_r) = p_target_date then (select val from before_r)
      else (
        select b.val + (p_target_date - b.patrol_date)::numeric
                        / (a.patrol_date - b.patrol_date)
                        * (a.val - b.val)
        from before_r b, after_r a
      )
    end
$$;

-- ---------------------------------------------------------------------------
-- booth-level summary: ctd_revenue (exact, reading-to-reading), dma7_daily
-- ---------------------------------------------------------------------------
create or replace function _forecast_booth_summary(
  p_booth_code text, p_cycle_start date, p_as_of date
) returns table(ctd_revenue numeric, dma7_daily numeric)
language sql
stable
set search_path = public
as $$
  with slots as (
    select * from _forecast_booth_slots(p_booth_code)
  ),
  per_slot as (
    select
      s.meter_col, s.unit_price,
      (select max(patrol_date) from _forecast_readings_unpivoted(p_booth_code)
        where meter_col = s.meter_col) as last_date,
      _forecast_slot_value_at(p_booth_code, s.meter_col, p_cycle_start) as base_val
    from slots s
  ),
  per_slot_cur as (
    select
      ps.meter_col, ps.unit_price, ps.base_val,
      _forecast_slot_value_at(p_booth_code, ps.meter_col, least(p_as_of, coalesce(ps.last_date, p_as_of))) as cur_val
    from per_slot ps
  ),
  ctd as (
    select sum((cur_val - base_val) * unit_price) as total
    from per_slot_cur
    where base_val is not null and cur_val is not null
  ),
  daily_window as (
    select gs::date as d
    from generate_series(greatest(p_cycle_start, p_as_of - 7), p_as_of, interval '1 day') gs
  ),
  daily_rev as (
    select dw.d,
      sum(coalesce(_forecast_slot_value_at(p_booth_code, s.meter_col, dw.d), 0) * s.unit_price) as cum_yen
    from daily_window dw cross join slots s
    group by dw.d
  ),
  diffs as (
    select d, cum_yen - lag(cum_yen) over (order by d) as day_rev from daily_rev
  )
  select
    (select total from ctd),
    (select avg(day_rev) from diffs where day_rev is not null)
$$;

-- ---------------------------------------------------------------------------
-- fn_forecast_store_list: one row per active store
-- ---------------------------------------------------------------------------
create or replace function fn_forecast_store_list()
returns table(
  store_code text, cycle_start date, next_collection date,
  days_elapsed int, days_remaining int,
  ctd_revenue numeric, dma7_daily numeric, projected_landing numeric,
  booth_count int, origin_source text
)
security definer
stable
language sql
set search_path = public
as $$
  with today as (select (now() at time zone 'Asia/Tokyo')::date as d),
  cyc as (
    select st.store_code, fc.cycle_start, fc.next_collection, fc.origin_source
    from stores st
    cross join lateral _forecast_store_cycle(st.store_code) fc
    where st.is_active = true
  ),
  eligible_booths as (
    select b.booth_code, b.store_code
    from booths b
    join machines m on m.machine_code = b.machine_code
    where m.type_id != 'changer'
  ),
  booth_agg as (
    select
      c.store_code,
      count(eb.booth_code) as booth_count,
      sum(bs.ctd_revenue) as ctd_revenue,
      sum(bs.dma7_daily) as dma7_daily
    from cyc c
    left join eligible_booths eb on eb.store_code = c.store_code
    left join lateral _forecast_booth_summary(eb.booth_code, c.cycle_start, (select d from today)) bs on true
    group by c.store_code
  )
  select
    c.store_code,
    c.cycle_start,
    c.next_collection,
    case when c.cycle_start is not null then (select d from today) - c.cycle_start end,
    case when c.next_collection is not null then c.next_collection - (select d from today) end,
    ba.ctd_revenue,
    ba.dma7_daily,
    case when ba.ctd_revenue is not null and c.next_collection is not null
      then ba.ctd_revenue + coalesce(ba.dma7_daily,0) * greatest(c.next_collection - (select d from today), 0)
    end,
    coalesce(ba.booth_count, 0),
    c.origin_source
  from cyc c
  left join booth_agg ba on ba.store_code = c.store_code
  order by c.store_code;
$$;

-- ---------------------------------------------------------------------------
-- fn_forecast_store_detail: single store, per-booth breakdown + daily trajectory
-- ---------------------------------------------------------------------------
create or replace function fn_forecast_store_detail(p_store_code text)
returns jsonb
security definer
stable
language plpgsql
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_cycle_start date;
  v_next_collection date;
  v_origin_source text;
  v_ctd numeric;
  v_dma7 numeric;
  v_booth_count int;
  v_store_row jsonb;
  v_booths jsonb;
  v_daily jsonb;
  v_actual jsonb;
  v_proj jsonb;
begin
  select cycle_start, next_collection, origin_source
    into v_cycle_start, v_next_collection, v_origin_source
    from _forecast_store_cycle(p_store_code);

  select count(eb.booth_code), sum(bs.ctd_revenue), sum(bs.dma7_daily)
    into v_booth_count, v_ctd, v_dma7
  from (
    select b.booth_code from booths b join machines m on m.machine_code = b.machine_code
    where b.store_code = p_store_code and m.type_id != 'changer'
  ) eb
  left join lateral _forecast_booth_summary(eb.booth_code, v_cycle_start, v_today) bs on true;

  v_store_row := jsonb_build_object(
    'store_code', p_store_code,
    'cycle_start', v_cycle_start,
    'next_collection', v_next_collection,
    'days_elapsed', case when v_cycle_start is not null then v_today - v_cycle_start end,
    'days_remaining', case when v_next_collection is not null then v_next_collection - v_today end,
    'ctd_revenue', v_ctd,
    'dma7_daily', v_dma7,
    'projected_landing', case when v_ctd is not null and v_next_collection is not null
      then v_ctd + coalesce(v_dma7,0) * greatest(v_next_collection - v_today, 0) end,
    'booth_count', coalesce(v_booth_count, 0),
    'origin_source', v_origin_source
  );

  select coalesce(jsonb_agg(jsonb_build_object(
      'booth_code', eb.booth_code,
      'machine_code', eb.machine_code,
      'ctd_revenue', bs.ctd_revenue,
      'dma7_daily', bs.dma7_daily,
      'projected_landing', case when bs.ctd_revenue is not null and v_next_collection is not null
        then bs.ctd_revenue + coalesce(bs.dma7_daily,0) * greatest(v_next_collection - v_today, 0) end
    )), '[]'::jsonb)
    into v_booths
  from (
    select b.booth_code, b.machine_code from booths b join machines m on m.machine_code = b.machine_code
    where b.store_code = p_store_code and m.type_id != 'changer'
  ) eb
  left join lateral _forecast_booth_summary(eb.booth_code, v_cycle_start, v_today) bs on true;

  if v_cycle_start is not null then
    with eb as (
      select b.booth_code from booths b join machines m on m.machine_code = b.machine_code
      where b.store_code = p_store_code and m.type_id != 'changer'
    ),
    slots as (
      select eb.booth_code, s.meter_col, s.unit_price
      from eb cross join lateral _forecast_booth_slots(eb.booth_code) s
    ),
    days as (
      select gs::date as d
      from generate_series(v_cycle_start, greatest(v_today, v_cycle_start), interval '1 day') gs
    ),
    day_vals as (
      select d.d, sl.booth_code, sl.meter_col, sl.unit_price,
        _forecast_slot_value_at(sl.booth_code, sl.meter_col, d.d) as val,
        _forecast_slot_value_at(sl.booth_code, sl.meter_col, v_cycle_start) as base_val
      from days d cross join slots sl
    ),
    actual_series as (
      select d, sum(coalesce(val,0) * unit_price) - sum(coalesce(base_val,0) * unit_price) as actual_cum
      from day_vals
      group by d
    )
    select jsonb_agg(jsonb_build_object('d', d, 'actual_cum', actual_cum, 'projected_cum', null::numeric) order by d)
      into v_actual
    from actual_series;

    select actual_cum into v_ctd from (select actual_cum from jsonb_to_recordset(v_actual) as x(d date, actual_cum numeric) order by d desc limit 1) z;

    if v_next_collection is not null and v_next_collection > v_today then
      with proj_days as (
        select gs::date as d, row_number() over (order by gs) as n
        from generate_series(v_today + 1, v_next_collection, interval '1 day') gs
      )
      select jsonb_agg(jsonb_build_object('d', d, 'actual_cum', null::numeric,
              'projected_cum', v_ctd + coalesce(v_dma7,0) * n) order by d)
        into v_proj
      from proj_days;
    else
      v_proj := '[]'::jsonb;
    end if;

    v_daily := coalesce(v_actual, '[]'::jsonb) || coalesce(v_proj, '[]'::jsonb);
  else
    v_daily := '[]'::jsonb;
  end if;

  return jsonb_build_object('store', v_store_row, 'booths', v_booths, 'daily', v_daily);
end;
$$;
