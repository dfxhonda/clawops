-- SPEC-SEC-PINHASH-ANON-PATH-CLEANUP-01 (R2)
-- Move the admin "PIN reset" off the anon .update(pin_hash) path onto a
-- security-definer RPC, so it survives SPEC-SEC-STAFF-PINHASH-ANON-REVOKE-01
-- (which revokes anon/authenticated UPDATE on staff.pin_hash).
--
-- Authz: executable by anon+authenticated BUT internally gated on current_staff_role()
-- = 'admin' (same JWT app_metadata.role gate used by the store_forecast_settings /
-- dev_assets admin policies). A non-admin (or anon, which defaults to 'staff') is
-- rejected inside the function, so this does NOT re-open the hole from another door.
create or replace function fn_admin_clear_pin(p_staff_id text)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
begin
  if current_staff_role() <> 'admin' then
    raise exception 'forbidden: admin role required' using errcode = '42501';
  end if;

  update staff
    set pin_hash = null, pin = null, updated_at = now()
    where staff_id = p_staff_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'staff not found');
  end if;

  return jsonb_build_object('success', true, 'staff_id', p_staff_id);
end;
$$;

-- security definer runs as the function owner, so the internal UPDATE keeps working
-- after REVOKE-01 strips anon/authenticated UPDATE(pin_hash). Callers only need EXECUTE.
revoke all on function fn_admin_clear_pin(text) from public;
grant execute on function fn_admin_clear_pin(text) to anon, authenticated;
