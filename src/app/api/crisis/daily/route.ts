import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { serializeForJson, toDateStart, toDateEnd } from "@/lib/sql";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const dateFrom = toDateStart(sp.get("dateFrom") || "2026-01-01")!;
  const dateTo = toDateEnd(sp.get("dateTo") || "2026-04-08")!;

  const cacheKey = buildCacheKey("crisis_daily", { dateFrom, dateTo });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const rows = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        instance_date::text AS date,
        COUNT(*) FILTER (WHERE trans_group_en = 'Sales')::int AS sales,
        COUNT(*) FILTER (WHERE trans_group_en = 'Mortgage')::int AS mortgages,
        COALESCE(SUM(amount) FILTER (WHERE trans_group_en = 'Sales'), 0)::double precision AS sales_value,
        AVG(meter_sale_price) FILTER (
          WHERE trans_group_en = 'Sales' AND meter_sale_price > 0
        )::double precision AS avg_sqm_price,
        COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Off-Plan')::int AS offplan,
        COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Ready')::int AS ready,
        CASE
          WHEN COUNT(*) FILTER (WHERE trans_group_en = 'Sales') > 0 THEN
            ROUND(
              COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Off-Plan')::numeric
              / COUNT(*) FILTER (WHERE trans_group_en = 'Sales') * 100, 1
            )::double precision
          ELSE 0
        END AS offplan_pct
      FROM transactions_live
      WHERE instance_date BETWEEN ${dateFrom}::date AND ${dateTo}::date
      GROUP BY instance_date
      ORDER BY instance_date
    `
  );

  const result = serializeForJson({ data: rows });
  setCache(cacheKey, result, 1000 * 60 * 30);
  return NextResponse.json(result);
}
