"use client";

import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string;
  changeMom?: number | null;
  changeYoy?: number | null;
  changeKind?: "percent" | "percentage_points";
  sparkline?: number[];
  unit?: string;
  className?: string;
  variant?: "hero" | "compact";
  animationDelay?: number;
}

function ChangeIndicator({
  value,
  suffix,
  label,
  className,
}: {
  value: number | null | undefined;
  suffix: string;
  label: string;
  className?: string;
}) {
  if (value == null) return null;
  const color =
    value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-muted-foreground";
  const Icon = value === 0 ? Minus : value > 0 ? TrendingUp : TrendingDown;

  return (
    <div className={cn("flex items-center gap-1 text-xs", color, className)}>
      <Icon className="w-3 h-3" />
      <span>
        {value > 0 ? "+" : ""}
        {value.toFixed(1)}
        {suffix}
      </span>
      <span className="text-muted-foreground/50 text-[10px]">{label}</span>
    </div>
  );
}

export function KPICard({
  label,
  value,
  changeMom,
  changeYoy,
  changeKind = "percent",
  sparkline,
  className,
  variant = "compact",
  animationDelay = 0,
}: KPICardProps) {
  const suffix = changeKind === "percentage_points" ? "pp" : "%";
  const sparkData = sparkline?.map((v, i) => ({ i, v })) || [];
  const sparkColor = changeMom != null && changeMom >= 0 ? "#4e80ee" : "#e05555";

  if (variant === "hero") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-card p-3 sm:p-5 animate-fade-up",
          className
        )}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-xl sm:text-3xl font-semibold mt-1.5 sm:mt-2 text-foreground tracking-tight">
          {value}
        </p>
        <div className="flex items-center gap-2 sm:gap-4 mt-2 sm:mt-3">
          <ChangeIndicator value={changeMom} suffix={suffix} label="MoM" />
          <ChangeIndicator value={changeYoy} suffix={suffix} label="YoY" />
        </div>
        {sparkData.length > 2 && (
          <div className="mt-2 sm:mt-4 h-10 sm:h-12 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  // Compact variant — no sparkline, tighter layout
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3 animate-fade-up min-w-0",
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-base sm:text-xl font-semibold mt-1 text-foreground tracking-tight truncate">
        {value}
      </p>
      <div className="flex items-center gap-3 mt-1.5">
        <ChangeIndicator value={changeMom} suffix={suffix} label="MoM" />
        <ChangeIndicator value={changeYoy} suffix={suffix} label="YoY" />
      </div>
    </div>
  );
}
