"use client";

import { cn } from "@/lib/utils";

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  variant?: "card" | "hero";
  animationDelay?: number;
}

export function ChartContainer({
  title,
  subtitle,
  children,
  className,
  action,
  variant = "card",
  animationDelay = 0,
}: ChartContainerProps) {
  const isHero = variant === "hero";

  return (
    <div
      className={cn(
        "animate-fade-up",
        isHero
          ? "py-2"
          : "rounded-lg border border-border bg-card p-3 sm:p-4",
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className={cn("flex items-start justify-between gap-2 flex-wrap", isHero ? "mb-3 sm:mb-5" : "mb-3 sm:mb-4")}>
        <div>
          <h3
            className={cn(
              "font-semibold text-foreground",
              isHero ? "text-base" : "text-sm"
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}
