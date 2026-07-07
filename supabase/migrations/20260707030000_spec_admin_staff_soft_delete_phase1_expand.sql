-- SPEC-ADMIN-STAFF-SOFT-DELETE-01 — migration_phase1_expand (Expand/Parallel-Change).
-- Purely additive: add deleted_at, gate admin RLS on deleted_at IS NULL, add an atomic
-- SECURITY DEFINER soft-delete RPC. **NO REVOKE here** — the DELETE/TRUNCATE/TRIGGER revoke
-- is phase2_contract, applied ONLY at the moment the frontend change is promoted to main
-- (bundled with that PROMOTE's explicit GO), to keep the shared-DB cross-branch window at zero.
-- Zero risk to main: every existing row has deleted_at NULL and main's raw-delete path is
-- untouched. develop only; do NOT promote to main until chat gate_3 + hiro GO.

-- 1. Additive tombstone column (nullable, default null). is_active untouched (INV4).
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL DEFAULT NULL;

-- 2. Hide soft-deleted staff from admin/manager management view. staff_admin_all is the ONLY
--    policy exposing is_active=false rows to admins, so gating it on deleted_at IS NULL makes
--    deleted rows vanish while retired (is_active=false, deleted_at NULL) rows stay visible/
--    editable. All existing rows have deleted_at NULL => no-op for current visibility (AC5/INV4).
ALTER POLICY staff_admin_all ON public.staff
  USING ((current_staff_role() = ANY (ARRAY['admin'::text, 'manager'::text])) AND deleted_at IS NULL)
  WITH CHECK ((current_staff_role() = ANY (ARRAY['admin'::text, 'manager'::text])) AND deleted_at IS NULL);

-- phase2_contract (NOT in this migration, applied at promote-time with explicit GO):
--   REVOKE DELETE, TRUNCATE, TRIGGER ON public.staff FROM anon, authenticated;

-- 3. Atomic soft-delete RPC. SECURITY DEFINER, role-gated by the same current_staff_role() RLS
--    already trusts (INV3). Idempotent (INV2). Preserves staff_stores cleanup and moves audit
--    inside the transaction (no client double-log).
CREATE OR REPLACE FUNCTION public.fn_admin_delete_staff(p_staff_id text, p_actor_staff_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role       text;
  v_before     public.staff%ROWTYPE;
  v_deleted_at timestamptz;
BEGIN
  -- INV3: only admin/manager, via the same source RLS trusts.
  v_role := current_staff_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'fn_admin_delete_staff: not authorized (role=%)', COALESCE(v_role, '(null)')
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before FROM public.staff WHERE staff_id = p_staff_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fn_admin_delete_staff: staff not found (%)', p_staff_id
      USING ERRCODE = 'P0002';
  END IF;

  -- INV2: idempotent no-op success if already soft-deleted (no second audit row).
  IF v_before.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'already_deleted', true,
      'staff_id', p_staff_id, 'deleted_at', v_before.deleted_at
    );
  END IF;

  UPDATE public.staff
     SET deleted_at = now(), is_active = false, updated_at = now(), updated_by = p_actor_staff_id
   WHERE staff_id = p_staff_id AND deleted_at IS NULL
   RETURNING deleted_at INTO v_deleted_at;

  -- Preserved behavior (was a separate client round-trip), now atomic with the soft-delete.
  DELETE FROM public.staff_stores WHERE staff_id = p_staff_id;

  -- Audit inside the same transaction; before_data captures the pre-delete row.
  INSERT INTO public.operation_logs
    (action, target_table, target_id, before_data, after_data, staff_id, organization_id)
  VALUES
    ('admin_delete_staff', 'staff', p_staff_id, to_jsonb(v_before), NULL,
     p_actor_staff_id, v_before.organization_id);

  RETURN jsonb_build_object(
    'success', true, 'already_deleted', false,
    'staff_id', p_staff_id, 'deleted_at', v_deleted_at
  );
END;
$$;

-- anon must NOT be able to invoke; only authenticated (role-check inside further restricts).
REVOKE ALL ON FUNCTION public.fn_admin_delete_staff(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_admin_delete_staff(text, text) TO authenticated;
