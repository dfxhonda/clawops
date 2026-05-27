-- J-COLLECTION-01: 集金記録テーブル (cash_collections / cash_collection_booths)
-- 売上伝票PDF出力のための集金入力データ。total はGENERATED STORED (金種×単価合計)。

create table if not exists public.cash_collections (
  collection_id   text primary key,                       -- {store_code}-{YYYYMMDD}-{seq}
  store_code      text not null references public.stores(store_code),
  collected_by    text references public.staff(staff_id),
  collected_at    date not null,
  status          text not null default 'draft',          -- draft / confirmed
  notes           text,
  organization_id uuid not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  updated_by      text
);

create table if not exists public.cash_collection_booths (
  id              text primary key,                        -- {collection_id}-{booth_code}
  collection_id   text not null references public.cash_collections(collection_id),
  booth_code      text not null,
  machine_code    text not null,
  store_code      text not null,
  bill_10000      integer not null default 0,
  bill_5000       integer not null default 0,
  bill_1000       integer not null default 0,
  coin_500        integer not null default 0,
  coin_100        integer not null default 0,
  coin_50         integer not null default 0,
  total           numeric generated always as
                    (bill_10000*10000 + bill_5000*5000 + bill_1000*1000
                     + coin_500*500 + coin_100*100 + coin_50*50) stored,
  in_meter_prev     numeric,
  in_meter_current  numeric,
  out_meter_prev    numeric,
  out_meter_current numeric,
  created_at      timestamptz default now()
);

create index if not exists idx_ccb_collection on public.cash_collection_booths(collection_id);
create index if not exists idx_cc_store_date on public.cash_collections(store_code, collected_at desc);

-- RLS: authenticated に SELECT/INSERT/UPDATE 許可
alter table public.cash_collections enable row level security;
alter table public.cash_collection_booths enable row level security;

create policy "cc_select_auth"  on public.cash_collections      for select to authenticated using (true);
create policy "cc_insert_auth"  on public.cash_collections      for insert to authenticated with check (true);
create policy "cc_update_auth"  on public.cash_collections      for update to authenticated using (true) with check (true);

create policy "ccb_select_auth" on public.cash_collection_booths for select to authenticated using (true);
create policy "ccb_insert_auth" on public.cash_collection_booths for insert to authenticated with check (true);
create policy "ccb_update_auth" on public.cash_collection_booths for update to authenticated using (true) with check (true);
