import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { PRE_CRISIS_END, PRE_CRISIS_START, POST_CRISIS_END, POST_CRISIS_START } from "@/lib/constants";
import { serializeForJson, toDateEnd, toDateStart } from "@/lib/sql";

interface ResilienceRow {
  area: string;
  display_area: string;
  avg_price: number;
  sales_count: number;
}

function inclusiveDays(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime();
  return Math.floor((endMs - startMs) / 86400000) + 1;
}

async function areaStats(start: string, end: string) {
  return prisma.$queryRaw<ResilienceRow[]>(
    Prisma.sql`
      SELECT
        normalized_area AS area,
        MIN(display_area) AS display_area,
        AVG(meter_sale_price) FILTER (WHERE meter_sale_price > 0)::double precision AS avg_price,
        COUNT(*)::int AS sales_count
      FROM transactions_live
      WHERE trans_group_en = 'Sales'
        AND instance_date BETWEEN ${start}::date AND ${end}::date
      GROUP BY normalized_area
    `
  );
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const preStart = toDateStart(sp.get("preStart") || PRE_CRISIS_START)!;
  const preEnd = toDateEnd(sp.get("preEnd") || PRE_CRISIS_END)!;
  const postStart = toDateStart(sp.get("postStart") || POST_CRISIS_START)!;
  const postEnd = toDateEnd(sp.get("postEnd") || POST_CRISIS_END)!;
  const limit = parseInt(sp.get("limit") || "20", 10);

  const cacheKey = buildCacheKey("crisis_resilience", { preStart, preEnd, postStart, postEnd, limit });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const [preRows, postRows] = await Promise.all([areaStats(preStart, preEnd), areaStats(postStart, postEnd)]);
  const preMap = new Map(preRows.map((row) => [row.area, row]));
  const postMap = new Map(postRows.map((row) => [row.area, row]));
  const preDays = inclusiveDays(preStart, preEnd);
  const postDays = inclusiveDays(postStart, postEnd);

  const areas = Array.from(preMap.entries())
    .map(([area, pre]) => {
      const post = postMap.get(area);
      if (!post || !pre.avg_price || !pre.sales_count) return null;

      const preRate = pre.sales_count / preDays;
      const postRate = post.sales_count / postDays;
      const priceChange = ((post.avg_price - pre.avg_price) / pre.avg_price) * 100;
      const volumeChange = preRate > 0 ? ((postRate - preRate) / preRate) * 100 : 0;
      const resilienceScore = priceChange * 0.6 + volumeChange * 0.4;

      return {
        area,
        display_area: pre.display_area,
        pre_price: pre.avg_price,
        post_price: post.avg_price,
        price_change: priceChange,
        pre_volume: preRate,
        post_volume: postRate,
        volume_change: volumeChange,
        resilience_score: resilienceScore,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b?.resilience_score || 0) - (a?.resilience_score || 0))
    .slice(0, limit);

  const result = serializeForJson({
    data: areas,
    meta: { preStart, preEnd, postStart, postEnd, period_type: "date_window" },
  });
  setCache(cacheKey, result, 1000 * 60 * 30);
  return NextResponse.json(result);
}
