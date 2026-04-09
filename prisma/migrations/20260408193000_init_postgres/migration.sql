CREATE TYPE "IngestRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "ingest_runs" (
  "id" BIGSERIAL PRIMARY KEY,
  "source_file" TEXT NOT NULL,
  "source_checksum" TEXT NOT NULL,
  "status" "IngestRunStatus" NOT NULL DEFAULT 'RUNNING',
  "raw_row_count" INTEGER NOT NULL DEFAULT 0,
  "curated_row_count" INTEGER NOT NULL DEFAULT 0,
  "exact_duplicate_count" INTEGER NOT NULL DEFAULT 0,
  "quarantined_date_count" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "error_message" TEXT,
  "metadata" JSONB
);

CREATE TABLE "area_aliases" (
  "source_area_name" TEXT PRIMARY KEY,
  "canonical_area" TEXT NOT NULL,
  "display_area" TEXT NOT NULL,
  "alias_source" TEXT NOT NULL DEFAULT 'seed',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "transactions_raw" (
  "id" BIGSERIAL PRIMARY KEY,
  "ingest_run_id" BIGINT NOT NULL REFERENCES "ingest_runs"("id") ON DELETE CASCADE,
  "source_row_number" INTEGER NOT NULL,
  "raw_row_hash" TEXT NOT NULL,
  "transaction_id" TEXT,
  "instance_date" TEXT,
  "trans_group_en" TEXT,
  "procedure_name_en" TEXT,
  "is_offplan" TEXT,
  "is_freehold" TEXT,
  "property_usage_en" TEXT,
  "area_name_en" TEXT,
  "property_type_en" TEXT,
  "property_sub_type_en" TEXT,
  "amount" TEXT,
  "procedure_area" TEXT,
  "meter_sale_price" TEXT,
  "rent_value" TEXT,
  "meter_rent_price" TEXT,
  "rooms_en" TEXT,
  "has_parking" TEXT,
  "nearest_metro_en" TEXT,
  "nearest_mall_en" TEXT,
  "nearest_landmark_en" TEXT,
  "num_buyers" TEXT,
  "num_sellers" TEXT,
  "master_project_en" TEXT,
  "project_name_en" TEXT,
  "building_name_en" TEXT,
  "source" TEXT,
  "parsed_instance_date" DATE,
  "is_invalid_date" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_exact_duplicate" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "transactions_raw_ingest_run_id_idx" ON "transactions_raw"("ingest_run_id");
CREATE INDEX "transactions_raw_raw_row_hash_idx" ON "transactions_raw"("raw_row_hash");
CREATE INDEX "transactions_raw_parsed_instance_date_idx" ON "transactions_raw"("parsed_instance_date");

CREATE TABLE "transactions_curated" (
  "id" BIGSERIAL PRIMARY KEY,
  "raw_id" BIGINT NOT NULL UNIQUE REFERENCES "transactions_raw"("id") ON DELETE CASCADE,
  "ingest_run_id" BIGINT NOT NULL REFERENCES "ingest_runs"("id") ON DELETE CASCADE,
  "transaction_id" TEXT,
  "instance_date" DATE NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "year_month" TEXT NOT NULL,
  "quarter" TEXT NOT NULL,
  "trans_group_en" TEXT NOT NULL,
  "procedure_name_en" TEXT NOT NULL,
  "is_offplan" TEXT NOT NULL,
  "is_freehold" TEXT NOT NULL,
  "property_usage_en" TEXT NOT NULL,
  "normalized_area" TEXT NOT NULL,
  "display_area" TEXT NOT NULL,
  "area_name_en" TEXT NOT NULL,
  "property_type_en" TEXT NOT NULL,
  "property_sub_type_en" TEXT NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL,
  "procedure_area" DECIMAL(18, 2) NOT NULL,
  "meter_sale_price" DECIMAL(18, 2) NOT NULL,
  "rent_value" DECIMAL(18, 2),
  "meter_rent_price" DECIMAL(18, 2),
  "rooms_en" TEXT NOT NULL,
  "has_parking" BOOLEAN NOT NULL,
  "nearest_metro_en" TEXT NOT NULL,
  "nearest_mall_en" TEXT NOT NULL,
  "nearest_landmark_en" TEXT NOT NULL,
  "num_buyers" INTEGER NOT NULL,
  "num_sellers" INTEGER NOT NULL,
  "master_project_en" TEXT NOT NULL,
  "project_name_en" TEXT NOT NULL,
  "building_name_en" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "raw_row_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "transactions_curated_instance_date_idx" ON "transactions_curated"("instance_date");
CREATE INDEX "transactions_curated_year_month_idx" ON "transactions_curated"("year_month");
CREATE INDEX "transactions_curated_trans_group_instance_date_idx" ON "transactions_curated"("trans_group_en", "instance_date");
CREATE INDEX "transactions_curated_normalized_area_instance_date_idx" ON "transactions_curated"("normalized_area", "instance_date");
CREATE INDEX "transactions_curated_property_type_instance_date_idx" ON "transactions_curated"("property_type_en", "instance_date");
CREATE INDEX "transactions_curated_is_offplan_instance_date_idx" ON "transactions_curated"("is_offplan", "instance_date");
CREATE INDEX "transactions_curated_rooms_instance_date_idx" ON "transactions_curated"("rooms_en", "instance_date");
CREATE INDEX "transactions_curated_project_instance_date_idx" ON "transactions_curated"("project_name_en", "instance_date");

CREATE OR REPLACE VIEW monthly_market_stats AS
SELECT
  year_month,
  MIN(year) AS year,
  MIN(month) AS month,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales') AS sales_count,
  COALESCE(SUM(amount) FILTER (WHERE trans_group_en = 'Sales'), 0) AS sales_volume,
  AVG(amount) FILTER (WHERE trans_group_en = 'Sales') AS sales_avg_price,
  AVG(meter_sale_price) FILTER (WHERE trans_group_en = 'Sales' AND meter_sale_price > 0) AS sales_avg_sqm_price,
  AVG(procedure_area) FILTER (WHERE trans_group_en = 'Sales' AND procedure_area > 0) AS sales_avg_area,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Off-Plan') AS offplan_sales_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Ready') AS ready_sales_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Mortgage') AS mortgage_count,
  COALESCE(SUM(amount) FILTER (WHERE trans_group_en = 'Mortgage'), 0) AS mortgage_volume,
  COUNT(*) FILTER (WHERE trans_group_en = 'Gifts') AS gift_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_usage_en = 'Residential') AS residential_sales,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_usage_en = 'Commercial') AS commercial_sales,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_type_en = 'Unit') AS unit_sales,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_type_en = 'Villa') AS villa_sales,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_type_en = 'Land') AS land_sales,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_type_en = 'Building') AS building_sales,
  CASE
    WHEN COUNT(*) FILTER (WHERE trans_group_en = 'Sales') > 0
      THEN COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Off-Plan')::numeric
        / COUNT(*) FILTER (WHERE trans_group_en = 'Sales')
    ELSE 0
  END AS offplan_ratio
FROM transactions_curated
GROUP BY year_month;

CREATE OR REPLACE VIEW area_monthly_market_stats AS
SELECT
  normalized_area,
  display_area,
  year_month,
  MIN(year) AS year,
  MIN(month) AS month,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales') AS sales_count,
  COALESCE(SUM(amount) FILTER (WHERE trans_group_en = 'Sales'), 0) AS sales_volume,
  AVG(amount) FILTER (WHERE trans_group_en = 'Sales') AS avg_price,
  AVG(meter_sale_price) FILTER (WHERE trans_group_en = 'Sales' AND meter_sale_price > 0) AS avg_sqm_price,
  AVG(procedure_area) FILTER (WHERE trans_group_en = 'Sales' AND procedure_area > 0) AS avg_area_sqm,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Off-Plan') AS offplan_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Ready') AS ready_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_type_en = 'Unit') AS unit_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_type_en = 'Villa') AS villa_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_type_en = 'Land') AS land_count,
  CASE
    WHEN COUNT(*) FILTER (WHERE trans_group_en = 'Sales') > 0
      THEN COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Off-Plan')::numeric
        / COUNT(*) FILTER (WHERE trans_group_en = 'Sales')
    ELSE 0
  END AS offplan_ratio
FROM transactions_curated
WHERE trans_group_en = 'Sales'
GROUP BY normalized_area, display_area, year_month;

CREATE OR REPLACE VIEW project_monthly_market_stats AS
SELECT
  project_name_en,
  master_project_en,
  normalized_area,
  display_area,
  year_month,
  MIN(year) AS year,
  MIN(month) AS month,
  COUNT(*) AS sales_count,
  COALESCE(SUM(amount), 0) AS sales_volume,
  AVG(amount) AS avg_price,
  AVG(meter_sale_price) FILTER (WHERE meter_sale_price > 0) AS avg_sqm_price,
  COUNT(*) FILTER (WHERE is_offplan = 'Off-Plan') AS offplan_count,
  CASE
    WHEN COUNT(*) > 0
      THEN COUNT(*) FILTER (WHERE is_offplan = 'Off-Plan')::numeric / COUNT(*)
    ELSE 0
  END AS offplan_ratio
FROM transactions_curated
WHERE trans_group_en = 'Sales' AND project_name_en <> ''
GROUP BY project_name_en, master_project_en, normalized_area, display_area, year_month;
