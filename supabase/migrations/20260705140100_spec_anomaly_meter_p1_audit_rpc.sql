-- SPEC-ANOMALY-METER-P1-COLLECTION-AUDIT-01 (migration 2/2)
-- fn_audit_collection_meters(p_collection_id): at collection completion, audit each
-- machine — counted cash (sum of cash_collection_booths.total) vs meter-implied
-- expected revenue (IN meter diff x resolved unit price). Machines whose divergence
-- exceeds threshold get a deterministic booth_alerts ticket (type_code meter_anomaly).
-- Server-side aggregation only (never client-side; 1000-row client limit rule).
-- advance_payment is kept OUT of the formula and surfaced in the note.
-- Idempotent: alert_id is deterministic, on conflict (alert_id) do nothing
-- (booth_alerts PK = alert_id, verified via information_schema).
create or replace function fn_audit_collection_meters(p_collection_id text)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  -- tune after 07-14 first run
  c_threshold  numeric := 0.15;
  c_min_amount numeric := 10000;
  v_org uuid;
  v_machines_checked int := 0;
  v_flagged int := 0;
  v_skipped int := 0;
begin
  select organization_id into v_org from cash_collections where collection_id = p_collection_id;
  if v_org is null then
    return jsonb_build_object('machines_checked', 0, 'flagged', 0, 'skipped_booths', 0);
  end if;

  with cb as (
    select
      cb.machine_code, cb.booth_code, cb.store_code, cb.total, cb.advance_payment,
      cb.in_meter_prev, cb.in_meter_current,
      -- METER-UNIT-PRICE-SSOT priority: booth override > model layout > booth > machine
      coalesce(
        (b.meter_overrides->>'unit_price')::numeric,
        (mm.meter_layout->>'unit_price')::numeric,
        b.play_price, m.play_price
      ) as unit_price,
      m.type_id
    from cash_collection_booths cb
    join machines m on m.machine_code = cb.machine_code
    left join booths b on b.booth_code = cb.booth_code
    left join machine_models mm on mm.model_id = m.model_id
    where cb.collection_id = p_collection_id
  ),
  pb as (
    select cb.*,
      case when in_meter_prev is not null and in_meter_current is not null
           then (in_meter_current - in_meter_prev) * unit_price end as booth_expected,
      case when in_meter_prev is null or in_meter_current is null then 1 else 0 end as skipped
    from cb
  ),
  -- machine-level aggregation absorbs shared meters / representative-booth cash entry.
  -- COLLECTION-EXCLUDE-CHANGER-01: changer machines excluded (null-safe, keeps null type_id).
  pm as (
    select
      machine_code,
      min(store_code) as store_code,
      min(booth_code) as booth_code,
      sum(total) as cash,
      sum(booth_expected) as expected,
      sum(skipped) as skipped_booths,
      sum(advance_payment) as adv
    from pb
    where type_id is distinct from 'changer'
    group by machine_code
  ),
  flagged as (
    select pm.*,
      abs(cash - coalesce(expected, 0)) / greatest(coalesce(expected, 0), cash, 1) as divergence
    from pm
  ),
  ins as (
    insert into booth_alerts (
      alert_id, booth_code, machine_code, store_code, type_code, note,
      created_by, created_at, resolved, organization_id
    )
    select
      'MA-' || p_collection_id || '-' || machine_code,
      booth_code, machine_code, store_code, 'meter_anomaly',
      '集金額 ¥' || to_char(round(cash), 'FM999,999,990')
        || ' / メーター期待値 ¥' || to_char(round(coalesce(expected, 0)), 'FM999,999,990')
        || ' / 乖離率 ' || to_char(round(divergence * 100, 1), 'FM990.0') || '%'
        || case when skipped_booths > 0 then ' / 未計測' || skipped_booths || 'ブース' else '' end
        || case when adv > 0 then ' / 前受金 ¥' || to_char(round(adv), 'FM999,999,990') else '' end
        || ' / ' || p_collection_id,
      'system', now(), false, v_org
    from flagged
    where divergence >= c_threshold and greatest(cash, coalesce(expected, 0)) >= c_min_amount
    on conflict (alert_id) do nothing
    returning 1
  )
  select
    (select count(*) from pm)::int,
    (select count(*) from ins)::int,
    (select coalesce(sum(skipped_booths), 0) from pm)::int
  into v_machines_checked, v_flagged, v_skipped;

  return jsonb_build_object(
    'machines_checked', v_machines_checked,
    'flagged', v_flagged,
    'skipped_booths', v_skipped
  );
end;
$$;
