import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import {
  PRE_CRISIS_START,
  PRE_CRISIS_END,
  POST_CRISIS_START,
  POST_CRISIS_END,
  DISPLAY_NAME_MAP,
} from "@/lib/constants";
import { serializeForJson, toDateStart, toDateEnd } from "@/lib/sql";

function inclusiveDays(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00.000Z`).getTime();
  const e = new Date(`${end}T00:00:00.000Z`).getTime();
  return Math.floor((e - s) / 86400000) + 1;
}

interface RawRow {
  area: string;
  lat: number;
  lng: number;
  pre_sales: number;
  post_sales: number;
  pre_avg_sqm: number | null;
  post_avg_sqm: number | null;
  pre_volume: number;
  post_volume: number;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const preStart = toDateStart(sp.get("preStart") || PRE_CRISIS_START)!;
  const preEnd = toDateEnd(sp.get("preEnd") || PRE_CRISIS_END)!;
  const postStart = toDateStart(sp.get("postStart") || POST_CRISIS_START)!;
  const postEnd = toDateEnd(sp.get("postEnd") || POST_CRISIS_END)!;

  const cacheKey = buildCacheKey("crisis_geo", { preStart, preEnd, postStart, postEnd });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const preDays = inclusiveDays(preStart, preEnd);
  const postDays = inclusiveDays(postStart, postEnd);

  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    WITH pre AS (
      SELECT
        normalized_area AS area,
        COUNT(*)::int AS cnt,
        AVG(meter_sale_price) FILTER (WHERE meter_sale_price > 0)::double precision AS avg_sqm,
        SUM(amount)::double precision AS volume
      FROM transactions_live
      WHERE instance_date BETWEEN ${preStart}::date AND ${preEnd}::date
        AND trans_group_en = 'Sales'
      GROUP BY 1 HAVING COUNT(*) >= 30
    ), post AS (
      SELECT
        normalized_area AS area,
        COUNT(*)::int AS cnt,
        AVG(meter_sale_price) FILTER (WHERE meter_sale_price > 0)::double precision AS avg_sqm,
        SUM(amount)::double precision AS volume
      FROM transactions_live
      WHERE instance_date BETWEEN ${postStart}::date AND ${postEnd}::date
        AND trans_group_en = 'Sales'
      GROUP BY 1 HAVING COUNT(*) >= 5
    )
    SELECT
      pre.area,
      g.lat::double precision AS lat,
      g.lng::double precision AS lng,
      pre.cnt AS pre_sales,
      COALESCE(post.cnt, 0)::int AS post_sales,
      pre.avg_sqm AS pre_avg_sqm,
      post.avg_sqm AS post_avg_sqm,
      pre.volume AS pre_volume,
      COALESCE(post.volume, 0)::double precision AS post_volume
    FROM pre
    LEFT JOIN post USING (area)
    JOIN geo_coordinates g ON g.entity_type = 'area' AND g.entity_name = pre.area
    ORDER BY pre.cnt DESC
  `);

  const data = serializeForJson(
    rows.map((r) => {
      const preDailyRate = r.pre_sales / preDays;
      const postDailyRate = r.post_sales / postDays;
      const volumeChangePct = preDailyRate > 0
        ? Math.round(((postDailyRate / preDailyRate) - 1) * 1000) / 10
        : 0;
      const priceChangePct = r.pre_avg_sqm && r.post_avg_sqm && r.pre_avg_sqm > 0
        ? Math.round(((r.post_avg_sqm / r.pre_avg_sqm) - 1) * 1000) / 10
        : null;
      return {
        area: r.area,
        display_area: DISPLAY_NAME_MAP[r.area] || r.area,
        lat: r.lat,
        lng: r.lng,
        pre_sales: r.pre_sales,
        post_sales: r.post_sales,
        pre_daily: Math.round(preDailyRate * 10) / 10,
        post_daily: Math.round(postDailyRate * 10) / 10,
        volume_change_pct: volumeChangePct,
        price_change_pct: priceChangePct,
        pre_avg_sqm: r.pre_avg_sqm,
        post_avg_sqm: r.post_avg_sqm,
      };
    })
  );

  const result = { data };
  setCache(cacheKey, result, 1000 * 60 * 30);
  return NextResponse.json(result);
}
