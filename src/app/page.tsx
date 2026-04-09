"use client";

import { useState, useRef } from "react";

import {
  useKPIs,
  useVolumetrends,
  usePriceTrends,
  useOffplanTrends,
  useCrisisComparison,
  useCrisisDaily,
  useCrisisAreasImpact,
  useCrisisIndexed,
  useCrisisMarketComposition,
  useCrisisYoyPacing,
  useCrisisGeo,
} from "@/hooks/use-dashboard";
import { KPICard } from "@/components/kpi/kpi-card";
import { ChartContainer } from "@/components/charts/chart-container";
import {
  formatAED,
  formatNumber,
  formatPercent,
  formatPercentagePoints,
  formatPricePerSqm,
  formatSqm,
  CRISIS_DATE,
  CRISIS_LABEL,
  HISTORICAL_CRISES,
} from "@/lib/constants";
import type { TrendGranularity } from "@/lib/sql";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ComposedChart,
} from "recharts";
import {
  AlertTriangle,
  History,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
  Info,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { CrisisMapPoint } from "@/components/charts/crisis-map";

const CrisisMap = dynamic(
  () => import("@/components/charts/crisis-map").then((m) => m.CrisisMap),
  { ssr: false, loading: () => <div className="w-full h-[340px] bg-card rounded-lg animate-pulse" /> }
);
import { CHART_COLORS, useChartColors } from "@/lib/chart-colors";

/* ─── Types ─── */

type MarketPreset = "all" | "5y" | "1y" | "ytd";
type ViewMode = "market" | "event";
type EventPreset = "covid" | "hormuz";

type KPIItem = {
  label: string;
  value: number;
  change_mom: number | null;
  change_yoy: number | null;
  sparkline: number[];
  change_kind?: "percent" | "percentage_points";
};

type VolumePoint = {
  period: string;
  period_start: string;
  year: number;
  month: number;
  count: number;
  volume: number;
  total_count?: number;
  mortgage_count?: number;
  gift_count?: number;
  offplan_count?: number;
  ready_count?: number;
  offplan_ratio?: number;
};

type PricePoint = {
  period: string;
  period_start: string;
  year: number;
  month: number;
  avg_price: number;
  avg_sqm_price: number;
  avg_area?: number;
  sales_count: number;
};

type OffplanPoint = {
  period: string;
  period_start: string;
  year: number;
  month: number;
  offplan_count: number;
  ready_count: number;
  offplan_ratio: number;
  total_sales: number;
};

type CrisisMetric = {
  metric: string;
  change_pct: number;
  pre_value: number;
  post_value: number;
  change_kind?: "percent" | "percentage_points";
};

type CrisisComparisonWindow = {
  title: string;
  preLabel: string;
  preStart: string;
  preEnd: string;
  postLabel: string;
  postStart: string;
  postEnd: string;
  dailyFrom: string;
  dailyTo: string;
};

type WindowConfig = {
  title: string;
  badge: string;
  dateFrom: string;
  dateTo: string;
  granularity: TrendGranularity;
  chartSubtitle: string;
  eventId?: EventPreset;
  eventDate?: string;
  eventLabel?: string;
};

type DailyPoint = {
  date: string;
  sales: number;
  mortgages: number;
  sales_value: number;
  avg_sqm_price: number;
  offplan: number;
  ready: number;
  offplan_pct: number;
};


type AreaImpactRow = {
  area: string;
  display_area: string;
  pre_sales: number;
  post_sales: number;
  pre_daily: number;
  post_daily: number;
  volume_change_pct: number;
  pre_avg_sqm: number;
  post_avg_sqm: number;
  price_change_pct: number | null;
};

/* ─── Constants ─── */

const DATA_START = "2004-01-05";
const DATA_END = "2026-04-08";

const MARKET_PRESETS: Array<{ id: MarketPreset; label: string }> = [
  { id: "all", label: "All" },
  { id: "5y", label: "5Y" },
  { id: "1y", label: "1Y" },
  { id: "ytd", label: "YTD" },
];

const EVENT_PRESETS: Record<EventPreset, { label: string; date: string; note: string }> = {
  covid: { label: "COVID impact", date: "2020-03-01", note: "WHO pandemic declaration window" },
  hormuz: { label: "Hormuz impact", date: CRISIS_DATE, note: CRISIS_LABEL },
};

const EVENT_COMPARISON_WINDOWS: Record<EventPreset, CrisisComparisonWindow> = {
  covid: {
    title: "COVID-19 Impact",
    preLabel: "Dec 2019 – Feb 2020",
    preStart: "2019-12-01",
    preEnd: "2020-02-29",
    postLabel: "Mar – May 2020",
    postStart: "2020-03-01",
    postEnd: "2020-05-31",
    dailyFrom: "2019-11-01",
    dailyTo: "2020-07-01",
  },
  hormuz: {
    title: "Hormuz Strait Disruption",
    preLabel: "Dec 2025 – Feb 2026",
    preStart: "2025-12-01",
    preEnd: "2026-02-28",
    postLabel: "Mar – Apr 2026",
    postStart: "2026-03-01",
    postEnd: "2026-04-08",
    dailyFrom: "2025-11-01",
    dailyTo: "2026-04-08",
  },
};

const HERO_KPI_LABELS = ["Monthly Sales", "Sales Volume", "Avg Price/sqm"];

/* ─── Helpers ─── */

const monthTickFormatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
const shortDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function isoToDate(value: string): Date { return new Date(`${value.slice(0, 10)}T00:00:00.000Z`); }
function formatIsoDate(value: Date): string { return value.toISOString().slice(0, 10); }

function shiftIsoDateByDays(value: string, days: number): string {
  const date = isoToDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}

function shiftIsoDateByYears(value: string, years: number): string {
  const date = isoToDate(value);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return formatIsoDate(date);
}

function daysBetween(start: string, end: string): number {
  return Math.floor((isoToDate(end).getTime() - isoToDate(start).getTime()) / 86400000);
}

function getWeekStartIso(value: string): string {
  const date = isoToDate(value);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return formatIsoDate(date);
}

function formatPeriodLabel(period: string, granularity: TrendGranularity): string {
  if (granularity === "month") return monthTickFormatter.format(isoToDate(`${period}-01`));
  return shortDateFormatter.format(isoToDate(period));
}

function looksLikePeriodLabel(value: string, granularity: TrendGranularity): boolean {
  if (granularity === "month") return /^\d{4}-\d{2}$/.test(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDisplayDate(value: string): string {
  return longDateFormatter.format(isoToDate(value));
}

function normalizeMarker(value: string, granularity: TrendGranularity): string {
  if (granularity === "month") return value.slice(0, 7);
  if (granularity === "week") return getWeekStartIso(value);
  return value.slice(0, 10);
}

const GRANULARITY_LABELS: Record<TrendGranularity, string> = { day: "Daily", week: "Weekly", month: "Monthly" };

function getMarketWindow(preset: MarketPreset, granularity: TrendGranularity): WindowConfig {
  const badge = GRANULARITY_LABELS[granularity];
  if (preset === "all") return { title: "All history", badge, dateFrom: DATA_START, dateTo: DATA_END, granularity, chartSubtitle: "Full post-2004 market cycle with crisis hallmarks" };
  if (preset === "5y") return { title: "Last 5 years", badge, dateFrom: shiftIsoDateByYears(DATA_END, -5), dateTo: DATA_END, granularity, chartSubtitle: "Five-year momentum window with key shocks marked" };
  if (preset === "1y") return { title: "Last 12 months", badge, dateFrom: shiftIsoDateByYears(DATA_END, -1), dateTo: DATA_END, granularity, chartSubtitle: "Recent twelve-month trend with crisis marker context" };
  return { title: "Year to date", badge, dateFrom: `${DATA_END.slice(0, 4)}-01-01`, dateTo: DATA_END, granularity, chartSubtitle: "Current-year pacing against the latest disruption" };
}

function getEventWindow(eventId: EventPreset): WindowConfig {
  const event = EVENT_PRESETS[eventId];
  const granularity: TrendGranularity = "week";
  const desiredHalfDays = 240;
  const availableBefore = daysBetween(DATA_START, event.date);
  const availableAfter = daysBetween(event.date, DATA_END);
  const centeredHalfWindow = Math.max(14, Math.min(desiredHalfDays, availableBefore, availableAfter));
  return {
    title: event.label,
    badge: "Weekly",
    dateFrom: shiftIsoDateByDays(event.date, -centeredHalfWindow),
    dateTo: shiftIsoDateByDays(event.date, centeredHalfWindow),
    granularity,
    chartSubtitle: `${event.note} centered in the window`,
    eventId,
    eventDate: event.date,
    eventLabel: event.label,
  };
}

function getTooltipValue(name: string, value: number): string {
  if (name.includes("Volume") || name.includes("Value")) return formatAED(value);
  if (name.includes("Price") || name.includes("sqm")) return formatPricePerSqm(value);
  if (name.includes("Ratio") || name.includes("%")) return `${value.toFixed(1)}%`;
  if (name.includes("Size")) return formatSqm(value);
  return formatNumber(value);
}

function formatKPIValue(label: string, value: number): string {
  if (label === "Monthly Sales") return formatNumber(value);
  if (label === "Sales Volume") return formatAED(value);
  if (label === "Avg Price/sqm") return formatPricePerSqm(value);
  if (label === "Avg Transaction") return formatAED(value);
  if (label === "Off-Plan Ratio") return `${value.toFixed(1)}%`;
  if (label === "Avg Size (sqm)") return formatSqm(value);
  if (label === "YoY Volume" || label === "YoY Price") return formatPercent(value);
  return value.toFixed(0);
}

/* ─── Shared Components ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, granularity }: any) {
  if (!active || !payload?.length) return null;
  const displayLabel = typeof label === "string" && looksLikePeriodLabel(label, granularity)
    ? formatPeriodLabel(label, granularity) : label;
  return (
    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{displayLabel}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? getTooltipValue(entry.name, entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DailyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const displayLabel = typeof label === "string" ? shortDateFormatter.format(isoToDate(label)) : label;
  return (
    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{displayLabel}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? getTooltipValue(entry.name, entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

/* ─── Page Component ─── */

export default function OverviewPage() {
  const colors = useChartColors();
  const [viewMode, setViewMode] = useState<ViewMode>("event");
  const [marketPreset, setMarketPreset] = useState<MarketPreset>("5y");
  const [marketGranularity, setMarketGranularity] = useState<TrendGranularity>("week");
  const [eventPreset, setEventPreset] = useState<EventPreset>("hormuz");
  const [crisisExpanded, setCrisisExpanded] = useState(false);
  const selectedEventComparison = EVENT_COMPARISON_WINDOWS[eventPreset];
  const chartSectionRef = useRef<HTMLDivElement>(null);

  const activeWindow = viewMode === "market" ? getMarketWindow(marketPreset, marketGranularity) : getEventWindow(eventPreset);

  // Shared data
  const { data: kpiData, isLoading: kpiLoading } = useKPIs();
  const { data: volumeData, isLoading: volumeLoading } = useVolumetrends(activeWindow.dateFrom, activeWindow.dateTo, undefined, activeWindow.granularity);
  const { data: priceData, isLoading: priceLoading } = usePriceTrends(activeWindow.dateFrom, activeWindow.dateTo, undefined, activeWindow.granularity);
  const { data: offplanData, isLoading: offplanLoading } = useOffplanTrends(activeWindow.dateFrom, activeWindow.dateTo, activeWindow.granularity);
  const { data: crisisData } = useCrisisComparison({
    preStart: selectedEventComparison.preStart,
    preEnd: selectedEventComparison.preEnd,
    postStart: selectedEventComparison.postStart,
    postEnd: selectedEventComparison.postEnd,
  });

  // Event-mode specific data
  const { data: dailyData, isLoading: dailyLoading } = useCrisisDaily(
    selectedEventComparison.dailyFrom,
    selectedEventComparison.dailyTo
  );
  const { data: areasImpactData } = useCrisisAreasImpact({
    preStart: selectedEventComparison.preStart,
    preEnd: selectedEventComparison.preEnd,
    postStart: selectedEventComparison.postStart,
    postEnd: selectedEventComparison.postEnd,
    limit: 12,
  });
  const { data: indexedVolumeData } = useCrisisIndexed("sales_count", 12);
  const { data: indexedPriceData } = useCrisisIndexed("sales_avg_sqm_price", 12);
  const { data: compositionData } = useCrisisMarketComposition(
    selectedEventComparison.dailyFrom,
    selectedEventComparison.dailyTo
  );
  const { data: yoyData } = useCrisisYoyPacing();
  const { data: crisisGeoData } = useCrisisGeo({
    preStart: selectedEventComparison.preStart,
    preEnd: selectedEventComparison.preEnd,
    postStart: selectedEventComparison.postStart,
    postEnd: selectedEventComparison.postEnd,
  });

  const crisisGeoPoints = (crisisGeoData?.data || []) as CrisisMapPoint[];

  const kpis = (kpiData?.kpis || []) as KPIItem[];
  const volumeTrend = (volumeData?.data || []) as VolumePoint[];
  const priceTrend = (priceData?.data || []) as PricePoint[];
  const offplanTrend = (offplanData?.data || []) as OffplanPoint[];
  const crisisMetrics = (crisisData?.data || []) as CrisisMetric[];
  const dailyPoints = (dailyData?.data || []) as DailyPoint[];
  const areasImpact = (areasImpactData?.data || []) as AreaImpactRow[];

  type CompositionPoint = {
    week: string;
    primary_sales: number;
    secondary_sales: number;
    delayed_sales: number;
    total_sales: number;
    mortgages: number;
    under_1m: number;
    band_1m_5m: number;
    band_5m_10m: number;
    over_10m: number;
  };
  const composition = (compositionData?.data || []) as CompositionPoint[];

  type YoyPoint = { week_num: number; week_label: string; prev_year: number; curr_year: number; yoy_pct: number | null };
  const yoyPoints = (yoyData?.data || []) as YoyPoint[];


  // Build recovery comparison data: month offset → { covid, hormuz } for overlaid lines
  const indexedVolumeSeries = indexedVolumeData?.data as Record<string, { month: number; value: number }[]> | undefined;
  const indexedPriceSeries = indexedPriceData?.data as Record<string, { month: number; value: number }[]> | undefined;

  const recoveryData = (() => {
    if (!indexedVolumeSeries) return [];
    const covidPts = indexedVolumeSeries.covid || [];
    const hormuzPts = indexedVolumeSeries.hormuz || [];
    const covidPrice = indexedPriceSeries?.covid || [];
    const hormuzPrice = indexedPriceSeries?.hormuz || [];
    const months = new Set([...covidPts.map((p) => p.month), ...hormuzPts.map((p) => p.month)]);
    return Array.from(months).sort((a, b) => a - b).map((m) => ({
      month: m,
      label: m === 0 ? "Event" : m > 0 ? `+${m}mo` : `${m}mo`,
      covid_volume: covidPts.find((p) => p.month === m)?.value ?? null,
      hormuz_volume: hormuzPts.find((p) => p.month === m)?.value ?? null,
      covid_price: covidPrice.find((p) => p.month === m)?.value ?? null,
      hormuz_price: hormuzPrice.find((p) => p.month === m)?.value ?? null,
    }));
  })();

  const heroKpis = kpis.filter((k) => HERO_KPI_LABELS.includes(k.label));
  const secondaryKpis = kpis.filter((k) => !HERO_KPI_LABELS.includes(k.label));

  const yearlyData = volumeTrend.reduce(
    (acc: Array<{ year: number; count: number; volume: number }>, point) => {
      const existing = acc.find((entry) => entry.year === point.year);
      if (existing) { existing.count += point.count; existing.volume += point.volume; }
      else acc.push({ year: point.year, count: point.count, volume: point.volume });
      return acc;
    }, []
  );

  const visibleMarkers = viewMode === "market"
    ? HISTORICAL_CRISES.filter((c) => c.date >= activeWindow.dateFrom && c.date <= activeWindow.dateTo)
        .map((c) => ({ id: c.id, label: c.label, marker: normalizeMarker(c.date, activeWindow.granularity) }))
    : [{ id: activeWindow.eventId || eventPreset, label: activeWindow.eventLabel || EVENT_PRESETS[eventPreset].label, marker: normalizeMarker(activeWindow.eventDate || EVENT_PRESETS[eventPreset].date, activeWindow.granularity) }];

  // Transaction type breakdown for market mode — sum across entire window
  const txTypeData = volumeTrend.length > 0
    ? [
        { name: "Sales", value: volumeTrend.reduce((s, p) => s + (p.count || 0), 0) },
        { name: "Mortgage", value: volumeTrend.reduce((s, p) => s + (p.mortgage_count || 0), 0) },
        { name: "Gifts", value: volumeTrend.reduce((s, p) => s + (p.gift_count || 0), 0) },
      ]
    : [];
  const txTotal = txTypeData.reduce((s, d) => s + d.value, 0);

  const scrollToCharts = () => {
    chartSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Build sparklines from daily data for event KPI cards (weekly aggregates)
  const eventSparklines = (() => {
    if (dailyPoints.length < 7) return {} as Record<string, number[]>;
    // Group daily data into weekly buckets
    const weeks: DailyPoint[][] = [];
    for (let i = 0; i < dailyPoints.length; i += 7) {
      weeks.push(dailyPoints.slice(i, i + 7));
    }
    const agg = weeks.map((w) => ({
      sales: w.reduce((s, p) => s + p.sales, 0),
      value: w.reduce((s, p) => s + p.sales_value, 0),
      avgSqm: w.filter((p) => p.avg_sqm_price > 0).reduce((s, p, _, a) => s + p.avg_sqm_price / a.length, 0),
      mortgages: w.reduce((s, p) => s + p.mortgages, 0),
      offplanPct: w.filter((p) => p.sales > 20).reduce((s, p, _, a) => s + p.offplan_pct / a.length, 0),
      avgSize: w.filter((p) => p.sales > 0).reduce((s, p, _, a) => s + p.sales_value / p.sales / a.length, 0),
    }));
    return {
      "Daily Sales Count": agg.map((w) => w.sales),
      "Daily Sales Value (AED)": agg.map((w) => w.value),
      "Avg Price/sqm": agg.map((w) => w.avgSqm),
      "Off-Plan Ratio": agg.map((w) => w.offplanPct),
      "Daily Mortgage Count": agg.map((w) => w.mortgages),
      "Avg Transaction Size (sqm)": agg.map((w) => w.avgSize),
    };
  })();

  // 7-day moving average for daily data
  const dailyWithMa = dailyPoints.map((point, i, arr) => {
    const window = arr.slice(Math.max(0, i - 6), i + 1);
    const ma7 = window.reduce((s, p) => s + p.sales, 0) / window.length;
    return { ...point, ma7: Math.round(ma7) };
  });

  return (
    <div className="space-y-5">
      {/* Header + Controls */}
      <div className="animate-fade-up">
        <div className="flex flex-col gap-1 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight">Market Overview</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-1">{activeWindow.chartSubtitle}</p>
          </div>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {activeWindow.badge} · {formatDisplayDate(activeWindow.dateFrom)} – {formatDisplayDate(activeWindow.dateTo)}
          </span>
        </div>

        {/* Tab row — sticky */}
        <div className="flex items-center gap-1 mt-4 border-b border-border pb-px animate-fade-up sticky top-12 md:top-0 z-30 bg-background/95 backdrop-blur-sm -mx-4 px-4 md:-mx-6 md:px-6 pt-2 overflow-x-auto scrollbar-none" style={{ animationDelay: "50ms" }}>
          <button onClick={() => { setEventPreset("hormuz"); setViewMode("event"); }}
            className={`relative shrink-0 px-3 py-2 text-sm font-medium transition-colors rounded-t-md whitespace-nowrap ${viewMode === "event" && eventPreset === "hormuz" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}>
            <AlertTriangle className="inline-block size-3.5 mr-1.5 -mt-0.5" />
            Hormuz
            {viewMode === "event" && eventPreset === "hormuz" && <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary rounded-full" />}
          </button>
          <button onClick={() => { setEventPreset("covid"); setViewMode("event"); }}
            className={`relative shrink-0 px-3 py-2 text-sm font-medium transition-colors rounded-t-md whitespace-nowrap ${viewMode === "event" && eventPreset === "covid" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}>
            COVID-19
            {viewMode === "event" && eventPreset === "covid" && <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary rounded-full" />}
          </button>
          <div className="w-px h-4 bg-border mx-1 shrink-0" />
          <button onClick={() => setViewMode("market")}
            className={`relative shrink-0 px-3 py-2 text-sm font-medium transition-colors rounded-t-md whitespace-nowrap ${viewMode === "market" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}>
            <History className="inline-block size-3.5 mr-1.5 -mt-0.5" />
            History
            {viewMode === "market" && <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary rounded-full" />}
          </button>
          {viewMode === "market" && (
            <>
              <div className="flex items-center gap-0.5 ml-1">
                {MARKET_PRESETS.map((preset) => (
                  <button key={preset.id} onClick={() => setMarketPreset(preset.id)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${marketPreset === preset.id ? "bg-secondary text-secondary-foreground font-medium" : "text-muted-foreground hover:text-foreground/80"}`}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-border mx-1" />
              <div className="flex items-center gap-0.5">
                {(["day", "week", "month"] as TrendGranularity[]).map((g) => (
                  <button key={g} onClick={() => setMarketGranularity(g)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${marketGranularity === g ? "bg-secondary text-secondary-foreground font-medium" : "text-muted-foreground hover:text-foreground/80"}`}>
                    {g[0].toUpperCase()}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════ EVENT MODE ═══════════════════ */}
      {viewMode === "event" ? (
        <>
          {/* Event KPI cards — show post-crisis values with change from pre-crisis */}
          {crisisMetrics.length > 0 && (
            <div className="space-y-3">
              {/* Hero KPIs — top 3 metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {crisisMetrics.slice(0, 3).map((metric, i) => {
                  const isPrice = metric.metric.includes("Price");
                  const isValue = metric.metric.includes("Value");
                  const displayValue = isValue
                    ? formatAED(metric.post_value)
                    : isPrice
                      ? formatPricePerSqm(metric.post_value)
                      : formatNumber(Math.round(metric.post_value));
                  const spark = eventSparklines[metric.metric];
                  const sparkData = spark?.map((v, idx) => ({ i: idx, v })) || [];
                  const sparkColor = metric.change_pct >= 0 ? CHART_COLORS.primary : "#e05555";
                  return (
                    <div
                      key={metric.metric}
                      className="relative overflow-hidden rounded-lg border border-border bg-card p-3 sm:p-5 animate-fade-up"
                      style={{ animationDelay: `${100 + i * 60}ms` }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            {metric.metric}
                          </p>
                          <p className="text-xl sm:text-3xl font-semibold mt-1.5 sm:mt-2 text-foreground tracking-tight">
                            {displayValue}
                          </p>
                          <div className="flex items-center gap-1 mt-2 sm:mt-3">
                            {metric.change_pct < 0 ? (
                              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                            ) : metric.change_pct > 0 ? (
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            ) : null}
                            <span className={`text-sm font-medium ${metric.change_pct > 0 ? "text-emerald-400" : metric.change_pct < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                              {metric.change_pct > 0 ? "+" : ""}
                              {metric.change_kind === "percentage_points"
                                ? formatPercentagePoints(metric.change_pct)
                                : formatPercent(metric.change_pct)}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1">vs pre-event</span>
                          </div>
                        </div>
                        {sparkData.length > 2 && (
                          <div className="w-16 h-10 sm:w-24 sm:h-12 ml-2 shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sparkData}>
                                <Line type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={1.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Secondary KPIs — remaining metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {crisisMetrics.slice(3).map((metric, i) => {
                  const isRatio = metric.metric.includes("Ratio");
                  const isMortgage = metric.metric.includes("Mortgage");
                  const isSize = metric.metric.includes("Size");
                  const displayValue = isRatio
                    ? `${metric.post_value.toFixed(1)}%`
                    : isSize
                      ? formatSqm(metric.post_value)
                      : isMortgage
                        ? formatNumber(Math.round(metric.post_value))
                        : formatNumber(Math.round(metric.post_value));
                  return (
                    <div
                      key={metric.metric}
                      className="relative overflow-hidden rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3 animate-fade-up min-w-0"
                      style={{ animationDelay: `${280 + i * 40}ms` }}
                    >
                      <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                        {metric.metric}
                      </p>
                      <p className="text-base sm:text-xl font-semibold mt-1 text-foreground tracking-tight truncate">
                        {displayValue}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        {metric.change_pct < 0 ? (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        ) : metric.change_pct > 0 ? (
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                        ) : null}
                        <span className={`text-xs ${metric.change_pct > 0 ? "text-emerald-400" : metric.change_pct < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                          {metric.change_pct > 0 ? "+" : ""}
                          {metric.change_kind === "percentage_points"
                            ? formatPercentagePoints(metric.change_pct)
                            : formatPercent(metric.change_pct)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">vs pre</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily Impact Timeline — the hero visualization */}
          <div ref={chartSectionRef}>
            <ChartContainer
              title="Daily Impact Timeline"
              subtitle=""
              variant="hero"
              animationDelay={200}
              action={
                <div className="relative group">
                  <Info className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors" />
                  <div className="absolute right-0 top-6 z-50 w-64 px-3 py-2.5 rounded-lg bg-popover border border-border shadow-xl text-[11px] text-muted-foreground leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                    <p><span className="text-foreground font-medium">Note:</span> Pre-2026 historical DLD data recorded weekend transactions under the next weekday, inflating weekday counts. 2026+ data includes actual weekend entries. This may cause visible pattern differences across the boundary.</p>
                  </div>
                </div>
              }
            >
              {dailyLoading ? (
                <div className="h-[350px] skeleton" />
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={dailyWithMa}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.text }} tickLine={false} axisLine={false}
                      interval="preserveStartEnd" minTickGap={40}
                      tickFormatter={(v) => shortDateFormatter.format(isoToDate(v))} />
                    <YAxis tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} />
                    <Tooltip content={<DailyTooltip />} />
                    <ReferenceLine x={EVENT_PRESETS[eventPreset].date} stroke="#f5a623" strokeDasharray="4 4" strokeOpacity={0.8}
                      label={{ value: EVENT_PRESETS[eventPreset].label, fill: "#f5a623", fontSize: 10, position: "top" }} />
                    <Bar dataKey="sales" name="Daily Sales" fill={CHART_COLORS.primary} fillOpacity={0.35} radius={[1, 1, 0, 0]} />
                    <Line dataKey="ma7" name="7-day avg" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartContainer>
          </div>

          {/* Two-column: Price Stability + Mortgage Confidence */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartContainer
              title="Price vs Volume Divergence"
              subtitle=""
              animationDelay={300}
            >
              {dailyLoading ? (
                <div className="h-[260px] skeleton" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={dailyWithMa}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.text }} tickLine={false} axisLine={false}
                      interval="preserveStartEnd" minTickGap={40}
                      tickFormatter={(v) => shortDateFormatter.format(isoToDate(v))} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false}
                      domain={["dataMin - 2000", "dataMax + 2000"]} />
                    <Tooltip content={<DailyTooltip />} />
                    <ReferenceLine x={EVENT_PRESETS[eventPreset].date} yAxisId="left" stroke="#f5a623" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <Line yAxisId="left" dataKey="ma7" name="Sales (7d avg)" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                    <Line yAxisId="right" dataKey="avg_sqm_price" name="Avg Price/sqm" stroke={CHART_COLORS.tertiary} strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartContainer>

            <ChartContainer
              title="Mortgage Activity"
              subtitle=""
              animationDelay={360}
            >
              {dailyLoading ? (
                <div className="h-[260px] skeleton" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={dailyWithMa.map((p, i, arr) => {
                    const w = arr.slice(Math.max(0, i - 6), i + 1);
                    return { ...p, mortgage_ma7: Math.round(w.reduce((s, x) => s + x.mortgages, 0) / w.length) };
                  })}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.text }} tickLine={false} axisLine={false}
                      interval="preserveStartEnd" minTickGap={40}
                      tickFormatter={(v) => shortDateFormatter.format(isoToDate(v))} />
                    <YAxis tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} />
                    <Tooltip content={<DailyTooltip />} />
                    <ReferenceLine x={EVENT_PRESETS[eventPreset].date} stroke="#f5a623" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <Bar dataKey="mortgages" name="Daily Mortgages" fill={CHART_COLORS.purple} fillOpacity={0.3} radius={[1, 1, 0, 0]} />
                    <Line dataKey="mortgage_ma7" name="7-day avg" stroke={CHART_COLORS.purple} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartContainer>
          </div>

          {/* Area Impact */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Crisis Impact Map */}
            <ChartContainer
              title="Geographic Impact"
              subtitle="Volume change by area (red = decline, green = growth)"
              animationDelay={460}
            >
              {crisisGeoPoints.length > 0 ? (
                <div style={{ height: 340 }}>
                  <CrisisMap data={crisisGeoPoints} metric="volume_change_pct" />
                </div>
              ) : (
                <div className="h-[340px] skeleton" />
              )}
            </ChartContainer>

            {/* Area Impact Ranking */}
            <ChartContainer
              title="Area Impact Ranking"
              subtitle=""
              animationDelay={480}
            >
              {areasImpact.length > 0 ? (
                <div className="space-y-1.5 pt-1 max-h-[320px] overflow-y-auto pr-1">
                  {areasImpact.map((area, i) => {
                    const volPct = Math.min(100, Math.abs(area.volume_change_pct));
                    return (
                      <div key={area.area} className="group rounded-md px-2.5 py-2 transition-colors hover:bg-muted/20">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground w-4 text-right shrink-0 font-medium">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs text-foreground/90 truncate font-medium">{area.display_area}</p>
                              <div className="flex items-center gap-3 shrink-0 ml-2">
                                <span className={`text-xs font-medium ${area.volume_change_pct < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                  {area.volume_change_pct > 0 ? "+" : ""}{area.volume_change_pct.toFixed(0)}% vol
                                </span>
                                {area.price_change_pct != null && (
                                  <span className={`text-xs font-medium ${area.price_change_pct < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                    {area.price_change_pct > 0 ? "+" : ""}{area.price_change_pct.toFixed(1)}% price
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${volPct}%`,
                                    backgroundColor: area.volume_change_pct < -80 ? "#e05555" : area.volume_change_pct < -65 ? "#e8943a" : CHART_COLORS.primary,
                                  }}
                                />
                              </div>
                              <span className="text-[9px] text-muted-foreground shrink-0 w-20 sm:w-24 text-right hidden sm:inline">
                                {area.pre_daily}/d → {area.post_daily}/d
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-[320px] skeleton" />
              )}
            </ChartContainer>
          </div>

          {/* Crisis Recovery Comparison — Hormuz vs COVID indexed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartContainer
              title="Volume Recovery: Hormuz vs COVID"
              subtitle=""
              animationDelay={540}
            >
              {recoveryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={recoveryData}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: colors.text }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip granularity="month" />} />
                    <ReferenceLine y={100} stroke={colors.muted} strokeDasharray="3 3" />
                    <Line dataKey="covid_volume" name="COVID Volume" stroke={CHART_COLORS.red} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    <Line dataKey="hormuz_volume" name="Hormuz Volume" stroke={CHART_COLORS.primary} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] skeleton" />
              )}
            </ChartContainer>

            <ChartContainer
              title="Price Recovery: Hormuz vs COVID"
              subtitle=""
              animationDelay={600}
            >
              {recoveryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={recoveryData}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: colors.text }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} domain={[60, 140]} />
                    <Tooltip content={<ChartTooltip granularity="month" />} />
                    <ReferenceLine y={100} stroke={colors.muted} strokeDasharray="3 3" />
                    <Line dataKey="covid_price" name="COVID Price" stroke={CHART_COLORS.red} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    <Line dataKey="hormuz_price" name="Hormuz Price" stroke={CHART_COLORS.primary} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] skeleton" />
              )}
            </ChartContainer>
          </div>

          {/* Primary vs Secondary Market + Price Band Impact */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartContainer
              title="Primary vs Secondary Market"
              subtitle=""
              animationDelay={660}
            >
              {composition.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={composition}>
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: colors.text }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => shortDateFormatter.format(isoToDate(v))} interval="preserveStartEnd" minTickGap={40} />
                    <YAxis tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} />
                    <Tooltip content={<DailyTooltip />} />
                    <ReferenceLine x={EVENT_PRESETS[eventPreset].date.slice(0, 10)} stroke="#f5a623" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <Bar dataKey="primary_sales" name="Primary (Pre-reg)" stackId="a" fill={CHART_COLORS.primary} />
                    <Bar dataKey="secondary_sales" name="Secondary (Resale)" stackId="a" fill={CHART_COLORS.cyan} />
                    <Bar dataKey="delayed_sales" name="Delayed" stackId="a" fill={CHART_COLORS.tertiary} fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] skeleton" />
              )}
            </ChartContainer>

            <ChartContainer
              title="2026 vs 2025 YTD Pacing"
              subtitle=""
              animationDelay={720}
            >
              {yoyPoints.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={yoyPoints}>
                    <XAxis dataKey="week_num" tick={{ fontSize: 10, fill: colors.text }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `W${v}`} />
                    <YAxis tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl">
                          <p className="text-xs text-muted-foreground mb-1">Week {label}</p>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {payload.map((entry: any, i: number) => (
                            <p key={i} className="text-xs" style={{ color: entry.color }}>
                              {entry.name}: {formatNumber(entry.value)}
                            </p>
                          ))}
                        </div>
                      );
                    }} />
                    <ReferenceLine x={10} stroke="#f5a623" strokeDasharray="4 4" strokeOpacity={0.6}
                      label={{ value: "Hormuz", fill: "#f5a623", fontSize: 10, position: "top" }} />
                    <Bar dataKey="prev_year" name="2025" fill={colors.muted} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="curr_year" name="2026" radius={[2, 2, 0, 0]}>
                      {yoyPoints.map((pt, i) => (
                        <Cell key={i} fill={pt.week_num >= 10 ? CHART_COLORS.red : CHART_COLORS.primary}
                          fillOpacity={pt.week_num >= 10 ? 0.7 : 0.8} />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] skeleton" />
              )}
            </ChartContainer>
          </div>
        </>
      ) : (
        /* ═══════════════════ MARKET MODE ═══════════════════ */
        <>
          {/* Collapsible crisis alert */}
          {crisisMetrics.length > 0 && (
            <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
              <button onClick={() => setCrisisExpanded(!crisisExpanded)}
                className="w-full text-left rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 sm:px-4 py-2.5 transition-colors hover:bg-amber-500/8 group">
                <div className="flex items-center gap-2 flex-wrap">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                  <span className="text-xs font-medium text-amber-400/80">{selectedEventComparison.title}</span>
                  <span className="text-[10px] text-muted-foreground mx-1 hidden sm:inline">—</span>
                  <span className="hidden sm:contents">
                    {crisisMetrics.slice(0, 3).map((metric) => (
                      <span key={metric.metric} className="text-[11px] text-muted-foreground">
                        <span className="text-foreground/50">{metric.metric}</span>{" "}
                        <span className={metric.change_pct > 0 ? "text-emerald-400" : metric.change_pct < 0 ? "text-red-400" : ""}>
                          {metric.change_pct > 0 ? "+" : ""}
                          {metric.change_kind === "percentage_points" ? formatPercentagePoints(metric.change_pct) : formatPercent(metric.change_pct)}
                        </span>
                      </span>
                    ))}
                  </span>
                  <span className="ml-auto text-muted-foreground shrink-0">
                    {crisisExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </span>
                </div>
                {crisisExpanded && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mt-3 pt-3 border-t border-amber-500/10">
                    {crisisMetrics.map((metric) => (
                      <div key={metric.metric} className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{metric.metric}</p>
                        <p className={`text-lg font-semibold ${metric.change_pct > 0 ? "text-emerald-400" : metric.change_pct < 0 ? "text-red-400" : "text-foreground"}`}>
                          {metric.change_pct > 0 ? "+" : ""}
                          {metric.change_kind === "percentage_points" ? formatPercentagePoints(metric.change_pct) : formatPercent(metric.change_pct)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            </div>
          )}

          {/* KPIs */}
          {kpiLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 sm:h-40 skeleton border border-border" />)}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 sm:h-24 skeleton border border-border" />)}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {heroKpis.map((kpi, i) => (
                  <div key={kpi.label} onClick={scrollToCharts} className="cursor-pointer transition-transform hover:scale-[1.01]">
                    <KPICard label={kpi.label} value={formatKPIValue(kpi.label, kpi.value)}
                      changeMom={kpi.change_mom} changeYoy={kpi.change_yoy} changeKind={kpi.change_kind}
                      sparkline={kpi.sparkline} variant="hero" animationDelay={150 + i * 60} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
                {secondaryKpis.map((kpi, i) => (
                  <KPICard key={kpi.label} label={kpi.label} value={formatKPIValue(kpi.label, kpi.value)}
                    changeMom={kpi.change_mom} changeYoy={kpi.change_yoy} changeKind={kpi.change_kind}
                    variant="compact" animationDelay={330 + i * 40} />
                ))}
              </div>
            </div>
          )}

          {/* Hero chart — Transaction Volume */}
          <div ref={chartSectionRef} className="pt-4">
            <ChartContainer title="Transaction Volume" subtitle="" variant="hero" animationDelay={500}>
              {volumeLoading ? <div className="h-[380px] skeleton" /> : (
                <ResponsiveContainer width="100%" height={380}>
                  <AreaChart data={volumeTrend}>
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20}
                      tickFormatter={(v) => formatPeriodLabel(v, activeWindow.granularity)} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e9).toFixed(0)}B`} />
                    <Tooltip content={<ChartTooltip granularity={activeWindow.granularity} />} />
                    {visibleMarkers.map((m) => (
                      <ReferenceLine key={m.id} x={m.marker} yAxisId="left" stroke={m.id === "hormuz" ? "#f5a623" : "#9678b8"} strokeDasharray="4 4" strokeOpacity={0.6}
                        label={{ value: m.label, fill: m.id === "hormuz" ? "#f5a623" : "#9678b8", fontSize: 10, position: "top" }} />
                    ))}
                    <defs>
                      <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Area yAxisId="left" type="monotone" dataKey="count" name="Sales Count" stroke={CHART_COLORS.primary} fill="url(#volumeGradient)" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="volume" name="Sales Volume" stroke={CHART_COLORS.secondary} strokeWidth={1.5} dot={false} strokeOpacity={0.7} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartContainer>
          </div>

          {/* Price Trends + Off-Plan */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartContainer title="Price Trends" subtitle="" animationDelay={560}>
              {priceLoading ? <div className="h-[280px] skeleton" /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={priceTrend}>
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20}
                      tickFormatter={(v) => formatPeriodLabel(v, activeWindow.granularity)} />
                    <YAxis tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip granularity={activeWindow.granularity} />} />
                    {visibleMarkers.map((m) => <ReferenceLine key={m.id} x={m.marker} stroke={m.id === "hormuz" ? "#f5a623" : "#9678b8"} strokeDasharray="4 4" strokeOpacity={0.4} />)}
                    <Line type="monotone" dataKey="avg_sqm_price" name="Avg Price/sqm" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartContainer>

            <ChartContainer title="Off-Plan vs Ready" subtitle="" animationDelay={620}>
              {offplanLoading ? <div className="h-[280px] skeleton" /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={offplanTrend}>
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20}
                      tickFormatter={(v) => formatPeriodLabel(v, activeWindow.granularity)} />
                    <YAxis tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip granularity={activeWindow.granularity} />} />
                    {visibleMarkers.map((m) => <ReferenceLine key={m.id} x={m.marker} stroke={m.id === "hormuz" ? "#f5a623" : "#9678b8"} strokeDasharray="4 4" strokeOpacity={0.4} />)}
                    <Bar dataKey="offplan_count" name="Off-Plan" stackId="a" fill={CHART_COLORS.secondary} />
                    <Bar dataKey="ready_count" name="Ready" stackId="a" fill={colors.readyFill} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartContainer>
          </div>

          {/* Transaction Types + Annual Volume */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartContainer title="Transaction Types" subtitle="" animationDelay={680}>
              {txTypeData.length > 0 ? (
                <div className="space-y-3 pt-2">
                  {txTypeData.map((item, i) => {
                    const pct = txTotal > 0 ? (item.value / txTotal) * 100 : 0;
                    const barColors = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.purple];
                    return (
                      <div key={item.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-foreground/80">{item.name}</span>
                          <span className="text-xs text-muted-foreground">{formatNumber(item.value)} <span className="text-[10px]">({pct.toFixed(1)}%)</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: barColors[i] }} />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-muted-foreground pt-1">Total: {formatNumber(txTotal)} transactions</p>
                </div>
              ) : <div className="h-[200px] skeleton" />}
            </ChartContainer>

            <ChartContainer title="Annual Volume" subtitle="" className="lg:col-span-2" animationDelay={740}>
              {yearlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={yearlyData}>
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: colors.text }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip granularity="month" />} />
                    <Bar dataKey="count" name="Sales" radius={[3, 3, 0, 0]}>
                      {yearlyData.map((_, index) => (
                        <Cell key={index} fill={index === yearlyData.length - 1 ? CHART_COLORS.tertiary : CHART_COLORS.primary} fillOpacity={index === yearlyData.length - 1 ? 1 : 0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-[230px] skeleton" />}
            </ChartContainer>
          </div>
        </>
      )}
    </div>
  );
}
