-- J-COLLECTION-09: 弊社担当者署名画像のStorage URL/パス
alter table public.cash_collections
  add column if not exists staff_signature_url text,
  add column if not exists staff_signature_path text;

comment on column public.cash_collections.staff_signature_url is
  'J-COLLECTION-09: 弊社担当者署名画像の公開URL (Storage receipts bucket)';
comment on column public.cash_collections.staff_signature_path is
  'J-COLLECTION-09: Storage上のパス {org_id}/{collection_id}/staff_sig.png';
