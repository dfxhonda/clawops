-- 巡回スタッフが景品選択時に booths.current_prize_id を更新できる RPC
-- RLS の admin_update ポリシーを回避するため SECURITY DEFINER を使用
CREATE OR REPLACE FUNCTION update_booth_current_prize(
  p_booth_code  text,
  p_prize_id    text,
  p_updated_by  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE booths
  SET current_prize_id = p_prize_id,
      updated_at       = now(),
      updated_by       = p_updated_by
  WHERE booth_code = p_booth_code;
END;
$$;
