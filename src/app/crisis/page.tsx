"use client";

import {
  useCrisisComparison,
  useCrisisIndexed,
  useCrisisResilience,
  useVolumetrends,
  useOffplanTrends,
} from "@/hooks/use-dashboard";
import { ChartContainer } from "@/components/charts/chart-container";
import {
  formatAED,
  formatNumber,
  formatPercentagePoints,
  formatPricePerSqm,
  formatSqm,
  CRISIS_DATE,
  HISTORICAL_CRISES,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useState } from "react";
import { useChartColors, CRISIS_LINE_COLORS as CRISIS_COLORS } from "@/lib/chart-colors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function CrisisPage() {
  const COLORS = useChartColors();
  const { data: compData } = useCrisisComparison();
  const [indexedMetric, setIndexedMetric] = useState("sales_count");
  const { data: indexedData } = useCrisisIndexed(indexedMetric, 12);
  const { data: resilienceData } = useCrisisResilience();
  const { data: volumeData } = useVolumetrends("2019-01");
  const { data: offplanData } = useOffplanTrends("2019-01");

  const crisisMetrics = compData?.data || [];
  const indexedSeries = indexedData?.data || {};
  const resilience = resilienceData?.data || [];
  const volumeTrend = volumeData?.data || [];
  const offplanTrend = offplanData?.data || [];

  // Build indexed chart data
  const allMonths = new Set<number>();
  for (const series of Object.values(indexedSeries) as { month: number; value: number }[][]) {
    for (const point of series) {
      allMonths.add(point.month);
    }
  }
  const sortedMonths = Array.from(allMonths).sort((a, b) => a - b);

  const indexedChartData = sortedMonths.map((month) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = { month: `M${month >= 0 ? "+" : ""}${month}` };
    for (const [crisisId, series] of Object.entries(indexedSeries) as [string, { month: number; value: number }[]][]) {
      const point = series.find((p: { month: number }) => p.month === month);
      if (point) row[crisisId] = point.value;
    }
    return row;
  });

  // Build sentiment proxy data: monthly volume + offplan ratio + mortgage count
  const sentimentData = volumeTrend.map((v: { period: string; count: number; mortgage_count: number }) => {
    const offplan = offplanTrend.find((o: { period: string }) => o.period === v.period);
    return {
      period: v.period,
      volume: v.count,
      mortgage: v.mortgage_count,
      offplan_ratio: offplan ? (offplan.offplan_ratio * 100) : null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Crisis Monitor</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Hormuz Strait Disruption Impact — March 2026 onwards
          </p>
        </div>
      </div>

      {/* Before/After Panel */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
          <h3 className="text-sm font-semibold text-amber-400">Before vs After Comparison</h3>
          <span className="text-[10px] text-muted-foreground">
            Pre: Dec 1, 2025 - Feb 28, 2026 | Post: Mar 1 - Apr 8, 2026
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
          {crisisMetrics.map((m: { metric: string; pre_value: number; post_value: number; change_pct: number; change_kind?: "percent" | "percentage_points" }) => {
            const isPositive = m.change_pct > 0;
            const isNeutral = Math.abs(m.change_pct) < 0.5;
            const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
            return (
              <div key={m.metric} className="rounded-md border border-border bg-card p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                  {m.metric}
                </p>
                <div className="flex items-end gap-2">
                  <span
                    className={cn(
                      "text-xl font-semibold",
                      isNeutral ? "text-foreground" : isPositive ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {m.change_kind === "percentage_points"
                      ? formatPercentagePoints(m.change_pct)
                      : `${m.change_pct.toFixed(1)}%`}
                  </span>
                  <Icon
                    className={cn(
                      "w-4 h-4 mb-0.5",
                      isNeutral ? "text-muted-foreground" : isPositive ? "text-emerald-400" : "text-red-400"
                    )}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <span>
                    Pre:{" "}
                    {m.metric.includes("Value")
                      ? formatAED(m.pre_value)
                      : m.metric.includes("Price/sqm")
                        ? formatPricePerSqm(m.pre_value)
                        : m.metric.includes("Size")
                          ? formatSqm(m.pre_value)
                          : m.metric.includes("Ratio")
                        ? `${m.pre_value.toFixed(1)}%`
                        : formatNumber(m.pre_value)}
                  </span>
                  <span>
                    Post:{" "}
                    {m.metric.includes("Value")
                      ? formatAED(m.post_value)
                      : m.metric.includes("Price/sqm")
                        ? formatPricePerSqm(m.post_value)
                        : m.metric.includes("Size")
                          ? formatSqm(m.post_value)
                          : m.metric.includes("Ratio")
                        ? `${m.post_value.toFixed(1)}%`
                        : formatNumber(m.post_value)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Investor Sentiment Proxy */}
      <ChartContainer
        title="Market Sentiment Proxy"
        subtitle="Sales volume, mortgage activity, and off-plan ratio over time"
      >
        {sentimentData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={sentimentData}>
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: COLORS.text }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: COLORS.text }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: COLORS.text }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine
                x={CRISIS_DATE.slice(0, 7)}
                yAxisId="left"
                stroke="#f5a623"
                strokeDasharray="4 4"
                label={{ value: "Hormuz", fill: "#f5a623", fontSize: 10, position: "top" }}
              />
              <Line yAxisId="left" type="monotone" dataKey="volume" name="Sales Volume" stroke={COLORS.primary} strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="mortgage" name="Mortgage" stroke={COLORS.purple} strokeWidth={1.5} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="offplan_ratio" name="Off-Plan %" stroke={COLORS.tertiary} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[350px] animate-pulse bg-muted/20 rounded" />
        )}
      </ChartContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Historical Crisis Comparison */}
        <ChartContainer
          title="Historical Crisis Comparison"
          subtitle="Indexed to 100 at crisis onset"
          action={
            <select
              value={indexedMetric}
              onChange={(e) => setIndexedMetric(e.target.value)}
              className="text-xs bg-secondary text-foreground border border-border rounded px-2 py-1"
            >
              <option value="sales_count">Sales Volume</option>
              <option value="sales_avg_sqm_price">Avg Price/sqm</option>
              <option value="sales_volume">Total Value</option>
            </select>
          }
        >
          {indexedChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={indexedChartData}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.text }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.text }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={100} stroke={COLORS.muted} strokeDasharray="3 3" />
                {HISTORICAL_CRISES.map((c) => (
                  <Line
                    key={c.id}
                    type="monotone"
                    dataKey={c.id}
                    name={c.label}
                    stroke={CRISIS_COLORS[c.id]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] animate-pulse bg-muted/20 rounded" />
          )}
        </ChartContainer>

        {/* Area Resilience Table */}
        <ChartContainer title="Area Resilience Ranking" subtitle="Price & volume stability post-crisis">
          <div className="overflow-auto max-h-[340px]">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase">#</TableHead>
                  <TableHead className="text-[10px] uppercase">Area</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Price Chg</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Vol Chg</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resilience.map((r: {
                  area: string;
                  display_area: string;
                  price_change: number;
                  volume_change: number;
                  resilience_score: number;
                }, i: number) => (
                  <TableRow key={r.area} className="border-border">
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-xs font-medium">{r.display_area}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-xs",
                        r.price_change > 0 ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {r.price_change > 0 ? "+" : ""}
                      {r.price_change.toFixed(1)}%
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-xs",
                        r.volume_change > 0 ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {r.volume_change > 0 ? "+" : ""}
                      {r.volume_change.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      {r.resilience_score.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ChartContainer>
      </div>
    </div>
  );
}
