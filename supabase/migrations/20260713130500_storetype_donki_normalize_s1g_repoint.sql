-- SPEC-STORETYPE-DONKI-NORMALIZE-S1G-REPOINT-01 (D-051): store_type データ整合是正 + s1g_status 再ポイント
--
-- 背景: 'donki_tenant' が Donki 設置全 39 店に誤適用されていた。正しい値は 'donki' (毎月20日締め)。
-- 本番の S1G 締日アラート (fn_forecast_store_list.s1g_status) は 'donki_tenant' を対象にしているため、
-- データ是正と同一トランザクションでリテラルを 'donki' に再ポイントし、アラートに欠落/誤対象を作らない。
--
-- content_order (spec scope_write.M1):
--   1. guard  : donki_tenant 行数が 39 でなければ abort (想定外の分布で誤更新しない)
--   2. update : donki_tenant -> donki (external/other/null は不変)
--   3. fn     : fn_forecast_store_list を D-047 定義と byte-identical に維持し、s1g_status case の
--               単一リテラル 'donki_tenant' -> 'donki' のみ変更 (他ロジック不変)。返り値型不変のため
--               CREATE OR REPLACE 可 (DROP しないため既存 EXECUTE 権限は保持)。
--
-- 注: 本ファイルは authoring のみ。本番適用は hiro GO 後に chat Claude が apply_migration で実行する。

-- 1. guard: 想定 39 行
do $$ declare c int; begin
  select count(*) into c from stores where store_type = 'donki_tenant';
  if c <> 39 then raise exception 'expected 39 donki_tenant rows, found %', c; end if;
end $$;

-- 2. update: donki_tenant -> donki
UPDATE stores SET store_type = 'donki' WHERE store_type = 'donki_tenant';

-- 3. fn repoint: s1g_status case のリテラルのみ 'donki_tenant' -> 'donki'
CREATE OR REPLACE FUNCTION public.fn_forecast_store_list()
 RETURNS TABLE(store_code text, cycle_start date, next_collection date, days_elapsed integer, days_remaining integer, ctd_revenue numeric, dma7_daily numeric, projected_landing numeric, booth_count integer, origin_source text, last_reading_date date, store_type text, s1g_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with today as (select (now() at time zone 'Asia/Tokyo')::date as d),
  cyc as (
    select st.store_code, st.store_type, fc.cycle_start, fc.next_collection, fc.origin_source
    from stores st cross join lateral _forecast_store_cycle(st.store_code) fc where st.is_active = true
  ),
  booth_counts as (
    select b.store_code, count(*) as booth_count from booths b join machines m on m.machine_code = b.machine_code
    where m.type_id is distinct from 'changer' group by b.store_code
  ),
  booth_agg as (
    select c.store_code, sum(bs.ctd_revenue) as ctd_revenue, sum(bs.dma7_daily) as dma7_daily, max(bs.last_reading_date) as effective_last_day
    from cyc c join booths b on b.store_code = c.store_code
    join machines m on m.machine_code = b.machine_code and m.type_id is distinct from 'changer'
    cross join lateral _forecast_booth_summary(b.booth_code, c.cycle_start, (select d from today)) bs
    where c.cycle_start is not null group by c.store_code
  )
  select c.store_code, c.cycle_start, c.next_collection,
    case when c.cycle_start is not null then (select d from today) - c.cycle_start end,
    case when c.next_collection is not null then c.next_collection - (select d from today) end,
    ba.ctd_revenue, ba.dma7_daily,
    case when ba.ctd_revenue is not null and c.next_collection is not null and ba.effective_last_day is not null
      then ba.ctd_revenue + coalesce(ba.dma7_daily,0) * greatest((c.next_collection - 1) - ba.effective_last_day, 0) end,
    coalesce(bc.booth_count, 0), c.origin_source, ba.effective_last_day,
    c.store_type,
    case
      when c.store_type is distinct from 'donki' or ba.effective_last_day is null then null
      when exists (
        select 1 from cash_collections cc
        where cc.store_code = c.store_code
          and cc.collected_at >= date_trunc('month', (select d from today))::date
          and cc.collected_at < (date_trunc('month', (select d from today)) + interval '1 month')::date
      ) then 'done'
      when (select d from today) > (date_trunc('month', (select d from today))::date + 19) then 'overdue'
      when sfs.next_collection_date is not null
           and sfs.next_collection_date <= (date_trunc('month', (select d from today))::date + 19) then 'planned'
      else 'unplanned'
    end
  from cyc c
  left join booth_counts bc on bc.store_code = c.store_code
  left join booth_agg ba on ba.store_code = c.store_code
  left join store_forecast_settings sfs on sfs.store_code = c.store_code
  order by c.store_code;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_forecast_store_list() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
