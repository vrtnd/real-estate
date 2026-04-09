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

  const cacheKey = buildCacheKey("crisis_projects_impact", { preStart, preEnd, postStart, postEnd });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const preDays = inclusiveDays(preStart, preEnd);
  const postDays = inclusiveDays(postStart, postEnd);

  interface ProjectRow {
    project_name_en: string;
    pre_sales: number;
    post_sales: number;
  }

  const rows = await prisma.$queryRaw<ProjectRow[]>(
    Prisma.sql`
      WITH pre AS (
        SELECT project_name_en, COUNT(*)::int AS cnt
        FROM transactions_live
        WHERE instance_date BETWEEN ${preStart}::date AND ${preEnd}::date
          AND trans_group_en = 'Sales' AND project_name_en != ''
        GROUP BY 1 HAVING COUNT(*) >= 30
      ), post AS (
        SELECT project_name_en, COUNT(*)::int AS cnt
        FROM transactions_live
        WHERE instance_date BETWEEN ${postStart}::date AND ${postEnd}::date
          AND trans_group_en = 'Sales' AND project_name_en != ''
        GROUP BY 1
      )
      SELECT
        pre.project_name_en,
        pre.cnt AS pre_sales,
        COALESCE(post.cnt, 0) AS post_sales
      FROM pre LEFT JOIN post USING (project_name_en)
      ORDER BY pre.cnt DESC
    `
  );

  const withRates = rows.map((r) => {
    const preDaily = r.pre_sales / preDays;
    const postDaily = r.post_sales / postDays;
    const changePct = preDaily > 0 ? Math.round(((postDaily / preDaily) - 1) * 100) : 0;
    return {
      project: r.project_name_en,
      pre_daily: Math.round(preDaily * 10) / 10,
      post_daily: Math.round(postDaily * 10) / 10,
      change_pct: changePct,
    };
  });

  const winners = withRates.filter((p) => p.change_pct > 0).sort((a, b) => b.change_pct - a.change_pct).slice(0, 8);
  const losers = withRates.filter((p) => p.change_pct <= 0).sort((a, b) => a.change_pct - b.change_pct).slice(0, 8);

  const result = serializeForJson({ winners, losers, meta: { preDays, postDays } });
  setCache(cacheKey, result, 1000 * 60 * 30);
  return NextResponse.json(result);
}
