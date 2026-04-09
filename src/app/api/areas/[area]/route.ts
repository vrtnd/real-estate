import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { serializeForJson, shiftYearMonth } from "@/lib/sql";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ area: string }> }
) {
  const { area } = await params;
  const areaDecoded = decodeURIComponent(area);
  const sp = request.nextUrl.searchParams;
  const dateFrom = sp.get("dateFrom") || "2022-01";
  const dateTo = sp.get("dateTo") || "2026-12";

  const cacheKey = buildCacheKey("area_detail", { area: areaDecoded, dateFrom, dateTo });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const trends = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        year_month AS period,
        sales_count::int AS sales_count,
        sales_volume::double precision AS sales_volume,
        avg_price::double precision AS avg_price,
        avg_sqm_price::double precision AS avg_sqm_price,
        offplan_ratio::double precision AS offplan_ratio,
        display_area
      FROM area_monthly_market_stats
      WHERE normalized_area = ${areaDecoded}
        AND year_month BETWEEN ${dateFrom} AND ${dateTo}
      ORDER BY year_month
    `
  );

  const latestYm =
    Array.isArray(trends) && trends.length > 0
      ? String((trends[trends.length - 1] as { period: string }).period)
      : dateTo;
  const threeMonthsAgo = shiftYearMonth(latestYm, -2);

  const [roomBreakdown, topProjects, typeBreakdown] = await Promise.all([
    prisma.$queryRaw(
      Prisma.sql`
        SELECT
          rooms_en AS room,
          COUNT(*)::int AS count,
          AVG(amount)::double precision AS avg_price,
          AVG(meter_sale_price) FILTER (WHERE meter_sale_price > 0)::double precision AS avg_sqm_price
        FROM transactions_live
        WHERE normalized_area = ${areaDecoded}
          AND trans_group_en = 'Sales'
          AND rooms_en <> ''
          AND year_month BETWEEN ${threeMonthsAgo} AND ${latestYm}
        GROUP BY rooms_en
        ORDER BY count DESC
      `
    ),
    prisma.$queryRaw(
      Prisma.sql`
        SELECT
          project_name_en AS project,
          COUNT(*)::int AS count,
          SUM(amount)::double precision AS volume,
          AVG(amount)::double precision AS avg_price,
          AVG(meter_sale_price) FILTER (WHERE meter_sale_price > 0)::double precision AS avg_sqm_price
        FROM transactions_live
        WHERE normalized_area = ${areaDecoded}
          AND trans_group_en = 'Sales'
          AND project_name_en <> ''
          AND year_month BETWEEN ${threeMonthsAgo} AND ${latestYm}
        GROUP BY project_name_en
        ORDER BY count DESC
        LIMIT 10
      `
    ),
    prisma.$queryRaw(
      Prisma.sql`
        SELECT
          property_sub_type_en AS type,
          COUNT(*)::int AS count,
          AVG(amount)::double precision AS avg_price
        FROM transactions_live
        WHERE normalized_area = ${areaDecoded}
          AND trans_group_en = 'Sales'
          AND year_month BETWEEN ${threeMonthsAgo} AND ${latestYm}
        GROUP BY property_sub_type_en
        ORDER BY count DESC
      `
    ),
  ]);

  const result = serializeForJson({
    data: {
      area: areaDecoded,
      display_area:
        Array.isArray(trends) && trends.length > 0
          ? (trends[0] as { display_area?: string }).display_area || areaDecoded
          : areaDecoded,
      trends,
      room_breakdown: roomBreakdown,
      top_projects: topProjects,
      type_breakdown: Array.isArray(typeBreakdown)
        ? typeBreakdown.filter((row) => (row as { type?: string }).type)
        : [],
    },
  });

  setCache(cacheKey, result);
  return NextResponse.json(result);
}
