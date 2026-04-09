"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatNumber, formatPricePerSqm } from "@/lib/constants";
import { useTheme } from "@/lib/theme";

export interface CrisisMapPoint {
  area: string;
  display_area: string;
  lat: number;
  lng: number;
  pre_sales: number;
  post_sales: number;
  pre_daily: number;
  post_daily: number;
  volume_change_pct: number;
  price_change_pct: number | null;
  pre_avg_sqm: number | null;
  post_avg_sqm: number | null;
}

type CrisisMetric = "volume_change_pct" | "price_change_pct";

const TILES = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};
const BG = { dark: "#0d1117", light: "#f0f2f5" };
const STROKE = { dark: "rgba(255,255,255,0.25)", light: "rgba(0,0,0,0.15)" };

function divergingColor(value: number, absMax: number): string {
  const t = absMax === 0 ? 0 : Math.max(-1, Math.min(1, value / absMax));
  if (t < 0) {
    const intensity = -t;
    const r = Math.round(200 + 55 * intensity);
    const g = Math.round(80 * (1 - intensity));
    const b = Math.round(80 * (1 - intensity));
    return `rgb(${r},${g},${b})`;
  }
  const intensity = t;
  const r = Math.round(80 * (1 - intensity));
  const g = Math.round(180 + 75 * intensity);
  const b = Math.round(80 * (1 - intensity));
  return `rgb(${r},${g},${b})`;
}

function getRadius(count: number, maxCount: number): number {
  const t = maxCount <= 1 ? 0.5 : Math.sqrt(count) / Math.sqrt(maxCount);
  return 8 + t * 22;
}

export function CrisisMap({
  data,
  metric = "volume_change_pct",
}: {
  data: CrisisMapPoint[];
  metric?: CrisisMetric;
}) {
  const { theme } = useTheme();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [25.12, 55.23],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    tileRef.current = L.tileLayer(TILES[theme], {
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap tiles when theme changes
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return;
    tileRef.current.setUrl(TILES[theme]);
    if (containerRef.current) {
      containerRef.current.style.background = BG[theme];
    }
  }, [theme]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || data.length === 0) return;

    layer.clearLayers();

    const values = data
      .map((d) => metric === "price_change_pct" ? d.price_change_pct : d.volume_change_pct)
      .filter((v): v is number => v != null);

    const absMax = Math.max(10, ...values.map(Math.abs));
    const maxSales = Math.max(...data.map((d) => d.pre_sales));

    for (const point of data) {
      const val = metric === "price_change_pct" ? point.price_change_pct : point.volume_change_pct;
      if (val == null) continue;

      const color = divergingColor(val, absMax);
      const radius = getRadius(point.pre_sales, maxSales);

      const volSign = point.volume_change_pct >= 0 ? "+" : "";
      const priceSign = (point.price_change_pct ?? 0) >= 0 ? "+" : "";

      const volColor = point.volume_change_pct < 0 ? "#ef4444" : "#34d399";
      const priceColor = (point.price_change_pct ?? 0) < 0 ? "#ef4444" : "#34d399";

      const tooltipHtml = `
        <div class="map-tip-inner">
          <div class="map-tip-title">${point.display_area}</div>
          <div class="map-tip-divider"></div>
          <div class="map-tip-row">Volume <span style="color:${volColor}">${volSign}${point.volume_change_pct.toFixed(1)}%</span></div>
          ${point.price_change_pct != null ? `<div class="map-tip-row">Price/sqm <span style="color:${priceColor}">${priceSign}${point.price_change_pct.toFixed(1)}%</span></div>` : ""}
          <div class="map-tip-row map-tip-muted">Pre <span>${point.pre_daily}/day${point.pre_avg_sqm ? ` · ${formatPricePerSqm(point.pre_avg_sqm)}` : ""}</span></div>
          <div class="map-tip-row map-tip-muted">Post <span>${point.post_daily}/day${point.post_avg_sqm ? ` · ${formatPricePerSqm(point.post_avg_sqm)}` : ""}</span></div>
        </div>
      `;

      L.circleMarker([point.lat, point.lng], {
        radius,
        fillColor: color,
        color: STROKE[theme],
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.75,
      })
        .bindTooltip(tooltipHtml, {
          permanent: false,
          direction: "top",
          className: "map-tooltip-dark",
          offset: [0, -radius],
        })
        .addTo(layer);
    }
  }, [data, metric, theme]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg overflow-hidden"
      style={{ minHeight: 300, background: BG[theme] }}
    />
  );
}
