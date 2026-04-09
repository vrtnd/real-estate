"use client";

import { useProjects } from "@/hooks/use-dashboard";
import { formatAED, formatNumber } from "@/lib/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartContainer } from "@/components/charts/chart-container";
import { useChartColors } from "@/lib/chart-colors";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1 max-w-[200px] truncate">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

interface Project {
  project_name: string;
  master_project: string;
  display_area: string;
  sales_count: number;
  sales_volume: number;
  avg_price: number;
  avg_sqm_price: number;
  offplan_ratio: number;
}

export default function ProjectsPage() {
  const COLORS = useChartColors();
  const { data: projData, isLoading } = useProjects(50, "2025-01");

  const projects: Project[] = projData?.data || [];

  // Top 20 for bar chart
  const top20 = projects.slice(0, 20).map((p) => ({
    name: p.project_name.length > 25 ? p.project_name.slice(0, 25) + "..." : p.project_name,
    volume: p.sales_volume,
    count: p.sales_count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Project Intelligence</h2>
        <p className="text-sm text-muted-foreground mt-1">Top projects by sales volume (2025+)</p>
      </div>

      {/* Top Projects Bar Chart */}
      <ChartContainer title="Top 20 Projects by Volume" subtitle="Total sales volume (AED), 2025+">
        {top20.length > 0 ? (
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={top20} layout="vertical" margin={{ left: 10 }}>
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: COLORS.text }}
                tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 9, fill: COLORS.text }}
                width={120}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="volume" name="Volume (AED)" fill={COLORS.secondary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[500px] animate-pulse bg-muted/20 rounded" />
        )}
      </ChartContainer>

      {/* Projects Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">All Projects</h3>
          <p className="text-[11px] text-muted-foreground">Top 50 by sales volume (Jan 2025 - present)</p>
        </div>
        {isLoading ? (
          <div className="h-[400px] animate-pulse bg-muted/20" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase tracking-wider">#</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Project</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Master Project</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Area</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">Sales</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">Volume</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">Avg Price</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">Avg/sqm</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">Off-Plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p, i) => (
                  <TableRow key={p.project_name} className="border-border">
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{p.project_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                      {p.master_project || "-"}
                    </TableCell>
                    <TableCell className="text-xs">{p.display_area}</TableCell>
                    <TableCell className="text-right text-xs">{formatNumber(p.sales_count)}</TableCell>
                    <TableCell className="text-right text-xs">{formatAED(p.sales_volume)}</TableCell>
                    <TableCell className="text-right text-xs">{formatAED(p.avg_price)}</TableCell>
                    <TableCell className="text-right text-xs">{formatNumber(p.avg_sqm_price)}</TableCell>
                    <TableCell className="text-right text-xs">
                      {(p.offplan_ratio * 100).toFixed(0)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
