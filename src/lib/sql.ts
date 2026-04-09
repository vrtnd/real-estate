import { Prisma } from "@prisma/client";

import type { FilterParams } from "@/lib/filters";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

export type TrendGranularity = "day" | "week" | "month";

export function trustedColumn(alias: string, column: string): Prisma.Sql {
  return Prisma.raw(`"${alias}"."${column}"`);
}

export function normalizedPropertyTypeSql(alias = "t"): Prisma.Sql {
  const propertyType = trustedColumn(alias, "property_type_en");
  const propertySubType = trustedColumn(alias, "property_sub_type_en");

  return Prisma.sql`
    CASE
      WHEN COALESCE(${propertySubType}, '') ILIKE '%villa%' THEN 'Villa'
      ELSE ${propertyType}
    END
  `;
}

function monthStart(value: string): string {
  return `${value}-01`;
}

function monthEnd(value: string): string {
  const [year, month] = value.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0));
  return end.toISOString().slice(0, 10);
}

export function toDateStart(value?: string): string | null {
  if (!value) return null;
  if (ISO_DAY.test(value)) return value;
  if (ISO_MONTH.test(value)) return monthStart(value);
  return null;
}

export function toDateEnd(value?: string): string | null {
  if (!value) return null;
  if (ISO_DAY.test(value)) return value;
  if (ISO_MONTH.test(value)) return monthEnd(value);
  return null;
}

export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function sameMonthLastYear(yearMonth: string): string {
  return shiftYearMonth(yearMonth, -12);
}

export function quarterFromMonth(month: number): string {
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

export function parseTrendGranularity(value?: string | null): TrendGranularity {
  if (value === "day" || value === "week" || value === "month") return value;
  return "month";
}

export function buildTrendBucket(alias: string, granularity: TrendGranularity): {
  periodStart: Prisma.Sql;
  periodLabel: Prisma.Sql;
} {
  const column = trustedColumn(alias, "instance_date");

  if (granularity === "day") {
    return {
      periodStart: Prisma.sql`DATE_TRUNC('day', ${column})::date`,
      periodLabel: Prisma.sql`TO_CHAR(DATE_TRUNC('day', ${column})::date, 'YYYY-MM-DD')`,
    };
  }

  if (granularity === "week") {
    return {
      periodStart: Prisma.sql`DATE_TRUNC('week', ${column})::date`,
      periodLabel: Prisma.sql`TO_CHAR(DATE_TRUNC('week', ${column})::date, 'YYYY-MM-DD')`,
    };
  }

  return {
    periodStart: Prisma.sql`DATE_TRUNC('month', ${column})::date`,
    periodLabel: Prisma.sql`TO_CHAR(DATE_TRUNC('month', ${column})::date, 'YYYY-MM')`,
  };
}

export function buildCuratedWhere(params: FilterParams, alias = "t"): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  const dateFrom = toDateStart(params.dateFrom);
  const dateTo = toDateEnd(params.dateTo);

  if (dateFrom) {
    conditions.push(Prisma.sql`${trustedColumn(alias, "instance_date")} >= ${dateFrom}::date`);
  }
  if (dateTo) {
    conditions.push(Prisma.sql`${trustedColumn(alias, "instance_date")} <= ${dateTo}::date`);
  }

  for (const [key, column] of [
    [params.transGroup, "trans_group_en"],
    [params.propertyUsage, "property_usage_en"],
    [params.area, "normalized_area"],
    [params.rooms, "rooms_en"],
  ] as const) {
    const values = Array.isArray(key) ? key : key?.split(",").map((v) => v.trim()).filter(Boolean) || [];
    if (values.length === 1) {
      conditions.push(Prisma.sql`${trustedColumn(alias, column)} = ${values[0]}`);
    } else if (values.length > 1) {
      conditions.push(Prisma.sql`${trustedColumn(alias, column)} IN (${Prisma.join(values)})`);
    }
  }

  const propertyTypes = Array.isArray(params.propertyType)
    ? params.propertyType
    : params.propertyType?.split(",").map((v) => v.trim()).filter(Boolean) || [];
  if (propertyTypes.length === 1) {
    conditions.push(Prisma.sql`${normalizedPropertyTypeSql(alias)} = ${propertyTypes[0]}`);
  } else if (propertyTypes.length > 1) {
    conditions.push(Prisma.sql`${normalizedPropertyTypeSql(alias)} IN (${Prisma.join(propertyTypes)})`);
  }

  if (params.isOffplan && params.isOffplan !== "all") {
    conditions.push(Prisma.sql`${trustedColumn(alias, "is_offplan")} = ${params.isOffplan}`);
  }

  if (params.project) {
    conditions.push(Prisma.sql`${trustedColumn(alias, "project_name_en")} = ${params.project}`);
  }

  if (typeof params.minAmount === "number" && !Number.isNaN(params.minAmount)) {
    conditions.push(Prisma.sql`${trustedColumn(alias, "amount")} >= ${params.minAmount}`);
  }
  if (typeof params.maxAmount === "number" && !Number.isNaN(params.maxAmount)) {
    conditions.push(Prisma.sql`${trustedColumn(alias, "amount")} <= ${params.maxAmount}`);
  }

  if (params.search) {
    const search = `%${params.search}%`;
    conditions.push(
      Prisma.sql`(
        ${trustedColumn(alias, "project_name_en")} ILIKE ${search}
        OR ${trustedColumn(alias, "normalized_area")} ILIKE ${search}
        OR ${trustedColumn(alias, "display_area")} ILIKE ${search}
      )`
    );
  }

  if (conditions.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

export function serializeForJson<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "bigint") return Number(value) as T;
  if (value instanceof Date) return value.toISOString() as T;
  if (Array.isArray(value)) return value.map((item) => serializeForJson(item)) as T;
  if (typeof value === "object") {
    const maybeDecimal = value as { toNumber?: () => number };
    if (typeof maybeDecimal.toNumber === "function") {
      return maybeDecimal.toNumber() as T;
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, serializeForJson(val)])
    ) as T;
  }
  return value;
}

export async function getLatestCompleteYearMonth(
  prisma: { $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T> }
): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ max_date: Date | null }[]>(
    Prisma.sql`SELECT MAX(instance_date) AS max_date FROM transactions_live`
  );
  const maxDate = rows[0]?.max_date;
  if (!maxDate) return null;

  const year = maxDate.getUTCFullYear();
  const month = maxDate.getUTCMonth() + 1;
  const endOfMonth = new Date(Date.UTC(year, month, 0));
  const maxDay = maxDate.toISOString().slice(0, 10);
  const endDay = endOfMonth.toISOString().slice(0, 10);
  const ym = `${year}-${String(month).padStart(2, "0")}`;

  if (maxDay === endDay) return ym;
  return shiftYearMonth(ym, -1);
}
