DROP VIEW IF EXISTS project_monthly_market_stats;
DROP VIEW IF EXISTS area_monthly_market_stats;
DROP VIEW IF EXISTS monthly_market_stats;
DROP VIEW IF EXISTS transactions_live;

ALTER TABLE "ingest_runs" RENAME COLUMN "raw_row_count" TO "inserted_row_count";
ALTER TABLE "ingest_runs" RENAME COLUMN "curated_row_count" TO "live_row_count";
ALTER TABLE "ingest_runs" RENAME COLUMN "quarantined_date_count" TO "invalid_date_count";
ALTER TABLE "ingest_runs" ADD COLUMN "source_format" TEXT;
ALTER TABLE "ingest_runs" ADD COLUMN "excluded_by_cutoff_count" INTEGER NOT NULL DEFAULT 0;

DROP TABLE IF EXISTS "transactions_curated";
DROP TABLE IF EXISTS "transactions_raw";

CREATE TABLE "transactions" (
  "id" BIGSERIAL PRIMARY KEY,
  "ingest_run_id" BIGINT NOT NULL REFERENCES "ingest_runs"("id") ON DELETE CASCADE,
  "source_file" TEXT NOT NULL,
  "source_format" TEXT NOT NULL,
  "source_file_date" DATE,
  "source_row_number" INTEGER NOT NULL,
  "source_row_hash" TEXT NOT NULL,
  "canonical_row_hash" TEXT NOT NULL,
  "transaction_id" TEXT,
  "instance_date" DATE,
  "year" INTEGER,
  "month" INTEGER,
  "year_month" TEXT,
  "quarter" TEXT,
  "trans_group_en" TEXT NOT NULL,
  "procedure_name_en" TEXT NOT NULL,
  "is_offplan" TEXT NOT NULL,
  "is_freehold" TEXT,
  "property_usage_en" TEXT NOT NULL,
  "normalized_area" TEXT NOT NULL,
  "display_area" TEXT NOT NULL,
  "area_name_en" TEXT NOT NULL,
  "property_type_en" TEXT NOT NULL,
  "property_sub_type_en" TEXT NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL,
  "procedure_area" DECIMAL(18, 2),
  "actual_area" DECIMAL(18, 2),
  "meter_sale_price" DECIMAL(18, 2),
  "rent_value" DECIMAL(18, 2),
  "meter_rent_price" DECIMAL(18, 2),
  "rooms_en" TEXT NOT NULL,
  "parking_count" INTEGER,
  "has_parking" BOOLEAN NOT NULL DEFAULT FALSE,
  "nearest_metro_en" TEXT NOT NULL,
  "nearest_mall_en" TEXT NOT NULL,
  "nearest_landmark_en" TEXT NOT NULL,
  "num_buyers" INTEGER NOT NULL,
  "num_sellers" INTEGER NOT NULL,
  "master_project_en" TEXT NOT NULL,
  "project_name_en" TEXT NOT NULL,
  "building_name_en" TEXT,
  "source" TEXT NOT NULL,
  "is_invalid_date" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_exact_duplicate" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_excluded_by_cutoff" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "transactions_ingest_run_id_idx" ON "transactions"("ingest_run_id");
CREATE INDEX "transactions_source_format_idx" ON "transactions"("source_format");
CREATE INDEX "transactions_source_row_hash_idx" ON "transactions"("source_row_hash");
CREATE INDEX "transactions_canonical_row_hash_idx" ON "transactions"("canonical_row_hash");
CREATE INDEX "transactions_instance_date_idx" ON "transactions"("instance_date");
CREATE INDEX "transactions_year_month_idx" ON "transactions"("year_month");
CREATE INDEX "transactions_trans_group_instance_date_idx" ON "transactions"("trans_group_en", "instance_date");
CREATE INDEX "transactions_normalized_area_instance_date_idx" ON "transactions"("normalized_area", "instance_date");
CREATE INDEX "transactions_property_type_instance_date_idx" ON "transactions"("property_type_en", "instance_date");
CREATE INDEX "transactions_is_offplan_instance_date_idx" ON "transactions"("is_offplan", "instance_date");
CREATE INDEX "transactions_rooms_instance_date_idx" ON "transactions"("rooms_en", "instance_date");
CREATE INDEX "transactions_project_instance_date_idx" ON "transactions"("project_name_en", "instance_date");
CREATE INDEX "transactions_live_flags_idx" ON "transactions"("is_invalid_date", "is_exact_duplicate", "is_excluded_by_cutoff");

CREATE OR REPLACE VIEW transactions_live AS
SELECT *
FROM transactions
WHERE is_invalid_date = FALSE
  AND is_exact_duplicate = FALSE
  AND is_excluded_by_cutoff = FALSE;

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
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY procedure_area) FILTER (WHERE trans_group_en = 'Sales' AND procedure_area > 0) AS sales_median_area,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Off-Plan') AS offplan_sales_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Ready') AS ready_sales_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Mortgage') AS mortgage_count,
  COALESCE(SUM(amount) FILTER (WHERE trans_group_en = 'Mortgage'), 0) AS mortgage_volume,
  COUNT(*) FILTER (WHERE trans_group_en = 'Gifts') AS gift_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_usage_en = 'Residential') AS residential_sales,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_usage_en = 'Commercial') AS commercial_sales,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND (CASE WHEN COALESCE(property_sub_type_en, '') ILIKE '%villa%' THEN 'Villa' ELSE property_type_en END) = 'Unit') AS unit_sales,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND (CASE WHEN COALESCE(property_sub_type_en, '') ILIKE '%villa%' THEN 'Villa' ELSE property_type_en END) = 'Villa') AS villa_sales,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_type_en = 'Land') AS land_sales,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND (CASE WHEN COALESCE(property_sub_type_en, '') ILIKE '%villa%' THEN 'Villa' ELSE property_type_en END) = 'Building') AS building_sales,
  CASE
    WHEN COUNT(*) FILTER (WHERE trans_group_en = 'Sales') > 0
      THEN COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Off-Plan')::numeric
        / COUNT(*) FILTER (WHERE trans_group_en = 'Sales')
    ELSE 0
  END AS offplan_ratio
FROM transactions_live
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
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND (CASE WHEN COALESCE(property_sub_type_en, '') ILIKE '%villa%' THEN 'Villa' ELSE property_type_en END) = 'Unit') AS unit_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND (CASE WHEN COALESCE(property_sub_type_en, '') ILIKE '%villa%' THEN 'Villa' ELSE property_type_en END) = 'Villa') AS villa_count,
  COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND property_type_en = 'Land') AS land_count,
  CASE
    WHEN COUNT(*) FILTER (WHERE trans_group_en = 'Sales') > 0
      THEN COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Off-Plan')::numeric
        / COUNT(*) FILTER (WHERE trans_group_en = 'Sales')
    ELSE 0
  END AS offplan_ratio
FROM transactions_live
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
FROM transactions_live
WHERE trans_group_en = 'Sales' AND project_name_en <> ''
GROUP BY project_name_en, master_project_en, normalized_area, display_area, year_month;
