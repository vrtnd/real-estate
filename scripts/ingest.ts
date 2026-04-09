import "dotenv/config";

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import csvParser from "csv-parser";
import { Pool } from "pg";

import { prisma } from "../src/lib/db";
import { AREA_NAME_MAP, DISPLAY_NAME_MAP } from "../src/lib/constants";

const DATABASE_URL = process.env.DATABASE_URL!;
const MIN_VALID_DATE = "1975-01-01";
const LIVE_START_DATE = "2004-01-01";
const HISTORICAL_CUTOFF = "2026-01-01";
const INSERT_BATCH_SIZE = 1000;

type SourceFormat = "historical_dld_csv" | "current_year_dld_csv";
type RawCsvRow = Record<string, string>;

type CanonicalTransaction = {
  sourceFile: string;
  sourceFormat: SourceFormat;
  sourceFileDate: Date | null;
  sourceRowNumber: number;
  sourceRowHash: string;
  canonicalRowHash: string;
  transactionId: string | null;
  instanceDate: Date | null;
  year: number | null;
  month: number | null;
  yearMonth: string | null;
  quarter: string | null;
  transGroupEn: string;
  procedureNameEn: string;
  isOffplan: string;
  isFreehold: string | null;
  propertyUsageEn: string;
  normalizedArea: string;
  displayArea: string;
  areaNameEn: string;
  propertyTypeEn: string;
  propertySubTypeEn: string;
  amount: string;
  procedureArea: string | null;
  actualArea: string | null;
  meterSalePrice: string | null;
  rentValue: string | null;
  meterRentPrice: string | null;
  roomsEn: string;
  parkingCount: number | null;
  hasParking: boolean;
  nearestMetroEn: string;
  nearestMallEn: string;
  nearestLandmarkEn: string;
  numBuyers: number;
  numSellers: number;
  masterProjectEn: string;
  projectNameEn: string;
  buildingNameEn: string | null;
  source: "historical" | "current_year";
  isInvalidDate: boolean;
  isExactDuplicate: boolean;
  isExcludedByCutoff: boolean;
};

const TRANSACTION_COLUMNS = [
  "ingest_run_id",
  "source_file",
  "source_format",
  "source_file_date",
  "source_row_number",
  "source_row_hash",
  "canonical_row_hash",
  "transaction_id",
  "instance_date",
  "year",
  "month",
  "year_month",
  "quarter",
  "trans_group_en",
  "procedure_name_en",
  "is_offplan",
  "is_freehold",
  "property_usage_en",
  "normalized_area",
  "display_area",
  "area_name_en",
  "property_type_en",
  "property_sub_type_en",
  "amount",
  "procedure_area",
  "actual_area",
  "meter_sale_price",
  "rent_value",
  "meter_rent_price",
  "rooms_en",
  "parking_count",
  "has_parking",
  "nearest_metro_en",
  "nearest_mall_en",
  "nearest_landmark_en",
  "num_buyers",
  "num_sellers",
  "master_project_en",
  "project_name_en",
  "building_name_en",
  "source",
  "is_invalid_date",
  "is_exact_duplicate",
  "is_excluded_by_cutoff",
] as const;

function normalizeText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

function normalizeRooms(value: string | undefined): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (normalized.toUpperCase() === "NA") return "";
  return normalized;
}

function normalizePropertyType(
  propertyType: string | null,
  propertySubType: string | null
): string {
  if (propertySubType?.toLowerCase().includes("villa")) {
    return "Villa";
  }

  return propertyType ?? "";
}

function normalizeAmount(value: string | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed.toString() : null;
}

function normalizeInteger(value: string | undefined): number | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized.replace(/,/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function derivePerSqm(amount: string | null, area: string | null): string | null {
  if (!amount || !area) return null;
  const amountNum = Number(amount);
  const areaNum = Number(area);
  if (!Number.isFinite(amountNum) || !Number.isFinite(areaNum) || areaNum <= 0) return null;
  return (amountNum / areaNum).toString();
}

function parseHistoricalDate(value: string | undefined): Date | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  return parseIsoDate(iso);
}

function parseCurrentYearDate(value: string | undefined): Date | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return parseIsoDate(normalized.slice(0, 10));
}

function parseIsoDate(value: string | undefined): Date | null {
  const normalized = normalizeText(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  if (normalized < MIN_VALID_DATE) return null;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatYearMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function formatQuarter(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const quarter = month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";
  return `${year}-${quarter}`;
}

function formatDateOnly(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function isBeforeLiveStart(date: Date | null): boolean {
  return date ? formatDateOnly(date) < LIVE_START_DATE : false;
}

function normalizeGroup(value: string | undefined): string {
  const normalized = normalizeText(value) ?? "";
  if (normalized === "Mortgages") return "Mortgage";
  return normalized;
}

function normalizeOffplanHistorical(value: string | undefined): string {
  const normalized = normalizeText(value) ?? "";
  if (normalized === "Existing Properties") return "Ready";
  if (normalized === "Off-Plan Properties") return "Off-Plan";
  return normalized;
}

function normalizeOffplanCurrent(value: string | undefined): string {
  return normalizeText(value) ?? "";
}

function normalizeFreehold(value: string | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const upper = normalized.toUpperCase().replace(/\s+/g, " ").trim();
  if (upper === "FREE HOLD" || upper === "FREEHOLD") return "Freehold";
  if (upper.includes("NON") && upper.includes("FREE")) return "Non-Freehold";
  return normalized;
}

function normalizeParkingCount(value: string | undefined): number | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

function deriveHasParking(value: string | undefined): boolean {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) {
    return parsed > 0;
  }
  return true;
}

function buildAliasMap(): Map<string, { canonical: string; display: string }> {
  const aliasMap = new Map<string, { canonical: string; display: string }>();

  for (const [source, canonical] of Object.entries(AREA_NAME_MAP)) {
    aliasMap.set(source.trim().toUpperCase(), {
      canonical,
      display: DISPLAY_NAME_MAP[canonical] || canonical,
    });
  }

  for (const [canonical, display] of Object.entries(DISPLAY_NAME_MAP)) {
    aliasMap.set(canonical.trim().toUpperCase(), { canonical, display });
  }

  return aliasMap;
}

function resolveAreaNames(
  areaName: string | null,
  aliasMap: Map<string, { canonical: string; display: string }>
): { areaNameEn: string; normalizedArea: string; displayArea: string } {
  const areaNameEn = areaName ?? "";
  const alias = aliasMap.get(areaNameEn.trim().toUpperCase());
  return {
    areaNameEn,
    normalizedArea: alias?.canonical || areaNameEn || "Unknown",
    displayArea: alias?.display || areaNameEn || "Unknown",
  };
}

function buildHash(parts: Array<string | number | boolean | null | undefined>): string {
  const payload = parts.map((part) => (part == null ? "" : String(part))).join("\x1f");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function buildSourceRowHash(sourceFormat: SourceFormat, headers: string[], row: RawCsvRow): string {
  return buildHash([sourceFormat, ...headers.map((header) => normalizeText(row[header]) ?? "")]);
}

function buildCanonicalRowHash(
  row: Omit<
    CanonicalTransaction,
    "canonicalRowHash" | "sourceRowHash" | "sourceFile" | "sourceRowNumber" | "sourceFormat" | "sourceFileDate"
  >
): string {
  return buildHash([
    row.transactionId,
    formatDateOnly(row.instanceDate),
    row.transGroupEn,
    row.procedureNameEn,
    row.isOffplan,
    row.isFreehold,
    row.propertyUsageEn,
    row.areaNameEn,
    row.propertyTypeEn,
    row.propertySubTypeEn,
    row.amount,
    row.procedureArea,
    row.meterSalePrice,
    row.rentValue,
    row.meterRentPrice,
    row.roomsEn,
    row.hasParking ? "1" : "0",
    row.nearestMetroEn,
    row.nearestMallEn,
    row.nearestLandmarkEn,
    row.numBuyers,
    row.numSellers,
    row.masterProjectEn,
    row.projectNameEn,
    row.buildingNameEn,
    row.source,
  ]);
}

async function checksumFile(filePath: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function detectSourceFormat(headers: string[]): SourceFormat {
  const set = new Set(headers);
  if (set.has("transaction_id") && set.has("trans_group_en") && set.has("actual_worth") && set.has("reg_type_en")) {
    return "historical_dld_csv";
  }
  if (set.has("TRANSACTION_NUMBER") && set.has("GROUP_EN") && set.has("TRANS_VALUE") && set.has("IS_OFFPLAN_EN")) {
    return "current_year_dld_csv";
  }
  throw new Error(`Unsupported CSV format. Headers: ${headers.join(", ")}`);
}

function readHeaders(filePath: string): string[] {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(65536);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const snippet = buffer.toString("utf8", 0, bytesRead);
    const line = snippet.split(/\r?\n/, 1)[0]?.replace(/^\uFEFF/, "");
    if (!line) throw new Error(`Could not read CSV headers from ${filePath}`);
    return line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
  } finally {
    fs.closeSync(fd);
  }
}

function createCsvParser() {
  return csvParser({
    mapHeaders: ({ header }) => header.trim().replace(/^"|"$/g, ""),
  });
}

function parseSourceFileDate(filePath: string): Date | null {
  const match = path.basename(filePath).match(/transactions-(\d{4}-\d{2}-\d{2})\.csv$/i);
  return match ? parseIsoDate(match[1]) : null;
}

function normalizeHistoricalRow(
  row: RawCsvRow,
  sourceFile: string,
  sourceRowNumber: number,
  sourceRowHash: string,
  aliasMap: Map<string, { canonical: string; display: string }>
): CanonicalTransaction {
  const instanceDate = parseHistoricalDate(row.instance_date);
  const { areaNameEn, normalizedArea, displayArea } = resolveAreaNames(normalizeText(row.area_name_en), aliasMap);
  const amount = normalizeAmount(row.actual_worth) ?? "0";
  const procedureArea = normalizeAmount(row.procedure_area);
  const rentValue = normalizeAmount(row.rent_value);
  const meterRentPrice = normalizeAmount(row.meter_rent_price);
  const propertySubTypeEn = normalizeText(row.property_sub_type_en);
  const propertyTypeEn = normalizePropertyType(normalizeText(row.property_type_en), propertySubTypeEn);
  const base: Omit<CanonicalTransaction, "canonicalRowHash"> = {
    sourceFile,
    sourceFormat: "historical_dld_csv",
    sourceFileDate: null,
    sourceRowNumber,
    sourceRowHash,
    transactionId: normalizeText(row.transaction_id),
    instanceDate,
    year: instanceDate?.getUTCFullYear() ?? null,
    month: instanceDate ? instanceDate.getUTCMonth() + 1 : null,
    yearMonth: instanceDate ? formatYearMonth(instanceDate) : null,
    quarter: instanceDate ? formatQuarter(instanceDate) : null,
    transGroupEn: normalizeGroup(row.trans_group_en),
    procedureNameEn: normalizeText(row.procedure_name_en) ?? "",
    isOffplan: normalizeOffplanHistorical(row.reg_type_en),
    isFreehold: null,
    propertyUsageEn: normalizeText(row.property_usage_en) ?? "",
    normalizedArea,
    displayArea,
    areaNameEn,
    propertyTypeEn,
    propertySubTypeEn: propertySubTypeEn ?? "",
    amount,
    procedureArea,
    actualArea: null,
    meterSalePrice: normalizeAmount(row.meter_sale_price),
    rentValue,
    meterRentPrice,
    roomsEn: normalizeRooms(row.rooms_en),
    parkingCount: normalizeParkingCount(row.has_parking),
    hasParking: deriveHasParking(row.has_parking),
    nearestMetroEn: normalizeText(row.nearest_metro_en) ?? "",
    nearestMallEn: normalizeText(row.nearest_mall_en) ?? "",
    nearestLandmarkEn: normalizeText(row.nearest_landmark_en) ?? "",
    numBuyers: normalizeInteger(row.no_of_parties_role_1) ?? 0,
    numSellers: normalizeInteger(row.no_of_parties_role_2) ?? 0,
    masterProjectEn: normalizeText(row.master_project_en) ?? "",
    projectNameEn: normalizeText(row.project_name_en) ?? "",
    buildingNameEn: normalizeText(row.building_name_en),
    source: "historical",
    isInvalidDate: instanceDate === null,
    isExactDuplicate: false,
    isExcludedByCutoff:
      (instanceDate ? formatDateOnly(instanceDate) >= HISTORICAL_CUTOFF : false) || isBeforeLiveStart(instanceDate),
  };

  return {
    ...base,
    canonicalRowHash: buildCanonicalRowHash(base),
  };
}

function normalizeCurrentYearRow(
  row: RawCsvRow,
  sourceFile: string,
  sourceFileDate: Date | null,
  sourceRowNumber: number,
  sourceRowHash: string,
  aliasMap: Map<string, { canonical: string; display: string }>
): CanonicalTransaction {
  const instanceDate = parseCurrentYearDate(row.INSTANCE_DATE);
  const { areaNameEn, normalizedArea, displayArea } = resolveAreaNames(normalizeText(row.AREA_EN), aliasMap);
  const amount = normalizeAmount(row.TRANS_VALUE) ?? "0";
  const procedureArea = normalizeAmount(row.PROCEDURE_AREA);
  const actualArea = normalizeAmount(row.ACTUAL_AREA);
  const parkingCount = normalizeParkingCount(row.PARKING);
  const propertySubTypeEn = normalizeText(row.PROP_SB_TYPE_EN);
  const propertyTypeEn = normalizePropertyType(normalizeText(row.PROP_TYPE_EN), propertySubTypeEn);
  const base: Omit<CanonicalTransaction, "canonicalRowHash"> = {
    sourceFile,
    sourceFormat: "current_year_dld_csv",
    sourceFileDate,
    sourceRowNumber,
    sourceRowHash,
    transactionId: normalizeText(row.TRANSACTION_NUMBER),
    instanceDate,
    year: instanceDate?.getUTCFullYear() ?? null,
    month: instanceDate ? instanceDate.getUTCMonth() + 1 : null,
    yearMonth: instanceDate ? formatYearMonth(instanceDate) : null,
    quarter: instanceDate ? formatQuarter(instanceDate) : null,
    transGroupEn: normalizeGroup(row.GROUP_EN),
    procedureNameEn: normalizeText(row.PROCEDURE_EN) ?? "",
    isOffplan: normalizeOffplanCurrent(row.IS_OFFPLAN_EN),
    isFreehold: normalizeFreehold(row.IS_FREE_HOLD_EN),
    propertyUsageEn: normalizeText(row.USAGE_EN) ?? "",
    normalizedArea,
    displayArea,
    areaNameEn,
    propertyTypeEn,
    propertySubTypeEn: propertySubTypeEn ?? "",
    amount,
    procedureArea,
    actualArea,
    meterSalePrice: derivePerSqm(amount, procedureArea),
    rentValue: null,
    meterRentPrice: null,
    roomsEn: normalizeRooms(row.ROOMS_EN),
    parkingCount,
    hasParking: deriveHasParking(row.PARKING),
    nearestMetroEn: normalizeText(row.NEAREST_METRO_EN) ?? "",
    nearestMallEn: normalizeText(row.NEAREST_MALL_EN) ?? "",
    nearestLandmarkEn: normalizeText(row.NEAREST_LANDMARK_EN) ?? "",
    numBuyers: normalizeInteger(row.TOTAL_BUYER) ?? 0,
    numSellers: normalizeInteger(row.TOTAL_SELLER) ?? 0,
    masterProjectEn: normalizeText(row.MASTER_PROJECT_EN) ?? "",
    projectNameEn: normalizeText(row.PROJECT_EN) ?? "",
    buildingNameEn: null,
    source: "current_year",
    isInvalidDate: instanceDate === null,
    isExactDuplicate: false,
    isExcludedByCutoff: isBeforeLiveStart(instanceDate),
  };

  return {
    ...base,
    canonicalRowHash: buildCanonicalRowHash(base),
  };
}

function toColumnValues(ingestRunId: bigint, row: CanonicalTransaction): Array<string | number | boolean | Date | bigint | null> {
  return [
    ingestRunId,
    row.sourceFile,
    row.sourceFormat,
    row.sourceFileDate,
    row.sourceRowNumber,
    row.sourceRowHash,
    row.canonicalRowHash,
    row.transactionId,
    row.instanceDate,
    row.year,
    row.month,
    row.yearMonth,
    row.quarter,
    row.transGroupEn,
    row.procedureNameEn,
    row.isOffplan,
    row.isFreehold,
    row.propertyUsageEn,
    row.normalizedArea,
    row.displayArea,
    row.areaNameEn,
    row.propertyTypeEn,
    row.propertySubTypeEn,
    row.amount,
    row.procedureArea,
    row.actualArea,
    row.meterSalePrice,
    row.rentValue,
    row.meterRentPrice,
    row.roomsEn,
    row.parkingCount,
    row.hasParking,
    row.nearestMetroEn,
    row.nearestMallEn,
    row.nearestLandmarkEn,
    row.numBuyers,
    row.numSellers,
    row.masterProjectEn,
    row.projectNameEn,
    row.buildingNameEn,
    row.source,
    row.isInvalidDate,
    row.isExactDuplicate,
    row.isExcludedByCutoff,
  ];
}

function toQueryValue(value: string | number | boolean | Date | bigint | null): string | number | boolean | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "bigint") return value.toString();
  return value;
}

async function insertTransactionsBatch(
  pool: Pool,
  ingestRunId: bigint,
  rows: CanonicalTransaction[]
) {
  if (rows.length === 0) return;

  const columns = TRANSACTION_COLUMNS.map((column) => `"${column}"`).join(", ");
  const values: Array<string | number | boolean | null> = [];
  const placeholders = rows.map((row, rowIndex) => {
    const rowValues = toColumnValues(ingestRunId, row).map(toQueryValue);
    const rowPlaceholders = rowValues.map((_, valueIndex) => `$${rowIndex * rowValues.length + valueIndex + 1}`);
    values.push(...rowValues);
    return `(${rowPlaceholders.join(", ")})`;
  });

  await pool.query(
    `INSERT INTO "transactions" (${columns}) VALUES ${placeholders.join(", ")}`,
    values
  );
}

async function seedAreaAliases(pool: Pool, aliasMap: Map<string, { canonical: string; display: string }>) {
  const values = Array.from(aliasMap.entries());
  if (values.length === 0) return;

  const chunks: string[] = [];
  const params: Array<string> = [];
  values.forEach(([source, payload], index) => {
    const base = index * 4;
    chunks.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    params.push(source, payload.canonical, payload.display, "seed");
  });

  await pool.query(
    `
      INSERT INTO "area_aliases" ("source_area_name", "canonical_area", "display_area", "alias_source")
      VALUES ${chunks.join(", ")}
      ON CONFLICT ("source_area_name") DO UPDATE
      SET
        "canonical_area" = EXCLUDED."canonical_area",
        "display_area" = EXCLUDED."display_area",
        "alias_source" = EXCLUDED."alias_source",
        "updated_at" = CURRENT_TIMESTAMP
    `,
    params
  );
}

type IngestStats = {
  processedRowCount: number;
  insertedRowCount: number;
  liveRowCount: number;
  exactDuplicateCount: number;
  invalidDateCount: number;
  excludedByCutoffCount: number;
};

async function updateIngestRunSummary(runId: bigint, stats: IngestStats) {
  await prisma.ingestRun.update({
    where: { id: runId },
    data: {
      insertedRowCount: stats.insertedRowCount,
      liveRowCount: stats.liveRowCount,
      exactDuplicateCount: stats.exactDuplicateCount,
      invalidDateCount: stats.invalidDateCount,
      excludedByCutoffCount: stats.excludedByCutoffCount,
      status: "SUCCEEDED",
      finishedAt: new Date(),
      metadata: {
        processedRowCount: stats.processedRowCount,
      },
    },
  });

  return stats;
}

function defaultInputFiles(): string[] {
  const workspaceRoot = path.resolve(process.cwd(), "..");
  const defaults: string[] = [];
  const historical = path.join(workspaceRoot, "Transactions.csv");
  if (fs.existsSync(historical)) defaults.push(historical);

  const currentYearFiles = fs
    .readdirSync(workspaceRoot)
    .filter((entry) => /^transactions-\d{4}-\d{2}-\d{2}\.csv$/i.test(entry))
    .sort();
  const latestCurrentYear = currentYearFiles.at(-1);
  if (latestCurrentYear) defaults.push(path.join(workspaceRoot, latestCurrentYear));

  return defaults;
}

async function loadExistingCanonicalHashes(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ canonical_row_hash: string }[]>`
    SELECT DISTINCT canonical_row_hash
    FROM transactions
    WHERE is_invalid_date = FALSE
      AND is_excluded_by_cutoff = FALSE
      AND is_exact_duplicate = FALSE
  `;
  return new Set(rows.map((row) => row.canonical_row_hash));
}

async function ingestFile(
  filePath: string,
  aliasMap: Map<string, { canonical: string; display: string }>,
  seenCanonicalHashes: Set<string>,
  pool: Pool
): Promise<{ runId: bigint; stats: IngestStats }> {
  const absolutePath = path.resolve(filePath);
  const headers = readHeaders(absolutePath);
  const sourceFormat = detectSourceFormat(headers);
  const sourceFileDate = parseSourceFileDate(absolutePath);
  const checksum = await checksumFile(absolutePath);

  const ingestRun = await prisma.ingestRun.create({
    data: {
      sourceFile: absolutePath,
      sourceChecksum: checksum,
      sourceFormat,
      metadata: {
        sourceFileDate: sourceFileDate ? formatDateOnly(sourceFileDate) : null,
      },
    },
  });

  console.log(`Starting ingest run ${ingestRun.id.toString()} for ${path.basename(absolutePath)}`);

  const stats: IngestStats = {
    processedRowCount: 0,
    insertedRowCount: 0,
    liveRowCount: 0,
    exactDuplicateCount: 0,
    invalidDateCount: 0,
    excludedByCutoffCount: 0,
  };
  let pendingRows: CanonicalTransaction[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      const stream = fs.createReadStream(absolutePath).pipe(createCsvParser());

      stream.on("data", async (row: RawCsvRow) => {
        stream.pause();
        stats.processedRowCount += 1;
        const sourceRowHash = buildSourceRowHash(sourceFormat, headers, row);
        const canonical =
          sourceFormat === "historical_dld_csv"
            ? normalizeHistoricalRow(row, absolutePath, stats.processedRowCount, sourceRowHash, aliasMap)
            : normalizeCurrentYearRow(row, absolutePath, sourceFileDate, stats.processedRowCount, sourceRowHash, aliasMap);

        try {
          if (canonical.isInvalidDate) {
            stats.invalidDateCount += 1;
          }
          if (canonical.isExcludedByCutoff) {
            stats.excludedByCutoffCount += 1;
          }

          const dedupeEligible = !canonical.isInvalidDate && !canonical.isExcludedByCutoff;
          canonical.isExactDuplicate = dedupeEligible && seenCanonicalHashes.has(canonical.canonicalRowHash);

          if (canonical.isExactDuplicate) {
            stats.exactDuplicateCount += 1;
            stream.resume();
            return;
          }

          if (dedupeEligible) {
            seenCanonicalHashes.add(canonical.canonicalRowHash);
            stats.liveRowCount += 1;
          }

          pendingRows.push(canonical);

          if (pendingRows.length >= INSERT_BATCH_SIZE) {
            const batch = pendingRows;
            pendingRows = [];
            await insertTransactionsBatch(pool, ingestRun.id, batch);
            stats.insertedRowCount += batch.length;
          }
        } catch (error) {
          reject(error);
          return;
        }

        stream.resume();
      });

      stream.on("end", async () => {
        try {
          if (pendingRows.length > 0) {
            const batch = pendingRows;
            pendingRows = [];
            await insertTransactionsBatch(pool, ingestRun.id, batch);
            stats.insertedRowCount += batch.length;
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      stream.on("error", reject);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.ingestRun.update({
      where: { id: ingestRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    throw error;
  }

  console.log(`Processed ${stats.processedRowCount.toLocaleString()} rows from ${path.basename(absolutePath)}`);
  console.log(`Skipped ${stats.exactDuplicateCount.toLocaleString()} duplicates before insert`);
  return { runId: ingestRun.id, stats };
}

async function main() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const inputFiles = process.argv.slice(2);
  const files = (inputFiles.length > 0 ? inputFiles : defaultInputFiles()).map((file) => path.resolve(file));

  if (files.length === 0) {
    throw new Error("No CSV files provided. Pass files explicitly or place Transactions.csv and a transactions-YYYY-MM-DD.csv file next to the app.");
  }

  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`File not found: ${file}`);
    }
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    keepAlive: true,
    idleTimeoutMillis: 0,
    statement_timeout: 0,
    query_timeout: 0,
  });
  pool.on("error", (error) => {
    console.error("Postgres pool error:", error.message);
  });

  const aliasMap = buildAliasMap();
  const completedRuns: Array<{ runId: bigint; stats: IngestStats }> = [];
  const seenCanonicalHashes = await loadExistingCanonicalHashes();

  try {
    await seedAreaAliases(pool, aliasMap);

    for (const file of files) {
      const completedRun = await ingestFile(file, aliasMap, seenCanonicalHashes, pool);
      completedRuns.push(completedRun);
    }

    for (const { runId, stats } of completedRuns) {
      const summary = await updateIngestRunSummary(runId, stats);
      console.log(`Ingest run ${runId.toString()} complete`);
      console.log(`  Processed rows: ${summary.processedRowCount.toLocaleString()}`);
      console.log(`  Inserted rows: ${summary.insertedRowCount.toLocaleString()}`);
      console.log(`  Live rows: ${summary.liveRowCount.toLocaleString()}`);
      console.log(`  Exact duplicates: ${summary.exactDuplicateCount.toLocaleString()}`);
      console.log(`  Invalid dates: ${summary.invalidDateCount.toLocaleString()}`);
      console.log(`  Excluded by cutoff: ${summary.excludedByCutoffCount.toLocaleString()}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Promise.all(
      completedRuns.map(({ runId }) =>
        prisma.ingestRun.update({
          where: { id: runId },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            errorMessage: message,
          },
        })
      )
    );
    throw error;
  } finally {
    if (!pool.ended) {
      await pool.end();
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Fatal ingest error:", error);
  process.exit(1);
});
