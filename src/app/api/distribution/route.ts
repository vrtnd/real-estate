import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { normalizedPropertyTypeSql, serializeForJson, toDateEnd, toDateStart } from "@/lib/sql";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const dateFrom = toDateStart(sp.get("dateFrom") || "2025-01")!;
  const dateTo = toDateEnd(sp.get("dateTo") || "2026-12")!;
  const area = sp.get("area") || null;
  const propertyType = sp.get("propertyType") || null;
  const bins = Math.max(parseInt(sp.get("bins") || "20", 10), 1);

  const cacheKey = buildCacheKey("distribution", { dateFrom, dateTo, area, propertyType, bins });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const areaWhere = area ? Prisma.sql`AND normalized_area = ${area}` : Prisma.empty;
  const propertyTypeWhere = propertyType ? Prisma.sql`AND ${normalizedPropertyTypeSql("transactions_live")} = ${propertyType}` : Prisma.empty;

  const rangeRows = await prisma.$queryRaw<{ p5: number | null; p95: number | null; min: number | null; max: number | null }[]>(
    Prisma.sql`
      SELECT
        percentile_cont(0.05) WITHIN GROUP (ORDER BY meter_sale_price)::double precision AS p5,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY meter_sale_price)::double precision AS p95,
        MIN(meter_sale_price)::double precision AS min,
        MAX(meter_sale_price)::double precision AS max
      FROM transactions_live
      WHERE trans_group_en = 'Sales'
        AND meter_sale_price > 0
        AND instance_date BETWEEN ${dateFrom}::date AND ${dateTo}::date
        ${areaWhere}
        ${propertyTypeWhere}
    `
  );

  const range = rangeRows[0];
  if (!range?.min || !range?.max) {
    return NextResponse.json({ data: [] });
  }

  const lo = Math.floor(((range.p5 ?? range.min) as number) / 1000) * 1000;
  const hi = Math.ceil(((range.p95 ?? range.max) as number) / 1000) * 1000;
  if (hi <= lo) {
    return NextResponse.json({ data: [] });
  }

  const binWidth = Math.max(Math.ceil((hi - lo) / bins / 1000) * 1000, 1000);
  const histogram = await prisma.$queryRaw<{ bucket: number; count: number }[]>(
    Prisma.sql`
      SELECT
        FLOOR((meter_sale_price - ${lo}) / ${binWidth})::int AS bucket,
        COUNT(*)::int AS count
      FROM transactions_live
      WHERE trans_group_en = 'Sales'
        AND meter_sale_price > 0
        AND meter_sale_price BETWEEN ${lo} AND ${hi}
        AND instance_date BETWEEN ${dateFrom}::date AND ${dateTo}::date
        ${areaWhere}
        ${propertyTypeWhere}
      GROUP BY bucket
      ORDER BY bucket
    `
  );

  const data = histogram.map((row) => ({
    bin_start: lo + row.bucket * binWidth,
    bin_end: lo + (row.bucket + 1) * binWidth,
    count: row.count,
  }));

  const result = serializeForJson({ data, meta: { binWidth, lo, hi } });
  setCache(cacheKey, result, 1000 * 60 * 15);
  return NextResponse.json(result);
}
