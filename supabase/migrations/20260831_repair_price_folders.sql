CREATE TABLE IF NOT EXISTS public."RepairPriceFolder" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "model" TEXT,
  "category" TEXT,
  "path" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  CONSTRAINT "RepairPriceFolder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RepairPriceFolder_path_key" ON public."RepairPriceFolder"("path");
CREATE INDEX IF NOT EXISTS "RepairPriceFolder_brand_level_idx" ON public."RepairPriceFolder"("brand", "level");
