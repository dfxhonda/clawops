-- J-PATROL-meter-layout-app: machine_models に meter_layout JSONB 列追加
-- Production apply: supabase db push (requires ヒロ approval)
-- Acceptance: machine_models.meter_layout に JSONB UPDATE 可能
ALTER TABLE machine_models ADD COLUMN IF NOT EXISTS meter_layout jsonb;
