export interface ThemePreset {
  id: string;
  label: string;
  accent: string;
  accentDark: string;
  accentTint: string;
}

// Presets curés (pas de color picker libre) pour éviter les combinaisons illisibles.
export const THEME_PRESETS: ThemePreset[] = [
  { id: "route", label: "Vert (défaut)", accent: "#0F7B6C", accentDark: "#0B5C51", accentTint: "#E6F4F1" },
  { id: "amber", label: "Ambre", accent: "#D98E28", accentDark: "#A6691C", accentTint: "#FBF1DF" },
  { id: "indigo", label: "Indigo", accent: "#4F46E5", accentDark: "#3730A3", accentTint: "#EEF2FF" },
  { id: "rose", label: "Rose", accent: "#E11D48", accentDark: "#9F1239", accentTint: "#FFF1F2" },
  { id: "slate", label: "Ardoise", accent: "#334155", accentDark: "#1E293B", accentTint: "#F1F5F9" },
];

export const THEME_PAR_DEFAUT = THEME_PRESETS[0];

export function getTheme(id: string | null | undefined): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PAR_DEFAUT;
}
