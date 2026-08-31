-- Security & Activity Surveillance schema alignment.
-- The production database was verified to contain no orphaned device, access-request,
-- or session rows before these constraints were added.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApprovedDevice_userId_fkey'
  ) THEN
    ALTER TABLE "ApprovedDevice"
      ADD CONSTRAINT "ApprovedDevice_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccessRequest_userId_fkey'
  ) THEN
    ALTER TABLE "AccessRequest"
      ADD CONSTRAINT "AccessRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey'
  ) THEN
    ALTER TABLE "Session"
      ADD CONSTRAINT "Session_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

ALTER TABLE "ApprovedDevice"
  VALIDATE CONSTRAINT "ApprovedDevice_userId_fkey";

ALTER TABLE "AccessRequest"
  VALIDATE CONSTRAINT "AccessRequest_userId_fkey";

ALTER TABLE "Session"
  VALIDATE CONSTRAINT "Session_userId_fkey";
