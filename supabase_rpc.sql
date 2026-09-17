-- ============================================================================
-- KEYFORGE PRO & SPOTMUSIC — FUNCIÓN DE VERIFICACIÓN Y REVOCACIÓN EN TIEMPO REAL
-- ============================================================================
-- Pega este script en el SQL Editor de tu proyecto en Supabase (https://supabase.com)
-- y pulsa "Run".
-- Permite a cualquier aplicación (SpotMusic Desktop, Apps Móviles Android/iOS,
-- Dashboards Web o Scripts Backend) verificar la validez y revocación de una
-- licencia en tiempo real con 0 latencia y total seguridad.

CREATE OR REPLACE FUNCTION public.check_license(p_token text, p_machine_id text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lic record;
  v_now bigint;
BEGIN
  v_now := (extract(epoch from now()) * 1000)::bigint;

  -- 1. Buscar la licencia en la base de datos por el token exacto
  SELECT id, project_id, app_name, token, machine_id, client_name, expires_at, status
  INTO v_lic
  FROM public.licenses
  WHERE token = trim(p_token)
  LIMIT 1;

  -- 2. Si no existe en la base de datos (fue eliminada por el administrador)
  IF NOT FOUND THEN
    RETURN json_build_object(
      'found', false,
      'valid', false,
      'status', 'not_found',
      'reason', 'NOT_FOUND',
      'message', 'Licencia no registrada o eliminada del servidor.'
    );
  END IF;

  -- 3. Si fue REVOCADA por el administrador (botón Revocar Licencia)
  IF v_lic.status = 'revoked' THEN
    RETURN json_build_object(
      'found', true,
      'valid', false,
      'status', 'revoked',
      'reason', 'REVOKED',
      'clientName', v_lic.client_name,
      'appName', v_lic.app_name,
      'message', 'Esta licencia ha sido REVOCADA por el administrador en KeyForge Pro.'
    );
  END IF;

  -- 4. Validar coincidencia de hardware / Machine ID si fue provisto
  IF p_machine_id IS NOT NULL AND v_lic.machine_id IS NOT NULL THEN
    IF UPPER(trim(v_lic.machine_id)) <> UPPER(trim(p_machine_id)) THEN
      RETURN json_build_object(
        'found', true,
        'valid', false,
        'status', 'hardware_mismatch',
        'reason', 'HARDWARE_MISMATCH',
        'message', 'Esta licencia no corresponde al hardware de este equipo.'
      );
    END IF;
  END IF;

  -- 5. Si ya EXPIRÓ por fecha/tiempo
  IF v_lic.expires_at <> -1 AND v_now > v_lic.expires_at THEN
    RETURN json_build_object(
      'found', true,
      'valid', false,
      'status', 'expired',
      'reason', 'EXPIRED',
      'clientName', v_lic.client_name,
      'expiresAt', v_lic.expires_at,
      'message', 'La vigencia de la licencia ha expirado.'
    );
  END IF;

  -- 6. Licencia 100% ACTIVA y VÁLIDA
  RETURN json_build_object(
    'found', true,
    'valid', true,
    'status', 'active',
    'reason', 'ACTIVE',
    'clientName', v_lic.client_name,
    'appName', v_lic.app_name,
    'expiresAt', v_lic.expires_at,
    'isPermanent', (v_lic.expires_at = -1),
    'message', 'Licencia activa y autorizada.'
  );
END;
$$;

-- Otorgar permiso de ejecución para llamadas anónimas públicas y autenticadas
GRANT EXECUTE ON FUNCTION public.check_license(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_license(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_license(text, text) TO service_role;
