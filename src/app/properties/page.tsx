"use client";

import { usePropertyTypes, useRooms, useDistribution } from "@/hooks/use-dashboard";
import { ChartContainer } from "@/components/charts/chart-container";
import { KPICard } from "@/components/kpi/kpi-card";
import { formatAED, formatNumber } from "@/lib/constants";
import { CHART_COLORS, PROPERTY_COLORS, ROOM_COLORS } from "@/lib/chart-colors";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = {
  Unit: PROPERTY_COLORS.Unit,
  Villa: PROPERTY_COLORS.Villa,
  Land: PROPERTY_COLORS.Land,
  Building: PROPERTY_COLORS.Building,
  grid: CHART_COLORS.grid,
  text: CHART_COLORS.text,
};

const ROOM_ORDER = ["Studio", "1 B/R", "2 B/R", "3 B/R", "4 B/R", "5 B/R"];

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

export default function PropertiesPage() {
  const { data: ptData, isLoading: ptLoading } = usePropertyTypes("2020-01");
  const { data: roomData, isLoading: roomLoading } = useRooms("2020-01");
  const { data: distData, isLoading: distLoading } = useDistribution({ dateFrom: "2025-01" });

  const propertyTypes = (ptData?.data || {}) as Record<
    string,
    Array<{ period: string; count: number; avg_price: number; avg_sqm_price: number }>
  >;
  const rooms = (roomData?.data || {}) as Record<
    string,
    Array<{ period: string; count: number; avg_price: number; avg_sqm_price: number }>
  >;
  const distribution = distData?.data || [];

  // Build unified monthly data for property type price trends
  const typeNames = ["Unit", "Villa", "Land", "Building"];
  const allPeriods = new Set<string>();
  for (const type of typeNames) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (propertyTypes[type] || []).forEach((d: any) => allPeriods.add(d.period));
  }
  const sortedPeriods = Array.from(allPeriods).sort();

  const typeTrendData = sortedPeriods.map((period) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = { period };
    for (const type of typeNames) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const match = (propertyTypes[type] || []).find((d: any) => d.period === period);
      if (match) row[type] = match.avg_sqm_price;
    }
    return row;
  });

  // KPI cards for each property type - latest month
  const typeKPIs = typeNames.map((type) => {
    const data = propertyTypes[type] || [];
    const latest = data[data.length - 1];
    const prev = data.length >= 2 ? data[data.length - 2] : null;
    return {
      type,
      count: latest?.count || 0,
      avg_sqm: latest?.avg_sqm_price || 0,
      mom: prev?.avg_sqm_price ? ((latest?.avg_sqm_price - prev.avg_sqm_price) / prev.avg_sqm_price) * 100 : null,
    };
  });

  // Bedroom price trend data
  const roomPeriods = new Set<string>();
  for (const room of ROOM_ORDER) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rooms[room] || []).forEach((d: any) => roomPeriods.add(d.period));
  }
  const sortedRoomPeriods = Array.from(roomPeriods).sort();

  const roomTrendData = sortedRoomPeriods.map((period) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = { period };
    for (const room of ROOM_ORDER) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const match = (rooms[room] || []).find((d: any) => d.period === period);
      if (match) row[room] = match.avg_sqm_price;
    }
    return row;
  });

  // Bedroom summary for latest period
  const roomSummary = ROOM_ORDER.map((room) => {
    const data = rooms[room] || [];
    const latest = data[data.length - 1];
    return {
      room,
      count: latest?.count || 0,
      avg_price: latest?.avg_price || 0,
      avg_sqm_price: latest?.avg_sqm_price || 0,
    };
  }).filter((r) => r.count > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Property Analysis</h2>
        <p className="text-sm text-muted-foreground mt-1">Breakdown by property type and bedrooms</p>
      </div>

      {/* Property Type KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {ptLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-lg border border-border bg-card animate-pulse" />
            ))
          : typeKPIs.map((kpi) => (
              <KPICard
                key={kpi.type}
                label={kpi.type}
                value={`${formatNumber(kpi.avg_sqm)} /sqm`}
                changeMom={kpi.mom}
                sparkline={
                  (propertyTypes[kpi.type] || [])
                    .slice(-12)
                    .map((d) => d.avg_sqm_price)
                }
              />
            ))}
      </div>

      {/* Property Type Price Trends */}
      <ChartContainer title="Price Trends by Property Type" subtitle="Avg price per sqm (AED)">
        {ptLoading ? (
          <div className="h-[350px] animate-pulse bg-muted/20 rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={typeTrendData}>
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: COLORS.text }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: COLORS.text }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              {typeNames.map((type) => (
                <Line
                  key={type}
                  type="monotone"
                  dataKey={type}
                  name={type}
                  stroke={COLORS[type as keyof typeof COLORS] as string}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bedroom Price Trends */}
        <ChartContainer title="Price by Bedroom Count" subtitle="Avg price/sqm monthly trend">
          {roomLoading ? (
            <div className="h-[350px] animate-pulse bg-muted/20 rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={roomTrendData}>
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: COLORS.text }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: COLORS.text }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                {ROOM_ORDER.map((room) => (
                  <Line
                    key={room}
                    type="monotone"
                    dataKey={room}
                    name={room}
                    stroke={ROOM_COLORS[room]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartContainer>

        {/* Bedroom Summary Bars */}
        <ChartContainer title="Avg Price by Bedroom" subtitle="Latest month">
          {roomSummary.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={roomSummary} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.text }} axisLine={false} tickFormatter={(v) => formatAED(v)} />
                <YAxis type="category" dataKey="room" tick={{ fontSize: 11, fill: COLORS.text }} width={55} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="avg_price" name="Avg Price" fill={COLORS.Unit} radius={[0, 4, 4, 0]}>
                  {roomSummary.map((r, i) => (
                    <Cell key={i} fill={ROOM_COLORS[r.room] || COLORS.Unit} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] animate-pulse bg-muted/20 rounded" />
          )}
        </ChartContainer>
      </div>

      {/* Price Distribution Histogram */}
      <ChartContainer title="Price Distribution" subtitle="Price per sqm histogram (2025+, all sales)">
        {distLoading ? (
          <div className="h-[300px] animate-pulse bg-muted/20 rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={distribution}>
              <XAxis
                dataKey="bin_start"
                tick={{ fontSize: 11, fill: COLORS.text }}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis tick={{ fontSize: 11, fill: COLORS.text }} tickLine={false} axisLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl">
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(d.bin_start)} - {formatNumber(d.bin_end)} AED/sqm
                      </p>
                      <p className="text-xs text-foreground">{formatNumber(d.count)} transactions</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" name="Transactions" fill={COLORS.Unit} fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartContainer>
    </div>
  );
}
