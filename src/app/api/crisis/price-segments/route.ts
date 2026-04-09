import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { serializeForJson, toDateStart, toDateEnd } from "@/lib/sql";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const dateFrom = toDateStart(sp.get("dateFrom") || "2025-11-01")!;
  const dateTo = toDateEnd(sp.get("dateTo") || "2026-04-08")!;

  const cacheKey = buildCacheKey("crisis_price_segments", { dateFrom, dateTo });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const rows = await prisma.$queryRaw<Array<{
    week: string;
    rooms: string;
    median_sqm: number;
    count: number;
  }>>(
    Prisma.sql`
      SELECT
        TO_CHAR(DATE_TRUNC('week', instance_date)::date, 'YYYY-MM-DD') AS week,
        rooms_en AS rooms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY meter_sale_price)::double precision AS median_sqm,
        COUNT(*)::int AS count
      FROM transactions_live
      WHERE trans_group_en = 'Sales'
        AND is_offplan = 'Ready'
        AND property_sub_type_en = 'Flat'
        AND procedure_area >= 5
        AND meter_sale_price > 0
        AND rooms_en IN ('Studio', '1 B/R', '2 B/R', '3 B/R')
        AND instance_date BETWEEN ${dateFrom}::date AND ${dateTo}::date
      GROUP BY DATE_TRUNC('week', instance_date)::date, rooms_en
      HAVING COUNT(*) >= 5
      ORDER BY DATE_TRUNC('week', instance_date)::date
    `
  );

  // Pivot into weekly rows with one column per room type
  const weekMap = new Map<string, {
    week: string;
    studio: number | null;
    br1: number | null;
    br2: number | null;
    br3: number | null;
    studio_cnt: number;
    br1_cnt: number;
    br2_cnt: number;
    br3_cnt: number;
  }>();

  for (const r of rows) {
    if (!weekMap.has(r.week)) {
      weekMap.set(r.week, {
        week: r.week,
        studio: null, br1: null, br2: null, br3: null,
        studio_cnt: 0, br1_cnt: 0, br2_cnt: 0, br3_cnt: 0,
      });
    }
    const entry = weekMap.get(r.week)!;
    if (r.rooms === "Studio") { entry.studio = r.median_sqm; entry.studio_cnt = r.count; }
    if (r.rooms === "1 B/R") { entry.br1 = r.median_sqm; entry.br1_cnt = r.count; }
    if (r.rooms === "2 B/R") { entry.br2 = r.median_sqm; entry.br2_cnt = r.count; }
    if (r.rooms === "3 B/R") { entry.br3 = r.median_sqm; entry.br3_cnt = r.count; }
  }

  const data = Array.from(weekMap.values());

  const result = serializeForJson({ data });
  setCache(cacheKey, result, 1000 * 60 * 30);
  return NextResponse.json(result);
}
