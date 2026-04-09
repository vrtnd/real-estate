"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MapPin,
  Building2,
  FolderKanban,
  AlertTriangle,
  Table2,
  Globe,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/lib/theme";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: Globe },
  { href: "/areas", label: "Areas", icon: MapPin },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/crisis", label: "Crisis Monitor", icon: AlertTriangle },
  { href: "/transactions", label: "Transactions", icon: Table2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle: toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const activeLabel = NAV_ITEMS.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  )?.label;

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden h-12 bg-sidebar border-b border-border flex items-center px-3 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 -ml-1 rounded-md hover:bg-muted/40 active:bg-muted/60 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-foreground/80" />
        </button>
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <Image
            src="/assets/llama-icon.svg"
            alt="DefiLlama"
            width={22}
            height={22}
            className="shrink-0"
            priority
          />
          <span className="text-[13px] font-semibold text-foreground/90 truncate">
            {activeLabel || "DefiLlama"}
          </span>
        </Link>
      </div>

      {/* ── Overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar drawer ── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-[220px] border-r border-border bg-sidebar flex flex-col transition-transform duration-200 ease-out",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="relative border-b border-border overflow-hidden">
          {/* Cross grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
              backgroundSize: "14px 14px",
            }}
          />
          {/* Subtle corner radial */}
          <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-primary/8 blur-2xl" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
          <div className="flex items-center justify-between">
            <Link href="/" className="relative flex items-center gap-3 px-4 py-4 group flex-1">
              <Image src="/assets/llama-icon.svg" alt="DefiLlama" width={32} height={32} className="shrink-0" priority />
              <div className="min-w-0">
                <span className="text-[15px] font-bold text-foreground leading-none block tracking-tight">DefiLlama</span>
                <span className="text-[10px] text-primary/60 leading-none mt-1.5 block font-medium tracking-wide uppercase">Dubai Real Estate</span>
              </div>
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="p-2 mr-2 md:hidden rounded-md hover:bg-muted/50"
              aria-label="Close menu"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors relative",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
                )}
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-border flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">
              DLD · 2004 – Apr 2026
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              1.68M transactions
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-sidebar-accent transition-colors shrink-0"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Moon className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
