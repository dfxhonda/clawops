-- SPEC-S1G-DONKI-DEADLINE-ALERT-01 (D-047): donki_tenant 締日 (毎月20日 JST) アラート
--
-- fn_forecast_store_list に additive 2 列を追加:
--   store_type text   : stores.store_type をそのまま透過
--   s1g_status text   : 締日アラート状態 (下記導出表)
-- 既存 11 列 (store_code..last_reading_date) は名前/型/順序/式ともに byte-identical に維持。
--
-- RETURNS TABLE 列追加は返り値型変更のため CREATE OR REPLACE 不可 → DROP + CREATE。
-- DROP で失われる EXECUTE 権限を末尾で再付与 (anon/authenticated/service_role)。
--
-- s1g_status 導出 (全日付 JST = (now() at time zone 'Asia/Tokyo')::date, 当月20日基準):
--   null       -> store_type <> 'donki_tenant' OR last_reading_date IS NULL (休眠は無警告)
--   'done'     -> 当月 JST に cash_collections 実績あり
--   'overdue'  -> not done AND today > 当月20日
--   'planned'  -> not done AND today <= 20日 AND settings.next_collection_date <= 20日
--   'unplanned'-> not done AND today <= 20日 AND (settings.next_collection_date IS NULL OR > 20日)
--
-- 注: "next_collection" は business_rule + gate_1 に従い store_forecast_settings.next_collection_date
--     の生値で判定する。fn の next_collection 列は _forecast_next_collection_auto で coalesce され
--     計画未設定を自動補完してしまうため unplanned を隠蔽する。生の settings 値を使う。

DROP FUNCTION IF EXISTS public.fn_forecast_store_list();

CREATE FUNCTION public.fn_forecast_store_list()
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
      when c.store_type is distinct from 'donki_tenant' or ba.effective_last_day is null then null
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
