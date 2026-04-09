import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache } from "@/lib/cache";
import { HISTORICAL_CRISES } from "@/lib/constants";
import { serializeForJson } from "@/lib/sql";

const METRIC_COLUMN: Record<string, string> = {
  sales_count: "sales_count",
  sales_avg_sqm_price: "sales_avg_sqm_price",
  sales_volume: "sales_volume",
};

interface IndexedRow {
  period: string;
  sales_count: number;
  sales_avg_sqm_price: number;
  sales_volume: number;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const monthsAfter = parseInt(sp.get("monthsAfter") || "12", 10);
  const metric = sp.get("metric") || "sales_count";

  const metricColumn = METRIC_COLUMN[metric] || METRIC_COLUMN.sales_count;
  const cacheKey = `crisis_indexed:${monthsAfter}:${metricColumn}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const allStats = await prisma.$queryRaw<IndexedRow[]>(
    Prisma.sql`
      SELECT
        year_month AS period,
        sales_count::double precision AS sales_count,
        sales_avg_sqm_price::double precision AS sales_avg_sqm_price,
        sales_volume::double precision AS sales_volume
      FROM monthly_market_stats
      ORDER BY year_month
    `
  );

  const series: Record<string, { month: number; value: number }[]> = {};

  for (const crisis of HISTORICAL_CRISES) {
    const crisisYm = crisis.date.slice(0, 7);
    const baseIdx = allStats.findIndex((row) => row.period === crisisYm);
    if (baseIdx < 0) continue;

    const baseValue = allStats[baseIdx][metricColumn as keyof IndexedRow] as number;
    if (!baseValue || baseValue === 0) continue;

    const points: { month: number; value: number }[] = [];
    for (let offset = -3; offset <= monthsAfter; offset += 1) {
      const idx = baseIdx + offset;
      if (idx < 0 || idx >= allStats.length) continue;
      const value = allStats[idx][metricColumn as keyof IndexedRow] as number;
      if (value == null) continue;
      points.push({ month: offset, value: (value / baseValue) * 100 });
    }
    series[crisis.id] = points;
  }

  const result = serializeForJson({
    data: series,
    meta: {
      crises: HISTORICAL_CRISES,
      metric: metricColumn,
      monthsAfter,
      baseDescription: "Index = 100 at crisis month",
      period_type: "complete_month",
    },
  });

  setCache(cacheKey, result);
  return NextResponse.json(result);
}
