// DefiLlama blue palette — blue primary, green accent
export const CHART_COLORS = {
  // Primary data
  primary: "#4e80ee",      // DefiLlama blue
  secondary: "#0dff81",    // DefiLlama green accent
  tertiary: "#f5a623",     // Warm amber
  red: "#e05555",          // Soft red
  purple: "#9678b8",       // Lavender
  cyan: "#4ec8d4",         // Bright teal
  orange: "#e8943a",       // Orange

  // UI
  grid: "rgba(255,255,255,0.04)",
  text: "rgba(255,255,255,0.40)",
  muted: "rgba(255,255,255,0.10)",
};

export const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.tertiary,
  CHART_COLORS.purple,
  CHART_COLORS.cyan,
  CHART_COLORS.red,
];

export const PROPERTY_COLORS: Record<string, string> = {
  Unit: "#4e80ee",
  Villa: "#0dff81",
  Land: "#f5a623",
  Building: "#9678b8",
};

export const ROOM_COLORS: Record<string, string> = {
  Studio: "#4ec8d4",
  "1 B/R": "#4e80ee",
  "2 B/R": "#0dff81",
  "3 B/R": "#f5a623",
  "4 B/R": "#9678b8",
  "5 B/R": "#e05555",
};

export const CRISIS_LINE_COLORS: Record<string, string> = {
  oil2015: "#f5a623",
  covid: "#e05555",
  hormuz: "#4ec8d4",
};
