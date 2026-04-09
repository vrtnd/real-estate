"use client";

import { useQuery } from "@tanstack/react-query";
import type { TrendGranularity } from "@/lib/sql";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

export function useKPIs() {
  return useQuery({
    queryKey: ["kpis"],
    queryFn: () => fetcher("/api/kpis"),
  });
}

export function useVolumetrends(
  dateFrom = "2020-01",
  dateTo = "2026-12",
  area?: string,
  granularity: TrendGranularity = "month"
) {
  return useQuery({
    queryKey: ["trends_volume", dateFrom, dateTo, area, granularity],
    queryFn: () =>
      fetcher(
        `/api/trends/volume?dateFrom=${dateFrom}&dateTo=${dateTo}&granularity=${granularity}${area ? `&area=${area}` : ""}`
      ),
  });
}

export function usePriceTrends(
  dateFrom = "2020-01",
  dateTo = "2026-12",
  area?: string,
  granularity: TrendGranularity = "month"
) {
  return useQuery({
    queryKey: ["trends_prices", dateFrom, dateTo, area, granularity],
    queryFn: () =>
      fetcher(
        `/api/trends/prices?dateFrom=${dateFrom}&dateTo=${dateTo}&granularity=${granularity}${area ? `&area=${area}` : ""}`
      ),
  });
}

export function useOffplanTrends(
  dateFrom = "2020-01",
  dateTo = "2026-12",
  granularity: TrendGranularity = "month"
) {
  return useQuery({
    queryKey: ["trends_offplan", dateFrom, dateTo, granularity],
    queryFn: () =>
      fetcher(`/api/trends/offplan?dateFrom=${dateFrom}&dateTo=${dateTo}&granularity=${granularity}`),
  });
}

export function useAreas(limit = 30) {
  return useQuery({
    queryKey: ["areas", limit],
    queryFn: () => fetcher(`/api/areas?limit=${limit}`),
  });
}

export function useAreaDetail(area: string, dateFrom = "2022-01") {
  return useQuery({
    queryKey: ["area_detail", area, dateFrom],
    queryFn: () =>
      fetcher(`/api/areas/${encodeURIComponent(area)}?dateFrom=${dateFrom}`),
    enabled: !!area,
  });
}

export function usePropertyTypes(dateFrom = "2020-01", dateTo = "2026-12") {
  return useQuery({
    queryKey: ["property_types", dateFrom, dateTo],
    queryFn: () =>
      fetcher(`/api/property-types?dateFrom=${dateFrom}&dateTo=${dateTo}`),
  });
}

export function useRooms(dateFrom = "2020-01", dateTo = "2026-12", area?: string) {
  return useQuery({
    queryKey: ["rooms", dateFrom, dateTo, area],
    queryFn: () =>
      fetcher(
        `/api/rooms?dateFrom=${dateFrom}&dateTo=${dateTo}${area ? `&area=${area}` : ""}`
      ),
  });
}

export function useProjects(limit = 50, dateFrom = "2025-01", area?: string) {
  return useQuery({
    queryKey: ["projects", limit, dateFrom, area],
    queryFn: () =>
      fetcher(
        `/api/projects?limit=${limit}&dateFrom=${dateFrom}${area ? `&area=${area}` : ""}`
      ),
  });
}

export function useTransactions(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["transactions", qs],
    queryFn: () => fetcher(`/api/transactions?${qs}`),
  });
}

export function useCrisisComparison(params?: {
  preStart?: string;
  preEnd?: string;
  postStart?: string;
  postEnd?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.preStart) qs.set("preStart", params.preStart);
  if (params?.preEnd) qs.set("preEnd", params.preEnd);
  if (params?.postStart) qs.set("postStart", params.postStart);
  if (params?.postEnd) qs.set("postEnd", params.postEnd);
  const suffix = qs.toString();

  return useQuery({
    queryKey: ["crisis_comparison", params?.preStart, params?.preEnd, params?.postStart, params?.postEnd],
    queryFn: () => fetcher(`/api/crisis/comparison${suffix ? `?${suffix}` : ""}`),
  });
}

export function useCrisisIndexed(metric = "sales_count", monthsAfter = 12) {
  return useQuery({
    queryKey: ["crisis_indexed", metric, monthsAfter],
    queryFn: () =>
      fetcher(`/api/crisis/indexed?metric=${metric}&monthsAfter=${monthsAfter}`),
  });
}

export function useCrisisResilience() {
  return useQuery({
    queryKey: ["crisis_resilience"],
    queryFn: () => fetcher("/api/crisis/resilience"),
  });
}

export function useDistribution(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["distribution", qs],
    queryFn: () => fetcher(`/api/distribution?${qs}`),
  });
}

export function useCrisisDaily(dateFrom = "2026-01-01", dateTo = "2026-04-08") {
  return useQuery({
    queryKey: ["crisis_daily", dateFrom, dateTo],
    queryFn: () => fetcher(`/api/crisis/daily?dateFrom=${dateFrom}&dateTo=${dateTo}`),
  });
}

export function useCrisisSectors(params?: {
  preStart?: string;
  preEnd?: string;
  postStart?: string;
  postEnd?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.preStart) qs.set("preStart", params.preStart);
  if (params?.preEnd) qs.set("preEnd", params.preEnd);
  if (params?.postStart) qs.set("postStart", params.postStart);
  if (params?.postEnd) qs.set("postEnd", params.postEnd);
  const suffix = qs.toString();

  return useQuery({
    queryKey: ["crisis_sectors", params?.preStart, params?.preEnd, params?.postStart, params?.postEnd],
    queryFn: () => fetcher(`/api/crisis/sectors${suffix ? `?${suffix}` : ""}`),
  });
}

export function useCrisisAreasImpact(params?: {
  preStart?: string;
  preEnd?: string;
  postStart?: string;
  postEnd?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.preStart) qs.set("preStart", params.preStart);
  if (params?.preEnd) qs.set("preEnd", params.preEnd);
  if (params?.postStart) qs.set("postStart", params.postStart);
  if (params?.postEnd) qs.set("postEnd", params.postEnd);
  if (params?.limit) qs.set("limit", String(params.limit));
  const suffix = qs.toString();

  return useQuery({
    queryKey: ["crisis_areas_impact", params?.preStart, params?.preEnd, params?.postStart, params?.postEnd, params?.limit],
    queryFn: () => fetcher(`/api/crisis/areas-impact${suffix ? `?${suffix}` : ""}`),
  });
}

export function useCrisisProjectsImpact(params?: {
  preStart?: string;
  preEnd?: string;
  postStart?: string;
  postEnd?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.preStart) qs.set("preStart", params.preStart);
  if (params?.preEnd) qs.set("preEnd", params.preEnd);
  if (params?.postStart) qs.set("postStart", params.postStart);
  if (params?.postEnd) qs.set("postEnd", params.postEnd);
  const suffix = qs.toString();

  return useQuery({
    queryKey: ["crisis_projects_impact", params?.preStart, params?.preEnd, params?.postStart, params?.postEnd],
    queryFn: () => fetcher(`/api/crisis/projects-impact${suffix ? `?${suffix}` : ""}`),
  });
}

export function useCrisisYoyPacing(year = 2026, endDate = "2026-04-08") {
  return useQuery({
    queryKey: ["crisis_yoy_pacing", year, endDate],
    queryFn: () => fetcher(`/api/crisis/yoy-pacing?year=${year}&endDate=${endDate}`),
  });
}

export function useCrisisMarketComposition(dateFrom = "2025-11-01", dateTo = "2026-04-08") {
  return useQuery({
    queryKey: ["crisis_market_composition", dateFrom, dateTo],
    queryFn: () => fetcher(`/api/crisis/market-composition?dateFrom=${dateFrom}&dateTo=${dateTo}`),
  });
}

export function useFilterAreas() {
  return useQuery({
    queryKey: ["filter_areas"],
    queryFn: () => fetcher("/api/filters/areas"),
    staleTime: 1000 * 60 * 60,
  });
}

export function useCrisisGeo(params: {
  preStart?: string;
  preEnd?: string;
  postStart?: string;
  postEnd?: string;
} = {}) {
  const qs = new URLSearchParams();
  if (params.preStart) qs.set("preStart", params.preStart);
  if (params.preEnd) qs.set("preEnd", params.preEnd);
  if (params.postStart) qs.set("postStart", params.postStart);
  if (params.postEnd) qs.set("postEnd", params.postEnd);
  const url = `/api/crisis/geo${qs.toString() ? `?${qs}` : ""}`;
  return useQuery({
    queryKey: ["crisis_geo", params.preStart, params.preEnd, params.postStart, params.postEnd],
    queryFn: () => fetcher(url),
  });
}

export function useGeoData(level: "area" | "project" = "area", dateFrom = "2020-01", dateTo = "2026-12") {
  return useQuery({
    queryKey: ["geo", level, dateFrom, dateTo],
    queryFn: () => fetcher(`/api/geo?level=${level}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
    staleTime: 1000 * 60 * 60,
  });
}
