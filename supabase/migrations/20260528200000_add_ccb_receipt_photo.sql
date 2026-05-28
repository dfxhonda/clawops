-- J-COLLECTION-05: ブース毎のレシート写真URL/パス
alter table public.cash_collection_booths
  add column if not exists receipt_photo_url text,
  add column if not exists receipt_photo_path text;

comment on column public.cash_collection_booths.receipt_photo_url is
  'J-COLLECTION-05: Storage receipts bucket の公開URL。PDF page2+で埋込。';
comment on column public.cash_collection_booths.receipt_photo_path is
  'J-COLLECTION-05: Storage上のパス {org_id}/{collection_id}/{booth_code}.jpg';
