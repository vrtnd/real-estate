import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { normalizedPropertyTypeSql, serializeForJson } from "@/lib/sql";

interface PropertyTypeRow {
  property_type: string;
  period: string;
  year: number;
  month: number;
  count: number;
  volume: number;
  avg_price: number;
  avg_sqm_price: number;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const dateFrom = sp.get("dateFrom") || "2020-01";
  const dateTo = sp.get("dateTo") || "2026-12";

  const cacheKey = buildCacheKey("property_types", { dateFrom, dateTo });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const rows = await prisma.$queryRaw<PropertyTypeRow[]>(
    Prisma.sql`
      SELECT
        ${normalizedPropertyTypeSql("transactions_live")} AS property_type,
        year_month AS period,
        year::int AS year,
        month::int AS month,
        COUNT(*)::int AS count,
        SUM(amount)::double precision AS volume,
        AVG(amount)::double precision AS avg_price,
        AVG(meter_sale_price) FILTER (WHERE meter_sale_price > 0)::double precision AS avg_sqm_price
      FROM transactions_live
      WHERE trans_group_en = 'Sales'
        AND year_month BETWEEN ${dateFrom} AND ${dateTo}
      GROUP BY 1, 2, 3, 4
      ORDER BY 1, 2
    `
  );

  const grouped = rows.reduce<Record<string, unknown[]>>((acc, row) => {
    if (!acc[row.property_type]) acc[row.property_type] = [];
    acc[row.property_type].push({
      period: row.period,
      year: row.year,
      month: row.month,
      count: row.count,
      volume: row.volume,
      avg_price: row.avg_price,
      avg_sqm_price: row.avg_sqm_price,
    });
    return acc;
  }, {});

  const result = serializeForJson({ data: grouped });
  setCache(cacheKey, result);
  return NextResponse.json(result);
}
