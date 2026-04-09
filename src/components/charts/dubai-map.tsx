"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatAED, formatNumber, formatPricePerSqm } from "@/lib/constants";

export interface MapPoint {
  name: string;
  display_name?: string;
  lat: number;
  lng: number;
  sales_count: number;
  sales_volume: number;
  avg_sqm_price: number | null;
  avg_price: number | null;
  offplan_ratio?: number;
  normalized_area?: string;
  project_name_en?: string;
}

type ColorMetric = "avg_sqm_price" | "sales_count" | "sales_volume" | "offplan_ratio";

function getColor(value: number, min: number, max: number): string {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  // Blue (cold/low) → Cyan → Green → Yellow → Red (hot/high)
  const r = Math.round(t < 0.5 ? 0 : t < 0.75 ? (t - 0.5) * 4 * 255 : 255);
  const g = Math.round(t < 0.25 ? t * 4 * 255 : t < 0.75 ? 255 : (1 - t) * 4 * 255);
  const b = Math.round(t < 0.5 ? (1 - t * 2) * 255 : 0);
  return `rgb(${r},${g},${b})`;
}

function getRadius(count: number, maxCount: number): number {
  const minR = 6;
  const maxR = 35;
  const t = maxCount <= 1 ? 0.5 : Math.sqrt(count) / Math.sqrt(maxCount);
  return minR + t * (maxR - minR);
}

export function DubaiMap({
  data,
  colorMetric = "avg_sqm_price",
  level = "area",
}: {
  data: MapPoint[];
  colorMetric?: ColorMetric;
  level?: "area" | "project";
}) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [25.15, 55.27],
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when data or metric changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || data.length === 0) return;

    layer.clearLayers();

    const values = data
      .map((d) => {
        if (colorMetric === "offplan_ratio") return (d.offplan_ratio ?? 0) * 100;
        return (d[colorMetric] as number) ?? 0;
      })
      .filter((v) => v > 0);

    if (values.length === 0) return;

    const sorted = [...values].sort((a, b) => a - b);
    const p5 = sorted[Math.floor(sorted.length * 0.05)] ?? sorted[0];
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
    const maxCount = Math.max(...data.map((d) => d.sales_count));

    for (const point of data) {
      const raw = colorMetric === "offplan_ratio"
        ? (point.offplan_ratio ?? 0) * 100
        : (point[colorMetric] as number) ?? 0;
      const clamped = Math.max(p5, Math.min(p95, raw));
      const color = getColor(clamped, p5, p95);
      const radius = getRadius(point.sales_count, maxCount);

      const displayName = point.display_name || point.name;
      const area = point.normalized_area || "";

      const tooltipHtml = `
        <div class="map-tip-inner">
          <div class="map-tip-title">${displayName}</div>
          ${level === "project" && area ? `<div class="map-tip-sub">${area}</div>` : ""}
          <div class="map-tip-divider"></div>
          <div class="map-tip-row">Sales <span>${formatNumber(point.sales_count)}</span></div>
          <div class="map-tip-row">Volume <span>${formatAED(point.sales_volume)}</span></div>
          ${point.avg_sqm_price ? `<div class="map-tip-row">Avg/sqm <span>${formatPricePerSqm(point.avg_sqm_price)}</span></div>` : ""}
          ${point.avg_price ? `<div class="map-tip-row">Avg Price <span>${formatAED(point.avg_price)}</span></div>` : ""}
          ${point.offplan_ratio != null ? `<div class="map-tip-row">Off-Plan <span>${(point.offplan_ratio * 100).toFixed(0)}%</span></div>` : ""}
        </div>
      `;

      L.circleMarker([point.lat, point.lng], {
        radius,
        fillColor: color,
        color: "rgba(255,255,255,0.3)",
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.7,
      })
        .bindTooltip(tooltipHtml, {
          permanent: false,
          direction: "top",
          className: "map-tooltip-dark",
          offset: [0, -radius],
        })
        .addTo(layer);
    }
  }, [data, colorMetric, level]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg overflow-hidden"
      style={{ minHeight: 500, background: "#0d1117" }}
    />
  );
}
