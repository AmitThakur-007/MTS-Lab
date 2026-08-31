-- Secure server-side restore primitive for encrypted MTS Lab system backups.
-- The API passes only a decoded snapshot to this function through the service-role connection.
-- No anonymous/authenticated client is allowed to execute it.

CREATE OR REPLACE FUNCTION public.restore_system_backup(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  table_name text;
  rows_json jsonb;
  restored_tables text[] := ARRAY[]::text[];
  backup_tables constant text[] := ARRAY[
    'Branch','User','Customer','Product','InventoryCategory','InventoryItem','InventoryTransaction',
    'Repair','RepairLog','TechnicianNote','Payment','BatteryWarranty','BatteryWarrantyClaim',
    'Attendance','AttendanceAuditLog','AttendanceBroadcast','RepairRelatedDamage','RepairRelatedDamageAudit',
    'RepairTransferRequest','Notification','ApprovedDevice','AccessRequest','AuditLog','LoginActivity',
    'AppletShare','HomeSlide','RepairPriceFolder','RepairPrice'
  ];
  table_exists boolean;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid backup payload.' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(payload->'Branch') IS NULL AND jsonb_typeof(payload->'User') IS NULL THEN
    RAISE EXCEPTION 'Backup payload does not contain expected system tables.' USING ERRCODE = '22023';
  END IF;

  -- Restore is a full application-data replacement. PostgreSQL executes the function
  -- atomically, so a failure rolls the whole restore back rather than leaving a partial state.
  -- Delete children before parents to respect foreign-key constraints.
  FOREACH table_name IN ARRAY ARRAY_REVERSE(backup_tables)
  LOOP
    SELECT to_regclass(format('public.%I', table_name)) IS NOT NULL INTO table_exists;
    IF table_exists THEN
      EXECUTE format('DELETE FROM public.%I', table_name);
    END IF;
  END LOOP;

  -- Temporary authentication state is deliberately never restored. Clear it so a restored
  -- user/session relationship cannot leave stale sessions or one-time tokens active.
  FOREACH table_name IN ARRAY ARRAY['Session','OTPVerification','PasswordResetToken']
  LOOP
    SELECT to_regclass(format('public.%I', table_name)) IS NOT NULL INTO table_exists;
    IF table_exists THEN
      EXECUTE format('DELETE FROM public.%I', table_name);
    END IF;
  END LOOP;

  -- Insert parents before children. Each table is populated from its actual PostgreSQL
  -- composite row type, avoiding a hard-coded column list and preserving current schema order.
  FOREACH table_name IN ARRAY backup_tables
  LOOP
    rows_json := payload -> table_name;
    IF rows_json IS NULL OR jsonb_typeof(rows_json) <> 'array' OR jsonb_array_length(rows_json) = 0 THEN
      CONTINUE;
    END IF;

    SELECT to_regclass(format('public.%I', table_name)) IS NOT NULL INTO table_exists;
    IF NOT table_exists THEN
      RAISE EXCEPTION 'Backup contains table % but the current database does not have it.', table_name
        USING ERRCODE = '42P01';
    END IF;

    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1)',
      table_name,
      table_name
    ) USING rows_json;

    restored_tables := array_append(restored_tables, table_name);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'restoredTables', to_jsonb(restored_tables),
    'restoredAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_system_backup(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_system_backup(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.restore_system_backup(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.restore_system_backup(jsonb) TO service_role;
