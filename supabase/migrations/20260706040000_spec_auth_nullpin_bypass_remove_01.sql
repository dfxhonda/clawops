-- SPEC-AUTH-NULLPIN-BYPASS-REMOVE-01: repo-parity backfill (already live in production).
-- Old behavior: pin_hash IS NULL returned success:true (free-pass; 4 staff incl. 2 managers
-- could log in with any PIN). New behavior: NULL pin_hash always fails the PIN path.
CREATE OR REPLACE FUNCTION public.verify_staff_pin(p_staff_id text, p_pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_staff record;
BEGIN
  SELECT staff_id, name, role, operator_id, store_code, pin_hash, is_active
  INTO v_staff
  FROM public.staff
  WHERE staff_id = p_staff_id AND is_active = true;

  IF v_staff IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'スタッフが見つかりません');
  END IF;

  -- SPEC-AUTH-NULLPIN-BYPASS-REMOVE-01: PIN未設定は認証失敗(旧: NULLならフリーパス=重大な穴)
  -- pin_hashが無いスタッフはPIN経路でログインさせない。Google OAuth or 管理者PIN設定が前提。
  IF v_staff.pin_hash IS NULL THEN
    RETURN json_build_object('success', false, 'error', '暗証番号が違います');
  END IF;

  -- PIN照合
  IF v_staff.pin_hash = crypt(p_pin, v_staff.pin_hash) THEN
    RETURN json_build_object(
      'success', true,
      'staff_id', v_staff.staff_id,
      'name', v_staff.name,
      'role', v_staff.role,
      'operator_id', v_staff.operator_id,
      'store_code', v_staff.store_code
    );
  ELSE
    RETURN json_build_object('success', false, 'error', '暗証番号が違います');
  END IF;
END;
$function$;
