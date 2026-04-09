import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import {
  buildTrendBucket,
  parseTrendGranularity,
  serializeForJson,
  toDateEnd,
  toDateStart,
} from "@/lib/sql";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const dateFrom = toDateStart(sp.get("dateFrom") || "2020-01") || "2020-01-01";
  const dateTo = toDateEnd(sp.get("dateTo") || "2026-12") || "2026-12-31";
  const area = sp.get("area") || null;
  const granularity = parseTrendGranularity(sp.get("granularity"));
  const { periodStart, periodLabel } = buildTrendBucket("t", granularity);

  const cacheKey = buildCacheKey("trends_prices", { dateFrom, dateTo, area, granularity });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const areaClause = area ? Prisma.sql`AND t.normalized_area = ${area}` : Prisma.empty;

  const data = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        ${periodLabel} AS period,
        ${periodStart} AS period_start,
        EXTRACT(YEAR FROM ${periodStart})::int AS year,
        EXTRACT(MONTH FROM ${periodStart})::int AS month,
        AVG(t.amount) FILTER (WHERE t.trans_group_en = 'Sales')::double precision AS avg_price,
        AVG(t.meter_sale_price) FILTER (
          WHERE t.trans_group_en = 'Sales' AND t.meter_sale_price > 0 AND t.procedure_area >= 5 AND t.meter_sale_price < 200000
        )::double precision AS avg_sqm_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY t.meter_sale_price) FILTER (
          WHERE t.trans_group_en = 'Sales' AND t.meter_sale_price > 0 AND t.procedure_area >= 5
        )::double precision AS median_sqm_price,
        AVG(t.procedure_area) FILTER (
          WHERE t.trans_group_en = 'Sales' AND t.procedure_area >= 5
        )::double precision AS avg_area,
        COUNT(*) FILTER (WHERE t.trans_group_en = 'Sales')::int AS sales_count
      FROM transactions_live AS t
      WHERE t.instance_date BETWEEN ${dateFrom}::date AND ${dateTo}::date
      ${areaClause}
      GROUP BY ${periodStart}, ${periodLabel}
      HAVING COUNT(*) FILTER (WHERE t.trans_group_en = 'Sales') >= 10
      ORDER BY ${periodStart}
    `
  );

  const result = serializeForJson({ data, meta: { granularity, dateFrom, dateTo, area } });
  setCache(cacheKey, result);
  return NextResponse.json(result);
}
