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
import { serializeForJson, toDateEnd, toDateStart } from "@/lib/sql";

interface WindowStatsRow {
  sales_count: number;
  sales_value: number;
  avg_price_sqm: number;
  offplan_ratio: number;
  mortgage_count: number;
  ready_share: number;
  resale_daily_rate: number;
  ready_avg_price: number;
  mid_luxury_count: number;
}

function inclusiveDays(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime();
  return Math.floor((endMs - startMs) / 86400000) + 1;
}

async function getWindowStats(start: string, end: string, days: number) {
  const rows = await prisma.$queryRaw<WindowStatsRow[]>(
    Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE trans_group_en = 'Sales')::int AS sales_count,
        COALESCE(SUM(amount) FILTER (WHERE trans_group_en = 'Sales'), 0)::double precision AS sales_value,
        AVG(meter_sale_price) FILTER (
          WHERE trans_group_en = 'Sales' AND meter_sale_price > 0
        )::double precision AS avg_price_sqm,
        CASE
          WHEN COUNT(*) FILTER (WHERE trans_group_en = 'Sales') > 0 THEN
            COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Off-Plan')::double precision
            / COUNT(*) FILTER (WHERE trans_group_en = 'Sales')
          ELSE 0
        END AS offplan_ratio,
        COUNT(*) FILTER (WHERE trans_group_en = 'Mortgage')::int AS mortgage_count,
        -- Ready market share
        CASE
          WHEN COUNT(*) FILTER (WHERE trans_group_en = 'Sales') > 0 THEN
            COUNT(*) FILTER (WHERE trans_group_en = 'Sales' AND is_offplan = 'Ready')::double precision
            / COUNT(*) FILTER (WHERE trans_group_en = 'Sales')
          ELSE 0
        END AS ready_share,
        -- Resale (secondary) daily count
        (COUNT(*) FILTER (
          WHERE trans_group_en = 'Sales'
            AND (procedure_name_en ILIKE '%sell%' OR procedure_name_en ILIKE '%sale%')
            AND procedure_name_en NOT ILIKE '%pre-registration%'
            AND procedure_name_en NOT ILIKE '%pre registration%'
        )::double precision / ${days}) AS resale_daily_rate,
        -- Ready property avg price
        AVG(amount) FILTER (
          WHERE trans_group_en = 'Sales' AND is_offplan = 'Ready'
        )::double precision AS ready_avg_price,
        -- 3M-5M band count
        COUNT(*) FILTER (
          WHERE trans_group_en = 'Sales' AND amount >= 3000000 AND amount < 5000000
        )::int AS mid_luxury_count
      FROM transactions_live
      WHERE instance_date BETWEEN ${start}::date AND ${end}::date
    `
  );

  return rows[0];
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const preStart = toDateStart(sp.get("preStart") || PRE_CRISIS_START)!;
  const preEnd = toDateEnd(sp.get("preEnd") || PRE_CRISIS_END)!;
  const postStart = toDateStart(sp.get("postStart") || POST_CRISIS_START)!;
  const postEnd = toDateEnd(sp.get("postEnd") || POST_CRISIS_END)!;

  const cacheKey = buildCacheKey("crisis_comparison", { preStart, preEnd, postStart, postEnd });
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const preDays = inclusiveDays(preStart, preEnd);
  const postDays = inclusiveDays(postStart, postEnd);
  const [preStats, postStats] = await Promise.all([getWindowStats(preStart, preEnd, preDays), getWindowStats(postStart, postEnd, postDays)]);

  const pct = (post: number, pre: number) => (pre > 0 ? ((post - pre) / pre) * 100 : 0);

  const metrics = [
    {
      metric: "Daily Sales Count",
      pre_value: preStats.sales_count / preDays,
      post_value: postStats.sales_count / postDays,
      change_pct: pct(postStats.sales_count / postDays, preStats.sales_count / preDays),
      change_kind: "percent",
      period_type: "date_window",
    },
    {
      metric: "Daily Sales Value (AED)",
      pre_value: preStats.sales_value / preDays,
      post_value: postStats.sales_value / postDays,
      change_pct: pct(postStats.sales_value / postDays, preStats.sales_value / preDays),
      change_kind: "percent",
      period_type: "date_window",
    },
    {
      metric: "Avg Price/sqm",
      pre_value: preStats.avg_price_sqm,
      post_value: postStats.avg_price_sqm,
      change_pct: pct(postStats.avg_price_sqm, preStats.avg_price_sqm),
      change_kind: "percent",
      period_type: "date_window",
    },
    {
      metric: "Off-Plan Ratio",
      pre_value: preStats.offplan_ratio * 100,
      post_value: postStats.offplan_ratio * 100,
      change_pct: (postStats.offplan_ratio - preStats.offplan_ratio) * 100,
      change_kind: "percentage_points",
      period_type: "date_window",
    },
    {
      metric: "Daily Mortgage Count",
      pre_value: preStats.mortgage_count / preDays,
      post_value: postStats.mortgage_count / postDays,
      change_pct: pct(postStats.mortgage_count / postDays, preStats.mortgage_count / preDays),
      change_kind: "percent",
      period_type: "date_window",
    },
    {
      metric: "Ready Market Share",
      pre_value: preStats.ready_share * 100,
      post_value: postStats.ready_share * 100,
      change_pct: (postStats.ready_share - preStats.ready_share) * 100,
      change_kind: "percentage_points",
      period_type: "date_window",
    },
    {
      metric: "Daily Resale Volume",
      pre_value: preStats.resale_daily_rate,
      post_value: postStats.resale_daily_rate,
      change_pct: pct(postStats.resale_daily_rate, preStats.resale_daily_rate),
      change_kind: "percent",
      period_type: "date_window",
    },
    {
      metric: "Ready Avg Price (AED)",
      pre_value: preStats.ready_avg_price,
      post_value: postStats.ready_avg_price,
      change_pct: pct(postStats.ready_avg_price, preStats.ready_avg_price),
      change_kind: "percent",
      period_type: "date_window",
    },
    {
      metric: "Mid-Luxury (3-5M) Daily",
      pre_value: preStats.mid_luxury_count / preDays,
      post_value: postStats.mid_luxury_count / postDays,
      change_pct: pct(postStats.mid_luxury_count / postDays, preStats.mid_luxury_count / preDays),
      change_kind: "percent",
      period_type: "date_window",
    },
  ];

  const result = serializeForJson({
    data: metrics,
    meta: { preStart, preEnd, postStart, postEnd, preDays, postDays, period_type: "date_window" },
  });

  setCache(cacheKey, result, 1000 * 60 * 30);
  return NextResponse.json(result);
}
