-- ==============================================================================
-- MTS LAB — SUPABASE DATABASE ROW LEVEL SECURITY (RLS) & REALTIME POLICIES
-- ==============================================================================

-- 1. Enable Row Level Security (RLS) on all 20 public application tables
ALTER TABLE public."Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Repair" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RepairLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TechnicianNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RepairTransferRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RepairPrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HomeSlide" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BatteryWarranty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BatteryWarrantyClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AttendanceAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RepairRelatedDamage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RepairRelatedDamageAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InventoryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InventoryTransaction" ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to guarantee clean idempotent application
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
  END LOOP;
END $$;

-- 3. Authenticated Staff Policies (Full CRUD Access for Authenticated Roles)
CREATE POLICY "Allow authenticated full access to Branch" ON public."Branch" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to User" ON public."User" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to Customer" ON public."Customer" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to Repair" ON public."Repair" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to RepairLog" ON public."RepairLog" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to TechnicianNote" ON public."TechnicianNote" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to Payment" ON public."Payment" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to AuditLog" ON public."AuditLog" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to Notification" ON public."Notification" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to RepairTransferRequest" ON public."RepairTransferRequest" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to RepairPrice" ON public."RepairPrice" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to HomeSlide" ON public."HomeSlide" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to BatteryWarranty" ON public."BatteryWarranty" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to BatteryWarrantyClaim" ON public."BatteryWarrantyClaim" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to Attendance" ON public."Attendance" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to AttendanceAuditLog" ON public."AttendanceAuditLog" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to RepairRelatedDamage" ON public."RepairRelatedDamage" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to RepairRelatedDamageAudit" ON public."RepairRelatedDamageAudit" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to InventoryItem" ON public."InventoryItem" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to InventoryTransaction" ON public."InventoryTransaction" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Anon / Public Portal Policies (Read-Only for Customer Services, Tracking, Warranties, Pricing)
CREATE POLICY "Allow anon read Branch" ON public."Branch" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read RepairPrice" ON public."RepairPrice" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read HomeSlide" ON public."HomeSlide" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read Repair for tracking" ON public."Repair" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read Customer for tracking" ON public."Customer" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read BatteryWarranty for tracking" ON public."BatteryWarranty" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read BatteryWarrantyClaim for tracking" ON public."BatteryWarrantyClaim" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read RepairLog for tracking" ON public."RepairLog" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read basic User profiles" ON public."User" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read InventoryItem" ON public."InventoryItem" FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read Notification" ON public."Notification" FOR SELECT TO anon USING (true);

-- 5. Realtime Publication Configuration (Replicates events across all active browsers)
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'Branch', 'User', 'Customer', 'Repair', 'RepairLog',
    'TechnicianNote', 'Payment', 'AuditLog', 'Notification',
    'RepairTransferRequest', 'RepairPrice', 'HomeSlide',
    'BatteryWarranty', 'BatteryWarrantyClaim', 'Attendance',
    'AttendanceAuditLog', 'RepairRelatedDamage',
    'RepairRelatedDamageAudit', 'InventoryItem', 'InventoryTransaction'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.' || quote_ident(tbl);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END LOOP;
END $$;
