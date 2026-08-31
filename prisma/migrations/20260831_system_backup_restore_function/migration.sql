CREATE OR REPLACE FUNCTION public.restore_system_backup(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  table_name text;
  restore_order text[] := ARRAY[
    'Branch','User','Customer','Product','InventoryCategory','InventoryItem','Repair',
    'Payment','RepairLog','TechnicianNote','BatteryWarranty','BatteryWarrantyClaim',
    'InventoryTransaction','Attendance','AttendanceAuditLog','AttendanceBroadcast',
    'RepairRelatedDamage','RepairRelatedDamageAudit','RepairTransferRequest','Notification',
    'ApprovedDevice','AccessRequest','AuditLog','LoginActivity','AppletShare','HomeSlide',
    'RepairPriceFolder','RepairPrice'
  ];
  delete_order text[] := ARRAY[
    'Session','OTPVerification','PasswordResetToken','AuditLog','LoginActivity','AccessRequest',
    'ApprovedDevice','Notification','RepairTransferRequest','RepairPrice','RepairPriceFolder',
    'HomeSlide','RepairRelatedDamageAudit','RepairRelatedDamage','AttendanceBroadcast',
    'AttendanceAuditLog','Attendance','InventoryTransaction','BatteryWarrantyClaim',
    'BatteryWarranty','TechnicianNote','RepairLog','Payment','Repair','InventoryItem',
    'InventoryCategory','Product','Customer','User','Branch'
  ];
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid backup payload';
  END IF;

  FOREACH table_name IN ARRAY delete_order LOOP
    EXECUTE format('DELETE FROM public.%I', table_name);
  END LOOP;

  FOREACH table_name IN ARRAY restore_order LOOP
    IF payload ? table_name THEN
      EXECUTE format(
        'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1)',
        table_name,
        table_name
      ) USING payload -> table_name;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'restoredTables', to_jsonb(restore_order));
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_system_backup(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_system_backup(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.restore_system_backup(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.restore_system_backup(jsonb) TO service_role;
