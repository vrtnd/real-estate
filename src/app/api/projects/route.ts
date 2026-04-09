import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { serializeForJson } from "@/lib/sql";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const limit = parseInt(sp.get("limit") || "50", 10);
  const area = sp.get("area") || null;
  const dateFrom = sp.get("dateFrom") || "2025-01";
  const dateTo = sp.get("dateTo") || "2026-12";

  const cacheKey = buildCacheKey("projects", { limit, area, dateFrom, dateTo });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const where = area
    ? Prisma.sql`WHERE normalized_area = ${area} AND year_month BETWEEN ${dateFrom} AND ${dateTo}`
    : Prisma.sql`WHERE year_month BETWEEN ${dateFrom} AND ${dateTo}`;

  const data = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        project_name_en AS project_name,
        MIN(master_project_en) AS master_project,
        MIN(normalized_area) AS area,
        MIN(display_area) AS display_area,
        SUM(sales_count)::int AS sales_count,
        SUM(sales_volume)::double precision AS sales_volume,
        AVG(avg_price)::double precision AS avg_price,
        AVG(avg_sqm_price)::double precision AS avg_sqm_price,
        AVG(offplan_ratio)::double precision AS offplan_ratio
      FROM project_monthly_market_stats
      ${where}
      GROUP BY project_name_en
      ORDER BY sales_volume DESC
      LIMIT ${limit}
    `
  );

  const result = serializeForJson({ data });
  setCache(cacheKey, result);
  return NextResponse.json(result);
}
