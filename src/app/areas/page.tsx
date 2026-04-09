"use client";

import { useState } from "react";
import { useAreas, useAreaDetail } from "@/hooks/use-dashboard";
import { ChartContainer } from "@/components/charts/chart-container";
import { formatAED, formatNumber, formatPricePerSqm } from "@/lib/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { CHART_COLORS as COLORS, PIE_COLORS } from "@/lib/chart-colors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-foreground mb-1">{d.display_area}</p>
      <p className="text-xs text-muted-foreground">Avg/sqm: {formatPricePerSqm(d.avg_sqm_price)}</p>
      <p className="text-xs text-muted-foreground">YoY: {d.yoy_price_change?.toFixed(1)}%</p>
      <p className="text-xs text-muted-foreground">Volume: {formatNumber(d.sales_count)}</p>
    </div>
  );
}

function ChangeCell({ value }: { value: number | null }) {
  if (value == null) return <TableCell className="text-muted-foreground text-xs">-</TableCell>;
  return (
    <TableCell className={cn("text-xs", value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-muted-foreground")}>
      {value > 0 ? "+" : ""}{value.toFixed(1)}%
    </TableCell>
  );
}

interface AreaRow {
  normalized_area: string;
  display_area: string;
  sales_count: number;
  sales_volume: number;
  avg_sqm_price: number;
  avg_area_sqm: number;
  offplan_ratio: number;
  mom_volume_change: number | null;
  yoy_volume_change: number | null;
  mom_price_change: number | null;
  yoy_price_change: number | null;
}

export default function AreasPage() {
  const { data: areasData, isLoading } = useAreas(50);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const { data: detailData } = useAreaDetail(selectedArea || "");

  const areas: AreaRow[] = areasData?.data || [];
  const detail = detailData?.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Area Analysis</h2>
        <p className="text-sm text-muted-foreground mt-1">Performance by location — click a row for details</p>
      </div>

      {/* Scatter Plot */}
      <ChartContainer title="Area Comparison" subtitle="Price vs YoY change (bubble size = volume)">
        {areas.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart>
              <XAxis type="number" dataKey="avg_sqm_price" name="Avg/sqm" tick={{ fontSize: 11, fill: COLORS.text }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} />
              <YAxis type="number" dataKey="yoy_price_change" name="YoY %" tick={{ fontSize: 11, fill: COLORS.text }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <ZAxis type="number" dataKey="sales_count" range={[40, 400]} />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter
                data={areas.filter((a) => a.yoy_price_change != null)}
                fill={COLORS.primary}
                fillOpacity={0.6}
                stroke={COLORS.primary}
              />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] animate-pulse bg-muted/20 rounded" />
        )}
      </ChartContainer>

      {/* Area Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="h-[400px] animate-pulse bg-muted/20" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase tracking-wider">Area</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">Sales</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">MoM</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">YoY</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">Volume (AED)</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">Avg/sqm</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">Price MoM</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">Price YoY</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">Off-Plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((area) => (
                  <TableRow
                    key={area.normalized_area}
                    className={cn(
                      "cursor-pointer border-border",
                      selectedArea === area.normalized_area && "bg-accent"
                    )}
                    onClick={() => setSelectedArea(
                      selectedArea === area.normalized_area ? null : area.normalized_area
                    )}
                  >
                    <TableCell className="font-medium text-sm">{area.display_area}</TableCell>
                    <TableCell className="text-right text-xs">{formatNumber(area.sales_count)}</TableCell>
                    <ChangeCell value={area.mom_volume_change} />
                    <ChangeCell value={area.yoy_volume_change} />
                    <TableCell className="text-right text-xs">{formatAED(area.sales_volume)}</TableCell>
                    <TableCell className="text-right text-xs">{formatNumber(area.avg_sqm_price)}</TableCell>
                    <ChangeCell value={area.mom_price_change} />
                    <ChangeCell value={area.yoy_price_change} />
                    <TableCell className="text-right text-xs">{(area.offplan_ratio * 100).toFixed(0)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Area Deep-Dive */}
      {selectedArea && detail && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">{detail.display_area} — Deep Dive</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Trend */}
            <ChartContainer title="Price Trend" subtitle="Avg price per sqm (monthly)">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={detail.trends}>
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: COLORS.text }} tickLine={false} interval="preserveStartEnd" axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: COLORS.text }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="avg_sqm_price" name="Avg/sqm" stroke={COLORS.primary} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Volume Bar Chart */}
            <ChartContainer title="Sales Volume" subtitle="Monthly transaction count">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={detail.trends}>
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: COLORS.text }} tickLine={false} interval="preserveStartEnd" axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: COLORS.text }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="sales_count" name="Sales" fill={COLORS.secondary} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Room Breakdown */}
            <ChartContainer title="By Room Type" subtitle="Avg price and count (last 3 months)">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={detail.room_breakdown} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.text }} tickFormatter={(v) => formatAED(v)} axisLine={false} />
                  <YAxis type="category" dataKey="room" tick={{ fontSize: 11, fill: COLORS.text }} width={60} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="avg_price" name="Avg Price" fill={COLORS.tertiary} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Type Breakdown Pie */}
            <ChartContainer title="Property Sub-Types" subtitle="Distribution (last 3 months)">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={detail.type_breakdown.slice(0, 6)} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="count" nameKey="type">
                    {detail.type_breakdown.slice(0, 6).map((_: unknown, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>

          {/* Top Projects Table */}
          {detail.top_projects?.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <h4 className="text-sm font-semibold">Top Projects in {detail.display_area}</h4>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase">Project</TableHead>
                    <TableHead className="text-[11px] uppercase text-right">Sales</TableHead>
                    <TableHead className="text-[11px] uppercase text-right">Volume</TableHead>
                    <TableHead className="text-[11px] uppercase text-right">Avg Price</TableHead>
                    <TableHead className="text-[11px] uppercase text-right">Avg/sqm</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.top_projects.map((p: { project: string; count: number; volume: number; avg_price: number; avg_sqm_price: number }) => (
                    <TableRow key={p.project} className="border-border">
                      <TableCell className="font-medium text-sm">{p.project}</TableCell>
                      <TableCell className="text-right text-xs">{formatNumber(p.count)}</TableCell>
                      <TableCell className="text-right text-xs">{formatAED(p.volume)}</TableCell>
                      <TableCell className="text-right text-xs">{formatAED(p.avg_price)}</TableCell>
                      <TableCell className="text-right text-xs">{formatNumber(p.avg_sqm_price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
