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
  const granularity = parseTrendGranularity(sp.get("granularity"));
  const { periodStart, periodLabel } = buildTrendBucket("t", granularity);

  const cacheKey = buildCacheKey("trends_offplan", { dateFrom, dateTo, granularity });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const data = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        ${periodLabel} AS period,
        ${periodStart} AS period_start,
        EXTRACT(YEAR FROM ${periodStart})::int AS year,
        EXTRACT(MONTH FROM ${periodStart})::int AS month,
        COUNT(*) FILTER (WHERE t.trans_group_en = 'Sales' AND t.is_offplan = 'Off-Plan')::int AS offplan_count,
        COUNT(*) FILTER (WHERE t.trans_group_en = 'Sales' AND t.is_offplan = 'Ready')::int AS ready_count,
        CASE
          WHEN COUNT(*) FILTER (WHERE t.trans_group_en = 'Sales') > 0 THEN
            COUNT(*) FILTER (WHERE t.trans_group_en = 'Sales' AND t.is_offplan = 'Off-Plan')::double precision
            / COUNT(*) FILTER (WHERE t.trans_group_en = 'Sales')
          ELSE 0
        END AS offplan_ratio,
        COUNT(*) FILTER (WHERE t.trans_group_en = 'Sales')::int AS total_sales
      FROM transactions_live AS t
      WHERE t.instance_date BETWEEN ${dateFrom}::date AND ${dateTo}::date
      GROUP BY ${periodStart}, ${periodLabel}
      ORDER BY ${periodStart}
    `
  );

  const result = serializeForJson({ data, meta: { granularity, dateFrom, dateTo } });
  setCache(cacheKey, result);
  return NextResponse.json(result);
}
