import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import {
  PRE_CRISIS_START,
  PRE_CRISIS_END,
  POST_CRISIS_START,
  POST_CRISIS_END,
} from "@/lib/constants";
import { normalizedPropertyTypeSql, serializeForJson, toDateStart, toDateEnd } from "@/lib/sql";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const preStart = toDateStart(sp.get("preStart") || PRE_CRISIS_START)!;
  const preEnd = toDateEnd(sp.get("preEnd") || PRE_CRISIS_END)!;
  const postStart = toDateStart(sp.get("postStart") || POST_CRISIS_START)!;
  const postEnd = toDateEnd(sp.get("postEnd") || POST_CRISIS_END)!;

  const cacheKey = buildCacheKey("crisis_sectors", { preStart, preEnd, postStart, postEnd });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const rows = await prisma.$queryRaw(
    Prisma.sql`
      WITH pre AS (
        SELECT
          ${normalizedPropertyTypeSql("transactions_live")} AS type,
          is_offplan AS offplan,
          COUNT(*)::int AS cnt,
          AVG(meter_sale_price) FILTER (WHERE meter_sale_price > 0)::double precision AS avg_sqm
        FROM transactions_live
        WHERE instance_date BETWEEN ${preStart}::date AND ${preEnd}::date
          AND trans_group_en = 'Sales'
        GROUP BY 1, 2
      ), post AS (
        SELECT
          ${normalizedPropertyTypeSql("transactions_live")} AS type,
          is_offplan AS offplan,
          COUNT(*)::int AS cnt,
          AVG(meter_sale_price) FILTER (WHERE meter_sale_price > 0)::double precision AS avg_sqm
        FROM transactions_live
        WHERE instance_date BETWEEN ${postStart}::date AND ${postEnd}::date
          AND trans_group_en = 'Sales'
        GROUP BY 1, 2
      )
      SELECT
        COALESCE(pre.type, post.type) AS type,
        COALESCE(pre.offplan, post.offplan) AS offplan,
        COALESCE(pre.cnt, 0) AS pre_count,
        COALESCE(post.cnt, 0) AS post_count,
        CASE WHEN pre.cnt > 0 THEN ROUND(((COALESCE(post.cnt, 0)::numeric / pre.cnt - 1) * 100)::numeric, 1)::double precision ELSE NULL END AS volume_change_pct,
        pre.avg_sqm AS pre_avg_sqm,
        post.avg_sqm AS post_avg_sqm,
        CASE WHEN pre.avg_sqm > 0 THEN ROUND(((COALESCE(post.avg_sqm, 0) / pre.avg_sqm - 1) * 100)::numeric, 1)::double precision ELSE NULL END AS price_change_pct
      FROM pre FULL OUTER JOIN post USING (type, offplan)
      ORDER BY COALESCE(pre.cnt, 0) DESC
    `
  );

  const result = serializeForJson({ data: rows });
  setCache(cacheKey, result, 1000 * 60 * 30);
  return NextResponse.json(result);
}
