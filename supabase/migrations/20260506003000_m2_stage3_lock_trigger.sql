-- M2 棚卸し Stage 3: 修正不可ロックトリガー

-- prevent_stocktake_after_lock()
-- status='locked' のセッションに対する INSERT/UPDATE を拒否
CREATE OR REPLACE FUNCTION prevent_stocktake_after_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT status FROM stocktake_sessions WHERE session_id = NEW.session_id) = 'locked' THEN
    RAISE EXCEPTION 'stocktake_session is locked, modifications denied';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stocktake_lock_check ON stocktake_items;
CREATE TRIGGER stocktake_lock_check
  BEFORE INSERT OR UPDATE ON stocktake_items
  FOR EACH ROW EXECUTE FUNCTION prevent_stocktake_after_lock();
