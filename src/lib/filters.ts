export interface FilterParams {
  dateFrom?: string;
  dateTo?: string;
  transGroup?: string | string[];
  propertyUsage?: string | string[];
  propertyType?: string | string[];
  isOffplan?: string;
  area?: string | string[];
  rooms?: string | string[];
  project?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

export function parseFilterParams(searchParams: URLSearchParams): FilterParams {
  return {
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    transGroup: searchParams.get("transGroup") || undefined,
    propertyUsage: searchParams.get("propertyUsage") || undefined,
    propertyType: searchParams.get("propertyType") || undefined,
    isOffplan: searchParams.get("isOffplan") || undefined,
    area: searchParams.get("area") || undefined,
    rooms: searchParams.get("rooms") || undefined,
    project: searchParams.get("project") || undefined,
    minAmount: searchParams.get("minAmount") ? Number(searchParams.get("minAmount")) : undefined,
    maxAmount: searchParams.get("maxAmount") ? Number(searchParams.get("maxAmount")) : undefined,
    search: searchParams.get("search") || undefined,
  };
}

export function toArray(val: string | string[] | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return val
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
