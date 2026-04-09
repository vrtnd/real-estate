import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { serializeForJson } from "@/lib/sql";

interface RoomRow {
  room: string;
  period: string;
  year: number;
  month: number;
  count: number;
  avg_price: number;
  avg_sqm_price: number;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const dateFrom = sp.get("dateFrom") || "2020-01";
  const dateTo = sp.get("dateTo") || "2026-12";
  const area = sp.get("area") || null;

  const cacheKey = buildCacheKey("rooms", { dateFrom, dateTo, area });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const areaWhere = area ? Prisma.sql`AND normalized_area = ${area}` : Prisma.empty;

  const rows = await prisma.$queryRaw<RoomRow[]>(
    Prisma.sql`
      SELECT
        rooms_en AS room,
        year_month AS period,
        year::int AS year,
        month::int AS month,
        COUNT(*)::int AS count,
        AVG(amount)::double precision AS avg_price,
        AVG(meter_sale_price) FILTER (WHERE meter_sale_price > 0)::double precision AS avg_sqm_price
      FROM transactions_live
      WHERE trans_group_en = 'Sales'
        AND rooms_en <> ''
        AND year_month BETWEEN ${dateFrom} AND ${dateTo}
        ${areaWhere}
      GROUP BY rooms_en, year_month, year, month
      ORDER BY rooms_en, year_month
    `
  );

  const grouped = rows.reduce<Record<string, unknown[]>>((acc, row) => {
    if (!acc[row.room]) acc[row.room] = [];
    acc[row.room].push({
      period: row.period,
      year: row.year,
      month: row.month,
      count: row.count,
      avg_price: row.avg_price,
      avg_sqm_price: row.avg_sqm_price,
    });
    return acc;
  }, {});

  const result = serializeForJson({ data: grouped });
  setCache(cacheKey, result);
  return NextResponse.json(result);
}
