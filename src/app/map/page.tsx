"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useGeoData } from "@/hooks/use-dashboard";
import { ChartContainer } from "@/components/charts/chart-container";
import type { MapPoint } from "@/components/charts/dubai-map";

const DubaiMap = dynamic(
  () => import("@/components/charts/dubai-map").then((m) => m.DubaiMap),
  { ssr: false, loading: () => <div className="w-full h-[400px] sm:h-[500px] md:h-[600px] bg-card rounded-lg animate-pulse" /> }
);

type ColorMetric = "avg_sqm_price" | "sales_count" | "sales_volume" | "offplan_ratio";
type Level = "area" | "project";

const COLOR_OPTIONS: { value: ColorMetric; label: string }[] = [
  { value: "avg_sqm_price", label: "Price / sqm" },
  { value: "sales_count", label: "Sales Count" },
  { value: "sales_volume", label: "Sales Volume" },
  { value: "offplan_ratio", label: "Off-Plan Ratio" },
];

const DATE_PRESETS = [
  { label: "YTD 2026", from: "2026-01", to: "2026-12" },
  { label: "2025", from: "2025-01", to: "2025-12" },
  { label: "Last 3Y", from: "2023-01", to: "2026-12" },
  { label: "All Time", from: "2004-01", to: "2026-12" },
];

export default function MapPage() {
  const [level, setLevel] = useState<Level>("area");
  const [colorMetric, setColorMetric] = useState<ColorMetric>("avg_sqm_price");
  const [presetIndex, setPresetIndex] = useState(0);
  const preset = DATE_PRESETS[presetIndex];

  const { data: rawData, isLoading } = useGeoData(level, preset.from, preset.to);

  const mapData: MapPoint[] = useMemo(() => {
    if (!rawData?.data) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rawData.data.map((d: any) => ({
      name: level === "project" ? d.project_name_en : d.normalized_area,
      display_name: level === "project" ? d.project_name_en : d.display_area,
      lat: d.lat,
      lng: d.lng,
      sales_count: d.sales_count,
      sales_volume: d.sales_volume,
      avg_sqm_price: d.avg_sqm_price,
      avg_price: d.avg_price,
      offplan_ratio: d.offplan_ratio ?? null,
      normalized_area: d.display_area,
    }));
  }, [rawData, level]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-base sm:text-lg font-semibold text-foreground">Dubai Real Estate Map</h1>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {DATE_PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPresetIndex(i)}
              className={`px-2 sm:px-3 py-1 text-xs rounded-md transition-colors ${
                i === presetIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 bg-muted rounded-md p-0.5">
          {(["area", "project"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-3 py-1 text-xs rounded transition-colors capitalize ${
                l === level
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l === "area" ? "Areas" : "Projects"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Color by:</span>
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setColorMetric(opt.value)}
              className={`px-2 sm:px-2.5 py-1 text-xs rounded-md transition-colors ${
                opt.value === colorMetric
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {!isLoading && (
          <span className="text-xs text-muted-foreground sm:ml-auto">
            {mapData.length} {level === "area" ? "areas" : "projects"} on map
          </span>
        )}
      </div>

      <ChartContainer title="" className="!p-0 overflow-hidden">
        <div className="h-[400px] sm:h-[500px] md:h-[600px]">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-card">
              <span className="text-sm text-muted-foreground">Loading map data...</span>
            </div>
          ) : (
            <DubaiMap data={mapData} colorMetric={colorMetric} level={level} />
          )}
        </div>
      </ChartContainer>

      <div className="flex items-center gap-6 px-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Low</span>
          <div className="flex h-2.5 rounded overflow-hidden">
            {Array.from({ length: 20 }, (_, i) => {
              const t = i / 19;
              const r = Math.round(t < 0.5 ? 0 : t < 0.75 ? (t - 0.5) * 4 * 255 : 255);
              const g = Math.round(t < 0.25 ? t * 4 * 255 : t < 0.75 ? 255 : (1 - t) * 4 * 255);
              const b = Math.round(t < 0.5 ? (1 - t * 2) * 255 : 0);
              return <div key={i} className="w-3" style={{ background: `rgb(${r},${g},${b})` }} />;
            })}
          </div>
          <span className="text-[10px] text-muted-foreground">High</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Circle size = transaction volume
        </span>
      </div>
    </div>
  );
}
