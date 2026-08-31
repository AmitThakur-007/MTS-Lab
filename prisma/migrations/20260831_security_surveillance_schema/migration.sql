-- Security & Activity Surveillance schema alignment.
-- Applied to the production database on 2026-08-31 after verifying there are no orphaned device/access/session rows.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMPTZ;

ALTER TABLE "ApprovedDevice"
  ADD CONSTRAINT "ApprovedDevice_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "AccessRequest"
  ADD CONSTRAINT "AccessRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "ApprovedDevice"
  VALIDATE CONSTRAINT "ApprovedDevice_userId_fkey";

ALTER TABLE "AccessRequest"
  VALIDATE CONSTRAINT "AccessRequest_userId_fkey";

ALTER TABLE "Session"
  VALIDATE CONSTRAINT "Session_userId_fkey";
