-- J-STOCK-ARRIVAL-REFLECT-fix-01 (2026-05-27, ヒロ承認 / apply_migration 適用済)
-- 入荷確定 RPC fn_confirm_arrival が stock_movements に積む数量をケース→ピース換算に修正。
--   quantity = received_quantity(ケース) * case_quantity(入数/ケース)。case_quantity NULL は ×1。
-- 背景: prize_stocks.quantity は個数(ピース)管理だが、従来 RPC はケース数を積んでおり過少計上だった。
--      入荷→在庫反映は本 RPC の INSERT + trg_stock_movement_balance(fn_apply_stock_movement)で完結しており、
--      JS 側からの stock_movements 直書きは二重計上になるため行わない。
-- 変更箇所: stock_movements INSERT の quantity のみ。prize_orders 更新・検証ロジックは不変。
CREATE OR REPLACE FUNCTION public.fn_confirm_arrival(p_order_id text, p_to_owner_type text, p_to_owner_id text, p_received_quantity integer, p_staff_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_order        prize_orders%ROWTYPE;
  v_new_received integer;
BEGIN
  SELECT * INTO v_order FROM prize_orders WHERE order_id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR-STOCK-003: order not found: %', p_order_id;
  END IF;

  IF v_order.is_fully_received = true THEN
    RAISE EXCEPTION 'ERR-STOCK-004: order already fully received: %', p_order_id;
  END IF;

  IF p_received_quantity <= 0 THEN
    RAISE EXCEPTION 'ERR-STOCK-008: received_quantity must be positive: %', p_received_quantity;
  END IF;

  v_new_received := COALESCE(v_order.received_quantity, 0) + p_received_quantity;

  IF v_order.case_count IS NOT NULL AND v_new_received > v_order.case_count THEN
    RAISE EXCEPTION 'ERR-ARRIVAL-001: cumulative received % exceeds case_count %', v_new_received, v_order.case_count;
  END IF;

  UPDATE prize_orders SET
    status            = CASE
                          WHEN v_new_received >= COALESCE(v_order.case_count, v_new_received)
                          THEN 'arrived' ELSE 'partial'
                        END,
    arrived_at        = CASE
                          WHEN v_new_received >= COALESCE(v_order.case_count, v_new_received)
                          THEN now() ELSE arrived_at
                        END,
    received_by       = p_staff_id,
    received_quantity = v_new_received,
    is_fully_received = (v_new_received >= COALESCE(v_order.case_count, v_new_received)),
    updated_at        = now(),
    updated_by        = p_staff_id
  WHERE order_id = p_order_id;

  IF v_order.prize_id IS NOT NULL THEN
    INSERT INTO stock_movements (
      prize_id, movement_type, to_owner_type, to_owner_id, quantity, created_by, note
    ) VALUES (
      v_order.prize_id, 'in_arrival',
      p_to_owner_type, p_to_owner_id,
      p_received_quantity * COALESCE(v_order.case_quantity, 1), p_staff_id,
      'order:' || p_order_id
    );
  END IF;
END;
$function$;
