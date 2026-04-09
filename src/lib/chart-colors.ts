import { useTheme } from "@/lib/theme";

// Data colors — work on both light and dark backgrounds
const DATA_COLORS = {
  primary: "#4e80ee",
  secondary: "#0dff81",
  tertiary: "#f5a623",
  red: "#e05555",
  purple: "#9678b8",
  cyan: "#4ec8d4",
  orange: "#e8943a",
};

const DARK_UI = {
  grid: "rgba(255,255,255,0.04)",
  text: "rgba(255,255,255,0.40)",
  muted: "rgba(255,255,255,0.10)",
  readyFill: "rgba(255,255,255,0.08)",
};

const LIGHT_UI = {
  grid: "rgba(0,0,0,0.06)",
  text: "rgba(0,0,0,0.45)",
  muted: "rgba(0,0,0,0.08)",
  readyFill: "rgba(0,0,0,0.06)",
};

// Static export for data colors that don't change with theme
export const CHART_COLORS = {
  ...DATA_COLORS,
  ...DARK_UI,
};

// Hook that returns theme-aware chart colors
export function useChartColors() {
  const { theme } = useTheme();
  const ui = theme === "light" ? LIGHT_UI : DARK_UI;
  return { ...DATA_COLORS, ...ui };
}

export const PIE_COLORS = [
  DATA_COLORS.primary,
  DATA_COLORS.secondary,
  DATA_COLORS.tertiary,
  DATA_COLORS.purple,
  DATA_COLORS.cyan,
  DATA_COLORS.red,
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
