-- SPEC-ANOMALY-METER-P1-COLLECTION-AUDIT-01 (migration 1/2)
-- Add alert_types row type_code='meter_anomaly' (label 単価乖離) for the
-- collection-time effective-unit-price divergence audit.
-- organization_id is READ from the existing machine_issue row (not hardcoded).
-- Idempotent via on conflict (type_code) — booth_alerts_type_code_fkey references
-- alert_types.type_code (unique), and AlertListPage embeds alert_types(label,
-- icon_emoji, color_hex), so the ticket renders with 単価乖離 automatically.
insert into alert_types (type_code, label, icon_emoji, color_hex, sort_order, is_active, organization_id)
select 'meter_anomaly', '単価乖離', '📉', '#fb923c', 50, true, at.organization_id
from alert_types at
where at.type_code = 'machine_issue'
on conflict (type_code) do nothing;
