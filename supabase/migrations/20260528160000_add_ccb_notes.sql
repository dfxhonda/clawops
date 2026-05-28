-- J-COLLECTION-03: ブース行に備考欄を追加
alter table public.cash_collection_booths
  add column if not exists notes text;

comment on column public.cash_collection_booths.notes is
  'J-COLLECTION-03: ブース単位の備考(任意)。';
