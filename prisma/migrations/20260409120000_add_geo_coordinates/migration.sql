CREATE TABLE IF NOT EXISTS "geo_coordinates" (
  "id" SERIAL PRIMARY KEY,
  "entity_type" TEXT NOT NULL,
  "entity_name" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "bayut_id" INTEGER,
  "bayut_level" TEXT,
  "bayut_name" TEXT,
  "lat" DECIMAL(12, 8) NOT NULL,
  "lng" DECIMAL(12, 8) NOT NULL,
  "txn_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "geo_coordinates_entity_unique" ON "geo_coordinates"("entity_type", "entity_name");
