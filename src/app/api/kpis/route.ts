import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache, buildCacheKey } from "@/lib/cache";
import { getLatestCompleteYearMonth, sameMonthLastYear, serializeForJson, shiftYearMonth } from "@/lib/sql";

interface MonthlyRow {
  period: string;
  sales_count: number;
  sales_volume: number;
  sales_avg_sqm_price: number;
  sales_avg_price: number;
  offplan_ratio: number;
  sales_avg_area: number;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const cacheKey = buildCacheKey("kpis", Object.fromEntries(sp.entries()));
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const latestPeriod = await getLatestCompleteYearMonth(prisma);
  if (!latestPeriod) return NextResponse.json({ data: null });

  const prevPeriod = shiftYearMonth(latestPeriod, -1);
  const yoyPeriod = sameMonthLastYear(latestPeriod);
  const sparklineStart = shiftYearMonth(latestPeriod, -11);

  const [periodRows, sparklineRows] = await Promise.all([
    prisma.$queryRaw<MonthlyRow[]>(Prisma.sql`
      SELECT
        year_month AS period,
        sales_count::int AS sales_count,
        sales_volume::double precision AS sales_volume,
        sales_avg_sqm_price::double precision AS sales_avg_sqm_price,
        sales_avg_price::double precision AS sales_avg_price,
        offplan_ratio::double precision AS offplan_ratio,
        sales_avg_area::double precision AS sales_avg_area
      FROM monthly_market_stats
      WHERE year_month IN (${Prisma.join([latestPeriod, prevPeriod, yoyPeriod])})
    `),
    prisma.$queryRaw<MonthlyRow[]>(Prisma.sql`
      SELECT
        year_month AS period,
        sales_count::int AS sales_count,
        sales_volume::double precision AS sales_volume,
        sales_avg_sqm_price::double precision AS sales_avg_sqm_price,
        sales_avg_price::double precision AS sales_avg_price,
        offplan_ratio::double precision AS offplan_ratio,
        sales_avg_area::double precision AS sales_avg_area
      FROM monthly_market_stats
      WHERE year_month BETWEEN ${sparklineStart} AND ${latestPeriod}
      ORDER BY year_month
    `),
  ]);

  const byPeriod = new Map(periodRows.map((row) => [row.period, row]));
  const latest = byPeriod.get(latestPeriod);
  const prev = byPeriod.get(prevPeriod);
  const yoy = byPeriod.get(yoyPeriod);

  if (!latest) return NextResponse.json({ data: null });

  const pct = (curr: number, base?: number | null) =>
    base && base > 0 ? ((curr - base) / base) * 100 : null;

  const data = serializeForJson({
    period: latestPeriod,
    period_type: "complete_month",
    kpis: [
      {
        label: "Monthly Sales",
        value: latest.sales_count,
        change_mom: pct(latest.sales_count, prev?.sales_count),
        change_yoy: pct(latest.sales_count, yoy?.sales_count),
        change_kind: "percent",
        period_type: "complete_month",
        sparkline: sparklineRows.map((row) => row.sales_count),
      },
      {
        label: "Sales Volume",
        value: latest.sales_volume,
        change_mom: pct(latest.sales_volume, prev?.sales_volume),
        change_yoy: pct(latest.sales_volume, yoy?.sales_volume),
        change_kind: "percent",
        period_type: "complete_month",
        sparkline: sparklineRows.map((row) => row.sales_volume),
      },
      {
        label: "Avg Price/sqm",
        value: latest.sales_avg_sqm_price,
        change_mom: pct(latest.sales_avg_sqm_price, prev?.sales_avg_sqm_price),
        change_yoy: pct(latest.sales_avg_sqm_price, yoy?.sales_avg_sqm_price),
        change_kind: "percent",
        period_type: "complete_month",
        sparkline: sparklineRows.map((row) => row.sales_avg_sqm_price),
      },
      {
        label: "Avg Transaction",
        value: latest.sales_avg_price,
        change_mom: pct(latest.sales_avg_price, prev?.sales_avg_price),
        change_yoy: pct(latest.sales_avg_price, yoy?.sales_avg_price),
        change_kind: "percent",
        period_type: "complete_month",
        sparkline: sparklineRows.map((row) => row.sales_avg_price),
      },
      {
        label: "Off-Plan Ratio",
        value: latest.offplan_ratio * 100,
        change_mom: prev ? (latest.offplan_ratio - prev.offplan_ratio) * 100 : null,
        change_yoy: yoy ? (latest.offplan_ratio - yoy.offplan_ratio) * 100 : null,
        change_kind: "percentage_points",
        period_type: "complete_month",
        sparkline: sparklineRows.map((row) => row.offplan_ratio * 100),
      },
      {
        label: "Avg Size (sqm)",
        value: latest.sales_avg_area,
        change_mom: pct(latest.sales_avg_area, prev?.sales_avg_area),
        change_yoy: pct(latest.sales_avg_area, yoy?.sales_avg_area),
        change_kind: "percent",
        period_type: "complete_month",
        sparkline: sparklineRows.map((row) => row.sales_avg_area),
      },
      {
        label: "YoY Volume",
        value: pct(latest.sales_count, yoy?.sales_count) || 0,
        change_mom: null,
        change_yoy: null,
        change_kind: "percent",
        period_type: "complete_month",
        sparkline: [],
      },
      {
        label: "YoY Price",
        value: pct(latest.sales_avg_sqm_price, yoy?.sales_avg_sqm_price) || 0,
        change_mom: null,
        change_yoy: null,
        change_kind: "percent",
        period_type: "complete_month",
        sparkline: [],
      },
    ],
  });

  setCache(cacheKey, data);
  return NextResponse.json(data);
}
