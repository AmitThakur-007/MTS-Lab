CREATE TABLE IF NOT EXISTS "SystemBackup" (
  "id" TEXT PRIMARY KEY,
  "fileName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL UNIQUE,
  "sizeBytes" BIGINT NOT NULL DEFAULT 0,
  "checksum" TEXT NOT NULL,
  "createdById" TEXT,
  "createdByName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "SystemBackup_createdAt_idx" ON "SystemBackup" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "SystemBackup_status_idx" ON "SystemBackup" ("status");

ALTER TABLE "SystemBackup" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SystemBackup" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "SystemBackup" TO service_role;
