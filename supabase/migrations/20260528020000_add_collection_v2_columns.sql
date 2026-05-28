-- J-COLLECTION-02: 集金画面v2向けの列追加
-- - cash_collection_booths.advance_payment: ブース単位の立替額 (合計除外, 参考表示)
-- - cash_collections.prev_collection_date: 前回集金日 (選択時に prev_meter を取得)

alter table public.cash_collection_booths
  add column if not exists advance_payment numeric not null default 0;

alter table public.cash_collections
  add column if not exists prev_collection_date date;

comment on column public.cash_collection_booths.advance_payment is
  'J-COLLECTION-02: ブース単位の立替額。合計除外(参考表示)。';
comment on column public.cash_collections.prev_collection_date is
  'J-COLLECTION-02: 前回集金日。選択時はcash_collection_boothsからprev_meterを取得。';
