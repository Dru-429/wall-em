// Design tokens derived from the Pinterest-style DESIGN.md system.
// Warm-cream chrome, single saturated red accent, Inter-substitute typography.

import { TextStyle } from "react-native";

export const colors = {
  primary: "#e60023",
  onPrimary: "#ffffff",
  primaryPressed: "#cc001f",

  ink: "#000000",
  inkSoft: "#211922",
  body: "#33332e",
  charcoal: "#262622",
  mute: "#62625b",
  ash: "#91918c",
  stone: "#c8c8c1",
  hairline: "#dadad3",
  hairlineSoft: "#e5e5e0",

  secondaryBg: "#e5e5e0",
  secondaryPressed: "#c8c8c1",

  canvas: "#ffffff",
  surfaceSoft: "#fbfbf9",
  surfaceCard: "#f6f6f3",
  surfaceElevated: "#ffffff",
  surfaceDark: "#262622",

  onDark: "#ffffff",
  onDarkMute: "rgba(255,255,255,0.7)",

  error: "#9e0a0a",
  success: "#103c25",
} as const;

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  section: 64,
} as const;

export const radius = {
  none: 0,
  sm: 8,
  md: 16,
  lg: 32,
  full: 9999,
} as const;

// Typography scale. Pin Sans is proprietary; system sans is the substitute,
// negative tracking preserved on display sizes per the brand voice.
export const type = {
  displayXl: { fontSize: 44, fontWeight: "700", letterSpacing: -1.2, lineHeight: 48 },
  headingXl: { fontSize: 28, fontWeight: "700", letterSpacing: -1.0, lineHeight: 34 },
  headingLg: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3, lineHeight: 28 },
  headingMd: { fontSize: 18, fontWeight: "600", lineHeight: 24 },
  bodyMd: { fontSize: 16, fontWeight: "400", lineHeight: 22 },
  bodyStrong: { fontSize: 16, fontWeight: "600", lineHeight: 22 },
  bodySm: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
  bodySmStrong: { fontSize: 14, fontWeight: "700", lineHeight: 20 },
  captionMd: { fontSize: 12, fontWeight: "500", lineHeight: 16 },
  button: { fontSize: 14, fontWeight: "700", lineHeight: 16 },
} satisfies Record<string, TextStyle>;

// Background swatch options for the editor canvas.
export const CANVAS_BACKGROUNDS = [
  "#000000",
  "#1c1c1e",
  "#262622",
  "#ffffff",
  "#f6f6f3",
  "#e60023",
  "#103c25",
  "#211922",
  "#0a2540",
  "#3a1d2e",
];

// Text colour options for text layers in the editor.
export const TEXT_COLORS = [
  "#ffffff",
  "#000000",
  "#e60023",
  "#f5c518",
  "#4cd964",
  "#0a84ff",
  "#c8c8c1",
];
