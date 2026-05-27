-- J-COLLECTION-FLAG-01: 巡回データに集金済フラグを追加
-- マネサポ集金フラグ管理画面 (AdminCollectionFlagPage) がブース単位に UPDATE する。
-- 追加列は NOT NULL default false (既存行は false で初期化、追加的変更で破壊なし)。

alter table public.meter_readings
  add column if not exists is_collected boolean not null default false;

comment on column public.meter_readings.is_collected is
  'J-COLLECTION-FLAG-01: 集金済フラグ。マネサポ集金フラグ管理画面でブース単位にUPDATE。';
