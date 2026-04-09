export interface Transaction {
  _id: string;
  transaction_id: string;
  instance_date: Date;
  year: number;
  month: number;
  year_month: string;
  quarter: string;
  trans_group_en: string;
  procedure_name_en: string;
  is_offplan: string;
  is_freehold: string;
  property_usage_en: string;
  normalized_area: string;
  display_area: string;
  area_name_en: string;
  property_type_en: string;
  property_sub_type_en: string;
  amount: number;
  procedure_area: number;
  meter_sale_price: number;
  rent_value: number | null;
  meter_rent_price: number | null;
  rooms_en: string;
  has_parking: boolean;
  nearest_metro_en: string;
  nearest_mall_en: string;
  nearest_landmark_en: string;
  num_buyers: number;
  num_sellers: number;
  master_project_en: string;
  project_name_en: string;
  building_name_en: string;
  source: string;
}

export interface KPI {
  label: string;
  value: number;
  formatted: string;
  change_mom: number | null;
  change_yoy: number | null;
  change_kind?: "percent" | "percentage_points";
  period_type?: "complete_month" | "date_window";
  sparkline: number[];
}

export interface TrendPoint {
  period: string;
  year: number;
  month: number;
  count: number;
  volume: number;
  avg_price: number;
  avg_sqm_price: number;
  median_sqm_price?: number;
  offplan_count: number;
  ready_count: number;
  offplan_ratio: number;
}

export interface AreaStats {
  normalized_area: string;
  display_area: string;
  sales_count: number;
  sales_volume: number;
  avg_price: number;
  avg_sqm_price: number;
  offplan_ratio: number;
  avg_area_sqm: number;
  mom_volume_change: number | null;
  yoy_volume_change: number | null;
  mom_price_change: number | null;
  yoy_price_change: number | null;
}

export interface ProjectStats {
  project_name_en: string;
  master_project_en: string;
  normalized_area: string;
  display_area: string;
  sales_count: number;
  sales_volume: number;
  avg_price: number;
  avg_sqm_price: number;
  offplan_ratio: number;
  dominant_room: string;
}

export interface CrisisComparison {
  metric: string;
  pre_value: number;
  post_value: number;
  change_pct: number;
  change_kind?: "percent" | "percentage_points";
  period_type?: "complete_month" | "date_window";
}

export interface FilterOptions {
  areas: { value: string; label: string }[];
  property_types: string[];
  property_usages: string[];
  rooms: string[];
}

export interface DashboardFilters {
  dateFrom: string;
  dateTo: string;
  transGroup: string[];
  propertyUsage: string[];
  propertyType: string[];
  isOffplan: string;
  area: string[];
}
