export const CRISIS_DATE = "2026-02-28";
export const CRISIS_LABEL = "Hormuz Strait Disruption";

export const PRE_CRISIS_START = "2025-12-01";
export const PRE_CRISIS_END = "2026-02-28";
export const POST_CRISIS_START = "2026-03-01";
export const POST_CRISIS_END = "2026-04-08";

export const HISTORICAL_CRISES = [
  { id: "oil2015", label: "Oil Price Crash", date: "2015-01-01" },
  { id: "covid", label: "COVID-19", date: "2020-03-01" },
  { id: "hormuz", label: "Hormuz Strait Disruption", date: "2026-02-28" },
];

export const AREA_NAME_MAP: Record<string, string> = {
  "DUBAI MARINA": "Marsa Dubai",
  "JUMEIRAH VILLAGE CIRCLE": "Al Barsha South Fourth",
  "BURJ KHALIFA / DOWNTOWN": "Burj Khalifa",
  "JUMEIRAH VILLAGE TRIANGLE": "Al Thanyah Fifth",
  "DUBAI HILLS": "Hadaeq Sheikh Mohammed Bin Rashid",
  "DUBAI LAND RESIDENCE COMPLEX": "Wadi Al Safa 5",
  "SILICON OASIS": "Me'Aisem First",
  "PALM JUMEIRAH": "Palm Jumeirah",
  "BUSINESS BAY": "Business Bay",
  "DUBAI CREEK HARBOUR": "Al Khairan First",
  "MOTOR CITY": "Al Hebiah Fourth",
  "DUBAI SPORTS CITY": "Al Merkadh",
  "ARJAN": "Al Barshaa South Third",
  "MAJAN": "Wadi Al Safa 3",
  "DUBAI SOUTH": "Madinat Al Mataar",
  "JUMEIRAH LAKES TOWERS": "Al Thanyah Third",
  "PALM DEIRA": "Palm Deira",
  "DUBAI INVESTMENT PARK FIRST": "Dubai Investment Park First",
  "DUBAI INVESTMENT PARK SECOND": "Dubai Investment Park Second",
  "INTERNATIONAL CITY PH 1": "Al Warsan First",
  "Warsan First": "Al Warsan First",
  "EMIRATE LIVING": "Al Thanayah Fourth",
  "DUBAI MARITIME CITY": "Madinat Dubai Almelaheyah",
  "BARSHA HEIGHTS": "Al Thanyah First",
  "INTERNATIONAL CITY PH 2 & 3": "Warsan Fourth",
  "DUBAI STUDIO CITY": "Al Hebiah Second",
  "DOWN TOWN JABAL ALI": "Jabal Ali Industrial Second",
  "THE VILLA": "Al Ruwayyah",
  "TECOM SITE A": "Al Safouh Second",
  "THE WORLD": "World Islands",
  "DUBAI WATER FRONT": "Hessyan First",
  "HORIZON": "Bukadra",
  "SAMA AL JADAF": "Al Jadaf",
};

// Reverse map: historical name -> display name
export const DISPLAY_NAME_MAP: Record<string, string> = {
  "Marsa Dubai": "Dubai Marina",
  "Al Barsha South Fourth": "Jumeirah Village Circle (JVC)",
  "Burj Khalifa": "Downtown Dubai",
  "Al Thanyah Fifth": "Jumeirah Village Triangle (JVT)",
  "Hadaeq Sheikh Mohammed Bin Rashid": "Dubai Hills Estate",
  "Wadi Al Safa 5": "Dubai Land Residence Complex",
  "Me'Aisem First": "Dubai Silicon Oasis (DSO)",
  "Palm Jumeirah": "Palm Jumeirah",
  "Business Bay": "Business Bay",
  "Al Khairan First": "Dubai Creek Harbour",
  "Al Hebiah Fourth": "Motor City",
  "Al Merkadh": "Dubai Sports City",
  "Al Barshaa South Third": "Arjan",
  "Wadi Al Safa 3": "Majan",
  "Madinat Al Mataar": "Dubai South",
  "Al Thanyah Third": "Jumeirah Lakes Towers (JLT)",
  "Al Warsan First": "International City",
  "Jabal Ali First": "Jebel Ali",
  "Al Thanayah Fourth": "Emirates Living",
  "Madinat Dubai Almelaheyah": "Dubai Maritime City",
  "Al Thanyah First": "Barsha Heights (TECOM)",
  "Warsan Fourth": "International City Phase 2 & 3",
  "Al Hebiah Second": "Dubai Studio City",
  "Jabal Ali Industrial Second": "Downtown Jebel Ali",
  "Al Ruwayyah": "The Villa",
  "Al Safouh Second": "TECOM / Al Sufouh",
  "World Islands": "The World Islands",
  "Hessyan First": "Dubai Waterfront",
  "Bukadra": "Horizon / Bukadra",
  "Al Jadaf": "Al Jadaf",
};

export const formatAED = (value: number): string => {
  if (value >= 1_000_000_000) return `AED ${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `AED ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `AED ${(value / 1_000).toFixed(0)}K`;
  return `AED ${value.toFixed(0)}`;
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
};

export const formatPercent = (value: number): string => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
};

export const formatPercentagePoints = (value: number): string => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}pp`;
};

export const formatPricePerSqm = (value: number): string => {
  return `${formatNumber(value)} /sqm`;
};

export const formatSqm = (value: number): string => {
  return `${formatNumber(value)} sqm`;
};
