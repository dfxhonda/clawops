-- J-COLLECTION-06: 先方タッチ署名済PDFのURL/パス+署名日時
alter table public.cash_collections
  add column if not exists signed_pdf_url text,
  add column if not exists signed_pdf_path text,
  add column if not exists customer_signed_at timestamptz;

comment on column public.cash_collections.signed_pdf_url is
  'J-COLLECTION-06: 先方署名済PDFの公開URL';
comment on column public.cash_collections.signed_pdf_path is
  'J-COLLECTION-06: Storage上のパス {org_id}/{collection_id}/signed.pdf';
comment on column public.cash_collections.customer_signed_at is
  'J-COLLECTION-06: 先方署名日時';
