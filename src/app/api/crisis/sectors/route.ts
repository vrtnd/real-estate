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

function inclusiveDays(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00.000Z`).getTime();
  const e = new Date(`${end}T00:00:00.000Z`).getTime();
  return Math.floor((e - s) / 86400000) + 1;
}

interface SectorRow {
  type: string;
  offplan: string;
  pre_count: number;
  post_count: number;
  pre_avg_sqm: number | null;
  post_avg_sqm: number | null;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const preStart = toDateStart(sp.get("preStart") || PRE_CRISIS_START)!;
  const preEnd = toDateEnd(sp.get("preEnd") || PRE_CRISIS_END)!;
  const postStart = toDateStart(sp.get("postStart") || POST_CRISIS_START)!;
  const postEnd = toDateEnd(sp.get("postEnd") || POST_CRISIS_END)!;

  const cacheKey = buildCacheKey("crisis_sectors_v2", { preStart, preEnd, postStart, postEnd });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const preDays = inclusiveDays(preStart, preEnd);
  const postDays = inclusiveDays(postStart, postEnd);

  const rows = await prisma.$queryRaw<SectorRow[]>(
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
        COALESCE(pre.cnt, 0)::int AS pre_count,
        COALESCE(post.cnt, 0)::int AS post_count,
        pre.avg_sqm AS pre_avg_sqm,
        post.avg_sqm AS post_avg_sqm
      FROM pre FULL OUTER JOIN post USING (type, offplan)
      ORDER BY COALESCE(pre.cnt, 0) DESC
    `
  );

  const data = serializeForJson(
    rows.map((r) => {
      const preDaily = r.pre_count / preDays;
      const postDaily = r.post_count / postDays;
      const volumeChangePct = preDaily > 0
        ? Math.round(((postDaily / preDaily) - 1) * 1000) / 10
        : null;
      const priceChangePct = r.pre_avg_sqm && r.post_avg_sqm && r.pre_avg_sqm > 0
        ? Math.round(((r.post_avg_sqm / r.pre_avg_sqm) - 1) * 1000) / 10
        : null;
      return {
        ...r,
        volume_change_pct: volumeChangePct,
        price_change_pct: priceChangePct,
      };
    })
  );

  const result = { data };
  setCache(cacheKey, result, 1000 * 60 * 30);
  return NextResponse.json(result);
}
