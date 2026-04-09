import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { serializeForJson } from "@/lib/sql";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const year = parseInt(sp.get("year") || "2026", 10);
  const prevYear = year - 1;
  const endDate = sp.get("endDate") || `${year}-04-08`;

  const cacheKey = buildCacheKey("crisis_yoy_pacing", { year, endDate });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const rows = await prisma.$queryRaw(
    Prisma.sql`
      WITH weekly_prev AS (
        SELECT
          EXTRACT(WEEK FROM instance_date)::int AS wk,
          MIN(instance_date)::text AS week_start,
          COUNT(*)::int AS sales
        FROM transactions_live
        WHERE instance_date BETWEEN ${`${prevYear}-01-01`}::date AND ${`${prevYear}-${endDate.slice(5)}`}::date
          AND trans_group_en = 'Sales'
        GROUP BY 1
      ),
      weekly_curr AS (
        SELECT
          EXTRACT(WEEK FROM instance_date)::int AS wk,
          MIN(instance_date)::text AS week_start,
          COUNT(*)::int AS sales
        FROM transactions_live
        WHERE instance_date BETWEEN ${`${year}-01-01`}::date AND ${endDate}::date
          AND trans_group_en = 'Sales'
        GROUP BY 1
      )
      SELECT
        COALESCE(c.wk, p.wk) AS week_num,
        COALESCE(c.week_start, '') AS week_label,
        COALESCE(p.sales, 0) AS prev_year,
        COALESCE(c.sales, 0) AS curr_year,
        CASE WHEN p.sales > 0
          THEN ((COALESCE(c.sales, 0)::numeric / p.sales - 1) * 100)::double precision
          ELSE NULL
        END AS yoy_pct
      FROM weekly_curr c
      FULL OUTER JOIN weekly_prev p ON c.wk = p.wk
      WHERE COALESCE(c.wk, p.wk) IS NOT NULL
      ORDER BY 1
    `
  );

  const result = serializeForJson({ data: rows, meta: { year, prevYear } });
  setCache(cacheKey, result, 1000 * 60 * 30);
  return NextResponse.json(result);
}
