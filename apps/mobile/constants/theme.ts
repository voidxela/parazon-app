/** Central design token registry for Parazon mobile. */
export const Colors = {
  background: {
    primary: "#121212",
    elevated: "#1E1E1E",
    surface: "#0A0A0A",
  },
  accent: {
    gold: "#C8A951",
    crimson: "#E53935",
    cyan: "#00E5FF",
  },
  text: {
    primary: "#F0F0F0",
    secondary: "#AAAAAA",
    muted: "#555555",
  },
  border: {
    default: "#2A2A2A",
    subtle: "#1E1E1E",
  },
} as const;

export type ColorToken = typeof Colors;
