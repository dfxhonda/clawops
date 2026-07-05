-- SPEC-ADMIN-FORECAST-CYCLE-S1B-DMA-WINDOW-FIX-01
-- Fixes: trailing zero-revenue days in DMA7 window past last reading,
-- zero-diff (restock/setting-only) readings wrongly used as interpolation anchors.
-- No table DDL. Only function bodies (2 with signature changes require DROP first).

drop function if exists _forecast_booth_summary(text, date, date);
drop function if exists fn_forecast_store_list();

-- ---------------------------------------------------------------------------
-- NEW: readings with zero-diff-vs-previous "restock/setting-only" visits
-- excluded as interpolation anchors. A reading's own first occurrence for a
-- slot is never excluded (no previous to compare against == real baseline).
-- ---------------------------------------------------------------------------
create or replace function _forecast_readings_filtered(p_booth_code text)
returns table(meter_col text, patrol_date date, val numeric)
language sql
stable
set search_path = public
as $$
  with active_slots as (
    select meter_col from _forecast_booth_slots(p_booth_code)
  ),
  raw as (
    select r.meter_col, r.patrol_date, r.val
    from _forecast_readings_unpivoted(p_booth_code) r
    join active_slots a on a.meter_col = r.meter_col
  ),
  with_diff as (
    select meter_col, patrol_date, val,
      case
        when row_number() over (partition by meter_col order by patrol_date) = 1 then false
        else (val = lag(val) over (partition by meter_col order by patrol_date))
      end as is_zero_diff
    from raw
  ),
  date_status as (
    select patrol_date, bool_and(is_zero_diff) as all_slots_zero
    from with_diff
    group by patrol_date
  )
  select r.meter_col, r.patrol_date, r.val
  from raw r
  join date_status d on d.patrol_date = r.patrol_date
  where not d.all_slots_zero
$$;

-- ---------------------------------------------------------------------------
-- MODIFIED: interpolation anchors now sourced from the filtered (nonzero-diff)
-- reading set instead of the raw unpivoted set. Baseline (<=cycle_start)
-- selection logic itself is unchanged.
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
    from _forecast_readings_filtered(p_booth_code)
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
-- NEW: per-slot DMA7, window ends at p_slot_as_of (the slot's own last real
-- reading, already clamped by the caller) -- never extends into held-flat days.
-- ---------------------------------------------------------------------------
create or replace function _forecast_slot_dma7(
  p_booth_code text, p_meter_col text, p_unit_price numeric,
  p_cycle_start date, p_slot_as_of date
) returns numeric
language sql
stable
set search_path = public
as $$
  with dw as (
    select gs::date as d
    from generate_series(greatest(p_cycle_start, p_slot_as_of - 7), p_slot_as_of, interval '1 day') gs
  ),
  dr as (
    select d, _forecast_slot_value_at(p_booth_code, p_meter_col, d) * p_unit_price as cum_yen
    from dw
  ),
  df as (
    select d, cum_yen - lag(cum_yen) over (order by d) as day_rev from dr
  )
  select avg(day_rev) from df where day_rev is not null
$$;

-- ---------------------------------------------------------------------------
-- MODIFIED: ctd_revenue clamps each slot's "current" endpoint to ITS OWN last
-- reading (least(p_as_of, own last_date)) -- unchanged behavior, just reusing
-- the same clamp for the dma7 window boundary so a booth read less recently
-- than its store's effective_last_day never gets phantom zero days either.
-- Adds last_reading_date output (max across this booth's slots).
-- ---------------------------------------------------------------------------
create or replace function _forecast_booth_summary(
  p_booth_code text, p_cycle_start date, p_as_of date
) returns table(ctd_revenue numeric, dma7_daily numeric, last_reading_date date)
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
      (select max(patrol_date) from _forecast_readings_filtered(p_booth_code)
        where meter_col = s.meter_col) as last_date,
      _forecast_slot_value_at(p_booth_code, s.meter_col, p_cycle_start) as base_val
    from slots s
  ),
  per_slot_cur as (
    select
      ps.meter_col, ps.unit_price, ps.base_val, ps.last_date,
      least(p_as_of, coalesce(ps.last_date, p_as_of)) as slot_as_of,
      _forecast_slot_value_at(p_booth_code, ps.meter_col, least(p_as_of, coalesce(ps.last_date, p_as_of))) as cur_val
    from per_slot ps
  )
  select
    sum((cur_val - base_val) * unit_price) filter (where base_val is not null and cur_val is not null),
    sum(_forecast_slot_dma7(p_booth_code, meter_col, unit_price, p_cycle_start, slot_as_of)),
    max(last_date)
  from per_slot_cur
$$;

-- ---------------------------------------------------------------------------
-- NEW: store-level effective_last_day = max patrol_date among nonzero-diff
-- readings across all non-changer booths of the store.
-- ---------------------------------------------------------------------------
create or replace function _forecast_store_effective_last_day(p_store_code text)
returns date
language sql
stable
set search_path = public
as $$
  select max(f.patrol_date)
  from booths b
  join machines m on m.machine_code = b.machine_code
  cross join lateral _forecast_readings_filtered(b.booth_code) f
  where b.store_code = p_store_code
    and m.type_id != 'changer'
$$;

-- ---------------------------------------------------------------------------
-- MODIFIED: adds last_reading_date column. ctd/dma7/projected_landing now
-- anchored at effective_last_day (not today). days_elapsed/days_remaining
-- unchanged (calendar truth vs today JST).
-- ---------------------------------------------------------------------------
create or replace function fn_forecast_store_list()
returns table(
  store_code text, cycle_start date, next_collection date,
  days_elapsed int, days_remaining int,
  ctd_revenue numeric, dma7_daily numeric, projected_landing numeric,
  booth_count int, origin_source text, last_reading_date date
)
security definer
stable
language sql
set search_path = public
as $$
  with today as (select (now() at time zone 'Asia/Tokyo')::date as d),
  cyc as (
    select st.store_code, fc.cycle_start, fc.next_collection, fc.origin_source,
      _forecast_store_effective_last_day(st.store_code) as effective_last_day
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
    left join lateral _forecast_booth_summary(
      eb.booth_code, c.cycle_start, coalesce(c.effective_last_day, (select d from today))
    ) bs on true
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
    case when ba.ctd_revenue is not null and c.next_collection is not null and c.effective_last_day is not null
      then ba.ctd_revenue + coalesce(ba.dma7_daily,0) * greatest(c.next_collection - c.effective_last_day, 0)
    end,
    coalesce(ba.booth_count, 0),
    c.origin_source,
    c.effective_last_day
  from cyc c
  left join booth_agg ba on ba.store_code = c.store_code
  order by c.store_code;
$$;

-- ---------------------------------------------------------------------------
-- MODIFIED: same effective_last_day anchoring; daily array actual portion
-- stops at effective_last_day (no flat tail), projected starts the day after.
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
  v_effective_last_day date;
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

  v_effective_last_day := _forecast_store_effective_last_day(p_store_code);

  select count(eb.booth_code), sum(bs.ctd_revenue), sum(bs.dma7_daily)
    into v_booth_count, v_ctd, v_dma7
  from (
    select b.booth_code from booths b join machines m on m.machine_code = b.machine_code
    where b.store_code = p_store_code and m.type_id != 'changer'
  ) eb
  left join lateral _forecast_booth_summary(
    eb.booth_code, v_cycle_start, coalesce(v_effective_last_day, v_today)
  ) bs on true;

  v_store_row := jsonb_build_object(
    'store_code', p_store_code,
    'cycle_start', v_cycle_start,
    'next_collection', v_next_collection,
    'days_elapsed', case when v_cycle_start is not null then v_today - v_cycle_start end,
    'days_remaining', case when v_next_collection is not null then v_next_collection - v_today end,
    'ctd_revenue', v_ctd,
    'dma7_daily', v_dma7,
    'projected_landing', case when v_ctd is not null and v_next_collection is not null and v_effective_last_day is not null
      then v_ctd + coalesce(v_dma7,0) * greatest(v_next_collection - v_effective_last_day, 0) end,
    'booth_count', coalesce(v_booth_count, 0),
    'origin_source', v_origin_source,
    'last_reading_date', v_effective_last_day
  );

  select coalesce(jsonb_agg(jsonb_build_object(
      'booth_code', eb.booth_code,
      'machine_code', eb.machine_code,
      'ctd_revenue', bs.ctd_revenue,
      'dma7_daily', bs.dma7_daily,
      'projected_landing', case when bs.ctd_revenue is not null and v_next_collection is not null and v_effective_last_day is not null
        then bs.ctd_revenue + coalesce(bs.dma7_daily,0) * greatest(v_next_collection - v_effective_last_day, 0) end
    )), '[]'::jsonb)
    into v_booths
  from (
    select b.booth_code, b.machine_code from booths b join machines m on m.machine_code = b.machine_code
    where b.store_code = p_store_code and m.type_id != 'changer'
  ) eb
  left join lateral _forecast_booth_summary(
    eb.booth_code, v_cycle_start, coalesce(v_effective_last_day, v_today)
  ) bs on true;

  if v_cycle_start is not null and v_effective_last_day is not null then
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
      from generate_series(v_cycle_start, v_effective_last_day, interval '1 day') gs
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

    select actual_cum into v_ctd from (
      select actual_cum from jsonb_to_recordset(v_actual) as x(d date, actual_cum numeric) order by d desc limit 1
    ) z;

    if v_next_collection is not null and v_next_collection > v_effective_last_day then
      with proj_days as (
        select gs::date as d, row_number() over (order by gs) as n
        from generate_series(v_effective_last_day + 1, v_next_collection, interval '1 day') gs
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
