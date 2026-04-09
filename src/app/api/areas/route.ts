import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { getLatestCompleteYearMonth, sameMonthLastYear, serializeForJson, shiftYearMonth } from "@/lib/sql";

const AREA_SORT_COLUMNS: Record<string, string> = {
  sales_count: "sales_count",
  sales_volume: "sales_volume",
  avg_price: "avg_price",
  avg_sqm_price: "avg_sqm_price",
  avg_area_sqm: "avg_area_sqm",
  offplan_ratio: "offplan_ratio",
};

interface AreaRow {
  normalized_area: string;
  display_area: string;
  sales_count: number;
  sales_volume: number;
  avg_price: number;
  avg_sqm_price: number;
  avg_area_sqm: number;
  offplan_ratio: number;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const limit = parseInt(sp.get("limit") || "30", 10);
  const sortBy = AREA_SORT_COLUMNS[sp.get("sortBy") || "sales_count"] || AREA_SORT_COLUMNS.sales_count;
  const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";

  const cacheKey = buildCacheKey("areas", { limit, sortBy, sortDir });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const latestMonth = await getLatestCompleteYearMonth(prisma);
  if (!latestMonth) return NextResponse.json({ data: [], meta: null });

  const prevMonth = shiftYearMonth(latestMonth, -1);
  const yoyMonth = sameMonthLastYear(latestMonth);

  const latestData = await prisma.$queryRaw<AreaRow[]>(
    Prisma.sql`
      SELECT
        normalized_area,
        display_area,
        sales_count::int AS sales_count,
        sales_volume::double precision AS sales_volume,
        avg_price::double precision AS avg_price,
        avg_sqm_price::double precision AS avg_sqm_price,
        avg_area_sqm::double precision AS avg_area_sqm,
        offplan_ratio::double precision AS offplan_ratio
      FROM area_monthly_market_stats
      WHERE year_month = ${latestMonth}
      ORDER BY ${Prisma.raw(`"${sortBy}"`)} ${Prisma.raw(sortDir)}
      LIMIT ${limit}
    `
  );

  const areaKeys = latestData.map((row) => row.normalized_area);
  const [prevData, yoyData] = areaKeys.length
    ? await Promise.all([
        prisma.$queryRaw<AreaRow[]>(
          Prisma.sql`
            SELECT
              normalized_area,
              display_area,
              sales_count::int AS sales_count,
              sales_volume::double precision AS sales_volume,
              avg_price::double precision AS avg_price,
              avg_sqm_price::double precision AS avg_sqm_price,
              avg_area_sqm::double precision AS avg_area_sqm,
              offplan_ratio::double precision AS offplan_ratio
            FROM area_monthly_market_stats
            WHERE year_month = ${prevMonth}
              AND normalized_area IN (${Prisma.join(areaKeys)})
          `
        ),
        prisma.$queryRaw<AreaRow[]>(
          Prisma.sql`
            SELECT
              normalized_area,
              display_area,
              sales_count::int AS sales_count,
              sales_volume::double precision AS sales_volume,
              avg_price::double precision AS avg_price,
              avg_sqm_price::double precision AS avg_sqm_price,
              avg_area_sqm::double precision AS avg_area_sqm,
              offplan_ratio::double precision AS offplan_ratio
            FROM area_monthly_market_stats
            WHERE year_month = ${yoyMonth}
              AND normalized_area IN (${Prisma.join(areaKeys)})
          `
        ),
      ])
    : [[], []];

  const prevMap = new Map(prevData.map((row) => [row.normalized_area, row]));
  const yoyMap = new Map(yoyData.map((row) => [row.normalized_area, row]));
  const pct = (curr: number, base?: number | null) => (base && base > 0 ? ((curr - base) / base) * 100 : null);

  const data = latestData.map((row) => {
    const prev = prevMap.get(row.normalized_area);
    const yoy = yoyMap.get(row.normalized_area);
    return {
      normalized_area: row.normalized_area,
      display_area: row.display_area,
      sales_count: row.sales_count,
      sales_volume: row.sales_volume,
      avg_price: row.avg_price,
      avg_sqm_price: row.avg_sqm_price,
      avg_area_sqm: row.avg_area_sqm,
      offplan_ratio: row.offplan_ratio,
      mom_volume_change: pct(row.sales_count, prev?.sales_count),
      yoy_volume_change: pct(row.sales_count, yoy?.sales_count),
      mom_price_change: pct(row.avg_sqm_price, prev?.avg_sqm_price),
      yoy_price_change: pct(row.avg_sqm_price, yoy?.avg_sqm_price),
      period: latestMonth,
    };
  });

  const result = serializeForJson({ data, meta: { period: latestMonth, prevMonth, yoyMonth } });
  setCache(cacheKey, result);
  return NextResponse.json(result);
}
