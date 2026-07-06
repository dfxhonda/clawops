-- SPEC-LF1-IDEMPOTENT-SYNC-01 D4: DB backstop for patrol idempotency.
-- One patrol row per (booth_code, patrol_date, visit) so concurrent LF1 replays / manual
-- entries can't both insert. Partial + date-floored at 2026-07-08 to avoid the 53 legacy
-- duplicate groups (2025-04-30..2026-06-16, separate cleanup task). COALESCE(visit_index,1)
-- so NULL visit_index rows collapse to slot 1.
CREATE UNIQUE INDEX IF NOT EXISTS uq_meter_readings_patrol_day
  ON public.meter_readings (booth_code, patrol_date, COALESCE(visit_index, 1))
  WHERE entry_type = 'patrol' AND patrol_date >= DATE '2026-07-08';
