import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { serializeForJson, toDateStart, toDateEnd } from "@/lib/sql";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const dateFrom = toDateStart(sp.get("dateFrom") || "2025-11-01")!;
  const dateTo = toDateEnd(sp.get("dateTo") || "2026-04-08")!;

  const cacheKey = buildCacheKey("crisis_market_composition", { dateFrom, dateTo });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const rows = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        DATE_TRUNC('week', instance_date)::date::text AS week,
        COUNT(*) FILTER (
          WHERE trans_group_en = 'Sales'
            AND (procedure_name_en LIKE '%Pre registration%' OR procedure_name_en LIKE '%Pre-Registration%')
        )::int AS primary_sales,
        COUNT(*) FILTER (
          WHERE trans_group_en = 'Sales'
            AND (procedure_name_en = 'Sale' OR procedure_name_en = 'Sell')
        )::int AS secondary_sales,
        COUNT(*) FILTER (
          WHERE trans_group_en = 'Sales'
            AND procedure_name_en LIKE 'Delayed%'
        )::int AS delayed_sales,
        COUNT(*) FILTER (WHERE trans_group_en = 'Sales')::int AS total_sales,
        COUNT(*) FILTER (WHERE trans_group_en = 'Mortgage')::int AS mortgages,
        -- Price bands
        COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND amount < 1000000)::int AS under_1m,
        COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND amount BETWEEN 1000000 AND 5000000)::int AS band_1m_5m,
        COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND amount BETWEEN 5000000 AND 10000000)::int AS band_5m_10m,
        COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND amount > 10000000)::int AS over_10m
      FROM transactions_live
      WHERE instance_date BETWEEN ${dateFrom}::date AND ${dateTo}::date
      GROUP BY 1
      ORDER BY 1
    `
  );

  const result = serializeForJson({ data: rows });
  setCache(cacheKey, result, 1000 * 60 * 30);
  return NextResponse.json(result);
}
