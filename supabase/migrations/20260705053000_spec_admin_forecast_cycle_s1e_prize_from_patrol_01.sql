-- SPEC-ADMIN-FORECAST-CYCLE-S1E-PRIZE-FROM-PATROL-01
-- Detail RPC only: booths[].prize_name now resolves from the booth's latest
-- non-null patrol free-text (meter_readings.prize_name, order by patrol_date desc,
-- created_at desc), falling back to the existing prize_masters link via
-- current_prize_id. Output key unchanged (prize_name); UI untouched.
-- S1C perf structure untouched (booth_summary / booth_daily helpers unchanged);
-- only fn_forecast_store_detail replaced (fn_forecast_store_list NOT touched).
-- Rationale (verified 2026-07-05): current_prize_id is unmaintained/stale while
-- meter_readings.prize_name is 98% filled since 2026-06-16.

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
    -- S1D: horizon = next_collection - 1
    'projected_landing', case when v_ctd is not null and v_next_collection is not null and v_effective_last_day is not null
      then v_ctd + coalesce(v_dma7,0) * greatest((v_next_collection - 1) - v_effective_last_day, 0) end,
    'booth_count', coalesce(v_booth_count, 0),
    'origin_source', v_origin_source,
    'last_reading_date', v_effective_last_day
  );

  -- S1E: prize_name resolves patrol free-text first, master link as fallback.
  -- (S1D added model_name / booth_no / prize_name; existing keys unchanged.)
  select coalesce(jsonb_agg(jsonb_build_object(
      'booth_code', b.booth_code,
      'machine_code', b.machine_code,
      'model_name', mm.model_name,
      'booth_no', substring(b.booth_code from '[^-]+$'),
      'prize_name', coalesce(
        (select mr.prize_name from meter_readings mr
           where mr.booth_code = b.booth_code and mr.prize_name is not null
           order by mr.patrol_date desc, mr.created_at desc
           limit 1),
        pm.short_name, pm.prize_name),
      'ctd_revenue', bs.ctd_revenue,
      'dma7_daily', bs.dma7_daily,
      'projected_landing', case when bs.ctd_revenue is not null and v_next_collection is not null and v_effective_last_day is not null
        then bs.ctd_revenue + coalesce(bs.dma7_daily,0) * greatest((v_next_collection - 1) - v_effective_last_day, 0) end
    )), '[]'::jsonb)
    into v_booths
  from booths b
  join machines m on m.machine_code = b.machine_code and m.type_id != 'changer'
  left join machine_models mm on mm.model_id = m.model_id
  left join prize_masters pm on pm.prize_id = b.current_prize_id
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

    -- S1D: projected series ends at next_collection - 1 (collection day excluded)
    if v_next_collection is not null and (v_next_collection - 1) > v_effective_last_day then
      with proj_days as (
        select gs::date as d, row_number() over (order by gs) as n
        from generate_series(v_effective_last_day + 1, v_next_collection - 1, interval '1 day') gs
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
