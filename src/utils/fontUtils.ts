import type { CSSProperties } from "react";
import {
  FontWeight,
  FontStyle,
  DEFAULT_FONT_WEIGHT,
  DEFAULT_FONT_STYLE,
} from "../constants/default";

// Plus Jakarta Sans font family for Next.js
const PLUS_JAKARTA_SANS_FONT_FAMILY = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

export const getFontFamily = (
  fontWeight: FontWeight = DEFAULT_FONT_WEIGHT,
  fontStyle: FontStyle = DEFAULT_FONT_STYLE
): string => {
  // In Next.js with Google Fonts, we use the CSS variable and let CSS handle the weight/style
  return PLUS_JAKARTA_SANS_FONT_FAMILY;
};

export const getFontOptimizations = (): CSSProperties => {
  return {
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  } as CSSProperties;
};

export const getFontStyles = (
  fontWeight: FontWeight = DEFAULT_FONT_WEIGHT,
  fontStyle: FontStyle = DEFAULT_FONT_STYLE,
  fontSize: number
): CSSProperties => {
  return {
    fontFamily: getFontFamily(fontWeight, fontStyle),
    fontWeight: fontWeight as unknown as CSSProperties["fontWeight"],
    fontStyle: fontStyle as CSSProperties["fontStyle"],
    fontSize: `${fontSize}px`,
    ...getFontOptimizations(),
  };
};
