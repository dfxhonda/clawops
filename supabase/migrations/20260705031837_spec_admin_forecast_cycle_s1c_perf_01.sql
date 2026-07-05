-- SPEC-ADMIN-FORECAST-CYCLE-S1C-PERF-01
-- Perf: forecast RPCs were 14.74s (fails app-role 8s statement_timeout).
-- Two causes fixed:
--  1) origin_guard: booth lateral ran for all 41 stores incl 36 origin-less;
--     skip booth computation when cycle_start is null (return null figures).
--  2) single_pass: _forecast_booth_summary re-invoked _forecast_readings_filtered
--     (full meter_readings scan) dozens of times per booth. Now materialize the
--     booth's filtered readings ONCE and derive base_val/cur_val/last_date/dma7
--     from that single pass; interpolation inlined against the materialized CTE.
-- Index on meter_readings(booth_code, patrol_date DESC) already exists
--   (idx_meter_readings_booth_date) -> no new index needed.
-- RPC signatures + output shapes unchanged. KOS01 regression values byte-identical.

-- ---------------------------------------------------------------------------
-- REWRITE: single-pass booth summary. Materialize _forecast_readings_filtered
-- once (fr), then interpolate value_at against fr for every target date
-- (base at cycle_start, cur at slot_as_of, and the dma7 window days) uniformly.
-- Arithmetic is identical to the prior per-slot helpers, so values are exact.
-- ---------------------------------------------------------------------------
create or replace function _forecast_booth_summary(
  p_booth_code text, p_cycle_start date, p_as_of date
) returns table(ctd_revenue numeric, dma7_daily numeric, last_reading_date date)
language sql
stable
set search_path = public
as $$
  with fr as materialized (
    select meter_col, patrol_date, val
    from _forecast_readings_filtered(p_booth_code)
  ),
  slots as (
    select meter_col, unit_price from _forecast_booth_slots(p_booth_code)
  ),
  slot_asof as (
    select s.meter_col, s.unit_price,
      (select max(f.patrol_date) from fr f where f.meter_col = s.meter_col) as last_date,
      least(
        p_as_of,
        coalesce((select max(f.patrol_date) from fr f where f.meter_col = s.meter_col), p_as_of)
      ) as slot_as_of
    from slots s
  ),
  -- every (meter_col, target_date, kind) to evaluate
  targets as (
    select meter_col, unit_price, slot_as_of, last_date, 'base'::text as kind, p_cycle_start as t
    from slot_asof
    union all
    select meter_col, unit_price, slot_as_of, last_date, 'cur', slot_as_of
    from slot_asof
    union all
    select sa.meter_col, sa.unit_price, sa.slot_as_of, sa.last_date, 'dma7', gs::date
    from slot_asof sa
    cross join lateral generate_series(greatest(p_cycle_start, sa.slot_as_of - 7), sa.slot_as_of, interval '1 day') gs
  ),
  -- interpolated value at each target against the materialized fr (single pass)
  evaluated as (
    select tg.meter_col, tg.unit_price, tg.slot_as_of, tg.last_date, tg.kind, tg.t, iv.v as value_at
    from targets tg
    cross join lateral (
      select case
        when s.bp is null then null
        when s.ap is null then s.bv
        when s.bp = tg.t then s.bv
        else s.bv + (tg.t - s.bp)::numeric / (s.ap - s.bp) * (s.av - s.bv)
      end as v
      from (
        select
          (select f.val         from fr f where f.meter_col = tg.meter_col and f.patrol_date <= tg.t order by f.patrol_date desc limit 1) as bv,
          (select f.patrol_date from fr f where f.meter_col = tg.meter_col and f.patrol_date <= tg.t order by f.patrol_date desc limit 1) as bp,
          (select f.val         from fr f where f.meter_col = tg.meter_col and f.patrol_date >  tg.t order by f.patrol_date asc  limit 1) as av,
          (select f.patrol_date from fr f where f.meter_col = tg.meter_col and f.patrol_date >  tg.t order by f.patrol_date asc  limit 1) as ap
      ) s
    ) iv
  ),
  base_cur as (
    select meter_col, unit_price, last_date,
      max(value_at) filter (where kind = 'base') as base_val,
      max(value_at) filter (where kind = 'cur')  as cur_val
    from evaluated
    group by meter_col, unit_price, last_date
  ),
  dma7_series as (
    select meter_col, t, value_at * unit_price as cum_yen
    from evaluated
    where kind = 'dma7'
  ),
  dma7_diff as (
    select meter_col, cum_yen - lag(cum_yen) over (partition by meter_col order by t) as day_rev
    from dma7_series
  ),
  dma7_slot as (
    select meter_col, avg(day_rev) as dma7
    from dma7_diff
    where day_rev is not null
    group by meter_col
  )
  select
    sum((bc.cur_val - bc.base_val) * bc.unit_price) filter (where bc.base_val is not null and bc.cur_val is not null),
    sum(ds.dma7),
    max(bc.last_date)
  from base_cur bc
  left join dma7_slot ds on ds.meter_col = bc.meter_col
$$;

-- ---------------------------------------------------------------------------
-- NEW: per-booth daily cumulative contribution for the detail trajectory.
-- Single materialized pass of fr; contrib(d) = sum over slots of
-- (coalesce(value_at(d),0) - coalesce(value_at(cycle_start),0)) * unit_price.
-- Store-level actual_cum(d) = sum of booth contribs (caller aggregates).
-- ---------------------------------------------------------------------------
create or replace function _forecast_booth_daily(
  p_booth_code text, p_cycle_start date, p_end date
) returns table(d date, contrib numeric)
language sql
stable
set search_path = public
as $$
  with fr as materialized (
    select meter_col, patrol_date, val
    from _forecast_readings_filtered(p_booth_code)
  ),
  slots as (
    select meter_col, unit_price from _forecast_booth_slots(p_booth_code)
  ),
  days as (
    select gs::date as dd
    from generate_series(p_cycle_start, greatest(p_end, p_cycle_start), interval '1 day') gs
  ),
  slot_day as (
    select s.meter_col, s.unit_price, d.dd
    from slots s cross join days d
  ),
  valued as (
    select sd.meter_col, sd.unit_price, sd.dd, iv.v as val_at
    from slot_day sd
    cross join lateral (
      select case
        when s.bp is null then null
        when s.ap is null then s.bv
        when s.bp = sd.dd then s.bv
        else s.bv + (sd.dd - s.bp)::numeric / (s.ap - s.bp) * (s.av - s.bv)
      end as v
      from (
        select
          (select f.val         from fr f where f.meter_col = sd.meter_col and f.patrol_date <= sd.dd order by f.patrol_date desc limit 1) as bv,
          (select f.patrol_date from fr f where f.meter_col = sd.meter_col and f.patrol_date <= sd.dd order by f.patrol_date desc limit 1) as bp,
          (select f.val         from fr f where f.meter_col = sd.meter_col and f.patrol_date >  sd.dd order by f.patrol_date asc  limit 1) as av,
          (select f.patrol_date from fr f where f.meter_col = sd.meter_col and f.patrol_date >  sd.dd order by f.patrol_date asc  limit 1) as ap
      ) s
    ) iv
  ),
  base as (
    select meter_col, val_at as base_val
    from valued
    where dd = p_cycle_start
  )
  select v.dd as d,
    sum((coalesce(v.val_at, 0) - coalesce(b.base_val, 0)) * v.unit_price) as contrib
  from valued v
  join base b on b.meter_col = v.meter_col
  group by v.dd
$$;

-- ---------------------------------------------------------------------------
-- REWRITE: fn_forecast_store_list. origin_guard (booth lateral only for
-- origin-bearing stores); booth_count computed cheaply for all stores;
-- effective_last_day derived from booth_summary (no separate scan). as_of=today
-- is equivalent to effective_last_day for slot clamping (today >= every
-- reading date), so no pre-pass needed. Output columns unchanged.
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
    select st.store_code, fc.cycle_start, fc.next_collection, fc.origin_source
    from stores st
    cross join lateral _forecast_store_cycle(st.store_code) fc
    where st.is_active = true
  ),
  booth_counts as (
    select b.store_code, count(*) as booth_count
    from booths b
    join machines m on m.machine_code = b.machine_code
    where m.type_id != 'changer'
    group by b.store_code
  ),
  booth_agg as (
    select
      c.store_code,
      sum(bs.ctd_revenue) as ctd_revenue,
      sum(bs.dma7_daily) as dma7_daily,
      max(bs.last_reading_date) as effective_last_day
    from cyc c
    join booths b on b.store_code = c.store_code
    join machines m on m.machine_code = b.machine_code and m.type_id != 'changer'
    cross join lateral _forecast_booth_summary(b.booth_code, c.cycle_start, (select d from today)) bs
    where c.cycle_start is not null
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
    case when ba.ctd_revenue is not null and c.next_collection is not null and ba.effective_last_day is not null
      then ba.ctd_revenue + coalesce(ba.dma7_daily,0) * greatest(c.next_collection - ba.effective_last_day, 0)
    end,
    coalesce(bc.booth_count, 0),
    c.origin_source,
    ba.effective_last_day
  from cyc c
  left join booth_counts bc on bc.store_code = c.store_code
  left join booth_agg ba on ba.store_code = c.store_code
  order by c.store_code;
$$;

-- ---------------------------------------------------------------------------
-- REWRITE: fn_forecast_store_detail. Same origin_guard; single-pass booth
-- summary (effective_last_day derived from it); daily via _forecast_booth_daily.
-- Output jsonb shape unchanged.
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

  select count(*) into v_booth_count
  from booths b
  join machines m on m.machine_code = b.machine_code
  where b.store_code = p_store_code and m.type_id != 'changer';

  -- ORIGIN GUARD: origin-less stores return null figures + empty booths/daily
  if v_cycle_start is null then
    v_store_row := jsonb_build_object(
      'store_code', p_store_code,
      'cycle_start', null,
      'next_collection', v_next_collection,
      'days_elapsed', null,
      'days_remaining', case when v_next_collection is not null then v_next_collection - v_today end,
      'ctd_revenue', null,
      'dma7_daily', null,
      'projected_landing', null,
      'booth_count', coalesce(v_booth_count, 0),
      'origin_source', v_origin_source,
      'last_reading_date', null
    );
    return jsonb_build_object('store', v_store_row, 'booths', '[]'::jsonb, 'daily', '[]'::jsonb);
  end if;

  -- origin-bearing: single-pass booth aggregate (as_of=today == effective_last_day for clamp)
  select sum(bs.ctd_revenue), sum(bs.dma7_daily), max(bs.last_reading_date)
    into v_ctd, v_dma7, v_effective_last_day
  from booths b
  join machines m on m.machine_code = b.machine_code and m.type_id != 'changer'
  cross join lateral _forecast_booth_summary(b.booth_code, v_cycle_start, v_today) bs
  where b.store_code = p_store_code;

  v_store_row := jsonb_build_object(
    'store_code', p_store_code,
    'cycle_start', v_cycle_start,
    'next_collection', v_next_collection,
    'days_elapsed', v_today - v_cycle_start,
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
      'booth_code', b.booth_code,
      'machine_code', b.machine_code,
      'ctd_revenue', bs.ctd_revenue,
      'dma7_daily', bs.dma7_daily,
      'projected_landing', case when bs.ctd_revenue is not null and v_next_collection is not null and v_effective_last_day is not null
        then bs.ctd_revenue + coalesce(bs.dma7_daily,0) * greatest(v_next_collection - v_effective_last_day, 0) end
    )), '[]'::jsonb)
    into v_booths
  from booths b
  join machines m on m.machine_code = b.machine_code and m.type_id != 'changer'
  cross join lateral _forecast_booth_summary(b.booth_code, v_cycle_start, v_today) bs
  where b.store_code = p_store_code;

  if v_effective_last_day is not null then
    with booth_daily as (
      select bd.d, sum(bd.contrib) as actual_cum
      from booths b
      join machines m on m.machine_code = b.machine_code and m.type_id != 'changer'
      cross join lateral _forecast_booth_daily(b.booth_code, v_cycle_start, v_effective_last_day) bd
      where b.store_code = p_store_code
      group by bd.d
    )
    select jsonb_agg(jsonb_build_object('d', d, 'actual_cum', actual_cum, 'projected_cum', null::numeric) order by d)
      into v_actual
    from booth_daily;

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

-- ---------------------------------------------------------------------------
-- Drop helpers made obsolete by the single-pass rewrite (internal only).
-- ---------------------------------------------------------------------------
drop function if exists _forecast_slot_value_at(text, text, date);
drop function if exists _forecast_slot_dma7(text, text, numeric, date, date);
drop function if exists _forecast_store_effective_last_day(text);
