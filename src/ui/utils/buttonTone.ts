type ButtonVariant = "neutral" | "primary" | "success" | "danger" | "warning";
type ButtonSize = "md" | "sm" | "icon";

const sizeMap: Record<ButtonSize, string> = {
  md: "px-4 py-2",
  sm: "px-3 py-1.5 text-sm",
  icon: "p-2 text-sm"
};

const base =
  "inline-flex items-center gap-2 rounded-lg font-medium transition-all shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2";

const palette: Record<
  ButtonVariant,
  { dark: string; light: string; ringDark: string; ringLight: string }
> = {
  neutral: {
    dark: "bg-white/10 border border-white/25 text-gray-100 hover:bg-white/15",
    light:
      "bg-gray-900/5 border border-gray-400/50 text-gray-800 hover:bg-gray-900/10",
    ringDark: "focus:ring-blue-400 focus:ring-offset-gray-900",
    ringLight: "focus:ring-blue-300 focus:ring-offset-gray-100"
  },
  primary: {
    dark: "bg-blue-500/25 border border-blue-400/60 text-blue-100 hover:bg-blue-500/35",
    light:
      "bg-blue-600/10 border border-blue-500/40 text-blue-700 hover:bg-blue-600/20",
    ringDark: "focus:ring-blue-400 focus:ring-offset-gray-900",
    ringLight: "focus:ring-blue-300 focus:ring-offset-gray-100"
  },
  success: {
    dark: "bg-green-500/22 border border-green-400/55 text-green-100 hover:bg-green-500/32",
    light:
      "bg-green-600/12 border border-green-500/45 text-green-700 hover:bg-green-600/22",
    ringDark: "focus:ring-green-400 focus:ring-offset-gray-900",
    ringLight: "focus:ring-green-300 focus:ring-offset-gray-100"
  },
  danger: {
    dark: "bg-red-500/22 border border-red-400/55 text-red-100 hover:bg-red-500/32",
    light:
      "bg-red-600/12 border border-red-500/45 text-red-700 hover:bg-red-600/22",
    ringDark: "focus:ring-red-400 focus:ring-offset-gray-900",
    ringLight: "focus:ring-red-300 focus:ring-offset-gray-100"
  },
  warning: {
    dark: "bg-amber-500/20 border border-amber-400/55 text-amber-100 hover:bg-amber-500/30",
    light:
      "bg-amber-500/12 border border-amber-400/45 text-amber-700 hover:bg-amber-500/22",
    ringDark: "focus:ring-amber-400 focus:ring-offset-gray-900",
    ringLight: "focus:ring-amber-300 focus:ring-offset-gray-100"
  }
};

export function toneButton(
  variant: ButtonVariant,
  darkMode: boolean,
  size: ButtonSize = "md"
): string {
  const paletteItem = palette[variant];
  const surface = darkMode ? paletteItem.dark : paletteItem.light;
  const ring = darkMode ? paletteItem.ringDark : paletteItem.ringLight;
  return `${base} ${sizeMap[size]} ${surface} ${ring}`;
}
