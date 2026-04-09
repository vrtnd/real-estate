"use client";

import { useState } from "react";
import { useTransactions } from "@/hooks/use-dashboard";
import { formatAED, formatNumber } from "@/lib/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

interface Transaction {
  transaction_id: string;
  instance_date: string;
  trans_group_en: string;
  is_offplan: string;
  property_usage_en: string;
  display_area: string;
  property_type_en: string;
  property_sub_type_en: string;
  amount: number;
  procedure_area: number;
  meter_sale_price: number;
  rooms_en: string;
  project_name_en: string;
}

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [transGroup, setTransGroup] = useState("Sales");

  const params: Record<string, string> = {
    page: String(page),
    pageSize: "50",
    sortBy: "instance_date",
    sortDir: "desc",
  };
  if (transGroup) params.transGroup = transGroup;
  if (search) params.search = search;

  const { data, isLoading } = useTransactions(params);
  const transactions: Transaction[] = data?.data || [];
  const meta = data?.meta || { page: 1, totalPages: 1, totalCount: 0 };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Transaction Explorer</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Browse all {formatNumber(meta.totalCount)} transactions
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search project or area..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-8 w-full sm:w-[280px] bg-card border-border text-sm"
          />
        </div>
        <div className="flex gap-1">
          {["Sales", "Mortgage", "Gifts", ""].map((g) => (
            <button
              key={g}
              onClick={() => { setTransGroup(g); setPage(1); }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                transGroup === g
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {g || "All"}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          Page {meta.page} of {meta.totalPages}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="h-[600px] animate-pulse bg-muted/20" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Area</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Project</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Property</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Rooms</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-right">Size (sqm)</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-right">Amount (AED)</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-right">Price/sqm</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t, i) => (
                  <TableRow key={`${t.transaction_id}-${i}`} className="border-border">
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.instance_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          t.trans_group_en === "Sales"
                            ? "border-emerald-500/50 text-emerald-400"
                            : t.trans_group_en === "Mortgage"
                              ? "border-blue-500/50 text-blue-400"
                              : "border-purple-500/50 text-purple-400"
                        }`}
                      >
                        {t.trans_group_en}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">{t.display_area}</TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground">
                      {t.project_name_en || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.property_sub_type_en || t.property_type_en}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.rooms_en || "-"}</TableCell>
                    <TableCell className="text-right text-xs">
                      {t.procedure_area > 0 ? t.procedure_area.toFixed(0) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {formatAED(t.amount)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {t.meter_sale_price > 0 ? formatNumber(t.meter_sale_price) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          t.is_offplan === "Off-Plan"
                            ? "border-amber-500/50 text-amber-400"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {t.is_offplan}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {(meta.page - 1) * 50 + 1} - {Math.min(meta.page * 50, meta.totalCount)} of{" "}
          {formatNumber(meta.totalCount)}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-2 rounded-md border border-border hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm">{page}</span>
          <button
            onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
            disabled={page >= meta.totalPages}
            className="p-2 rounded-md border border-border hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
