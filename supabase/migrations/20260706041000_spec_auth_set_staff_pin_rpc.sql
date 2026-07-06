-- set_staff_pin: admin PIN provisioning RPC (repo-parity backfill, already live).
CREATE OR REPLACE FUNCTION public.set_staff_pin(p_staff_id text, p_pin text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  UPDATE public.staff
  SET pin_hash = crypt(p_pin, gen_salt('bf')),
      updated_at = now()
  WHERE staff_id = p_staff_id;
$function$;
