-- SPEC-SEC-STAFF-PINHASH-ANON-REVOKE-01
-- Close the pin/pin_hash exposure to the public anon key (and authenticated).
--
-- METHOD (updated after live verification, hiro GO 2026-07-06): anon + authenticated
-- hold TABLE-LEVEL select/insert/update/references on public.staff, so the
-- pin/pin_hash entries in role_column_grants are DERIVED from those table grants.
-- A column-level `revoke select (pin_hash)` is a proven no-op while the table grant
-- stands. The correct fix is to strip the table-level privileges and re-grant only on
-- the non-secret columns (all staff columns EXCEPT pin, pin_hash).
--
-- Prereq SPEC-SEC-PINHASH-ANON-PATH-CLEANUP-01 already removed the two anon paths that
-- touched pin_hash (Login.jsx select; admin PIN reset -> fn_admin_clear_pin definer), so
-- no app path reads/writes pin/pin_hash as anon or authenticated anymore.
-- PIN verification stays server-side (verify-pin Edge -> verify_staff_pin SECURITY DEFINER).
-- DELETE/TRIGGER/TRUNCATE table privileges and the anon_select_for_login RLS row predicate
-- are intentionally left untouched. pin/pin_hash columns are NOT dropped (separate cleanup).

revoke select, insert, update, references on public.staff from anon, authenticated;

-- column-level grants require a column list PER privilege
grant
  select (staff_id, name, email, phone, role, operator_id, store_code, has_vehicle_stock, is_active, joined_at, notes, created_at, updated_at, updated_by, organization_id, name_kana, has_pin),
  insert (staff_id, name, email, phone, role, operator_id, store_code, has_vehicle_stock, is_active, joined_at, notes, created_at, updated_at, updated_by, organization_id, name_kana, has_pin),
  update (staff_id, name, email, phone, role, operator_id, store_code, has_vehicle_stock, is_active, joined_at, notes, created_at, updated_at, updated_by, organization_id, name_kana, has_pin)
on public.staff
to anon, authenticated;
