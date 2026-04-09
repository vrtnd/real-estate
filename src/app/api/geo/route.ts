import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { serializeForJson } from "@/lib/sql";

interface GeoAreaRow {
  normalized_area: string;
  display_area: string;
  lat: number;
  lng: number;
  bayut_name: string | null;
  sales_count: number;
  sales_volume: number;
  avg_sqm_price: number;
  avg_price: number;
  offplan_ratio: number;
}

interface GeoProjectRow {
  project_name_en: string;
  normalized_area: string;
  display_area: string;
  lat: number;
  lng: number;
  bayut_name: string | null;
  sales_count: number;
  sales_volume: number;
  avg_sqm_price: number;
  avg_price: number;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const level = sp.get("level") || "area";
  const dateFrom = sp.get("dateFrom") || "2020-01";
  const dateTo = sp.get("dateTo") || "2026-12";

  const cacheKey = buildCacheKey("geo", { level, dateFrom, dateTo });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  if (level === "project") {
    const rows = await prisma.$queryRaw<GeoProjectRow[]>(Prisma.sql`
      SELECT
        g.entity_name AS project_name_en,
        t.normalized_area,
        t.display_area,
        g.lat::double precision AS lat,
        g.lng::double precision AS lng,
        g.bayut_name,
        COUNT(*)::int AS sales_count,
        SUM(t.amount)::double precision AS sales_volume,
        AVG(t.meter_sale_price) FILTER (WHERE t.meter_sale_price > 0)::double precision AS avg_sqm_price,
        AVG(t.amount)::double precision AS avg_price
      FROM geo_coordinates g
      JOIN transactions_live t
        ON t.project_name_en = g.entity_name
        AND t.trans_group_en = 'Sales'
        AND t.year_month BETWEEN ${dateFrom} AND ${dateTo}
      WHERE g.entity_type = 'project'
      GROUP BY g.entity_name, t.normalized_area, t.display_area, g.lat, g.lng, g.bayut_name
      HAVING COUNT(*) >= 10
      ORDER BY COUNT(*) DESC
    `);

    const result = serializeForJson({ data: rows });
    setCache(cacheKey, result);
    return NextResponse.json(result);
  }

  // Default: area level
  const rows = await prisma.$queryRaw<GeoAreaRow[]>(Prisma.sql`
    SELECT
      g.entity_name AS normalized_area,
      MAX(t.display_area) AS display_area,
      g.lat::double precision AS lat,
      g.lng::double precision AS lng,
      g.bayut_name,
      COUNT(*)::int AS sales_count,
      SUM(t.amount)::double precision AS sales_volume,
      AVG(t.meter_sale_price) FILTER (WHERE t.meter_sale_price > 0)::double precision AS avg_sqm_price,
      AVG(t.amount)::double precision AS avg_price,
      CASE WHEN COUNT(*) > 0
        THEN COUNT(*) FILTER (WHERE t.is_offplan = 'Off-Plan')::double precision / COUNT(*)
        ELSE 0
      END AS offplan_ratio
    FROM geo_coordinates g
    JOIN transactions_live t
      ON t.normalized_area = g.entity_name
      AND t.trans_group_en = 'Sales'
      AND t.year_month BETWEEN ${dateFrom} AND ${dateTo}
    WHERE g.entity_type = 'area'
    GROUP BY g.entity_name, g.lat, g.lng, g.bayut_name
    HAVING COUNT(*) >= 10
    ORDER BY COUNT(*) DESC
  `);

  const result = serializeForJson({ data: rows });
  setCache(cacheKey, result);
  return NextResponse.json(result);
}
