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

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const preStart = toDateStart(sp.get("preStart") || PRE_CRISIS_START)!;
  const preEnd = toDateEnd(sp.get("preEnd") || PRE_CRISIS_END)!;
  const postStart = toDateStart(sp.get("postStart") || POST_CRISIS_START)!;
  const postEnd = toDateEnd(sp.get("postEnd") || POST_CRISIS_END)!;
  const limit = Math.min(parseInt(sp.get("limit") || "12", 10), 50);

  const cacheKey = buildCacheKey("crisis_areas_impact_v2", { preStart, preEnd, postStart, postEnd, limit });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const preDays = inclusiveDays(preStart, preEnd);
  const postDays = inclusiveDays(postStart, postEnd);

  interface AreaRow {
    area: string;
    pre_sales: number;
    post_sales: number;
    pre_avg_sqm: number;
    post_avg_sqm: number;
    price_change_pct: number;
  }

  const rows = await prisma.$queryRaw<AreaRow[]>(
    Prisma.sql`
      WITH pre AS (
        SELECT
          normalized_area AS area,
          COUNT(*)::int AS cnt,
          AVG(meter_sale_price) FILTER (WHERE meter_sale_price > 0)::double precision AS avg_sqm
        FROM transactions_live
        WHERE instance_date BETWEEN ${preStart}::date AND ${preEnd}::date
          AND trans_group_en = 'Sales'
        GROUP BY 1 HAVING COUNT(*) >= 50
      ), post AS (
        SELECT
          normalized_area AS area,
          COUNT(*)::int AS cnt,
          AVG(meter_sale_price) FILTER (WHERE meter_sale_price > 0)::double precision AS avg_sqm
        FROM transactions_live
        WHERE instance_date BETWEEN ${postStart}::date AND ${postEnd}::date
          AND trans_group_en = 'Sales'
        GROUP BY 1 HAVING COUNT(*) >= 10
      )
      SELECT
        pre.area,
        pre.cnt AS pre_sales,
        COALESCE(post.cnt, 0) AS post_sales,
        pre.avg_sqm AS pre_avg_sqm,
        COALESCE(post.avg_sqm, 0)::double precision AS post_avg_sqm,
        CASE WHEN post.avg_sqm IS NOT NULL AND pre.avg_sqm > 0
          THEN ROUND(((post.avg_sqm / pre.avg_sqm - 1) * 100)::numeric, 1)::double precision
          ELSE NULL
        END AS price_change_pct
      FROM pre LEFT JOIN post USING (area)
      ORDER BY pre.cnt DESC
      LIMIT ${limit}
    `
  );

  // Compute volume change based on daily rates, not raw counts
  const data = serializeForJson(
    rows.map((r) => {
      const preDailyRate = r.pre_sales / preDays;
      const postDailyRate = r.post_sales / postDays;
      const volumeChangePct = preDailyRate > 0
        ? Math.round(((postDailyRate / preDailyRate) - 1) * 1000) / 10
        : 0;
      return {
        ...r,
        pre_daily: Math.round(preDailyRate * 10) / 10,
        post_daily: Math.round(postDailyRate * 10) / 10,
        volume_change_pct: volumeChangePct,
        display_area: DISPLAY_NAME_MAP[r.area] || r.area,
      };
    })
  );

  const result = { data, meta: { preDays, postDays } };
  setCache(cacheKey, result, 1000 * 60 * 30);
  return NextResponse.json(result);
}
