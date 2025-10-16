"use client";

import { forwardRef, memo, useMemo } from "react";
import type { HTMLAttributes } from "react";
import clsx from "clsx";
import {
  FontWeight,
  FontStyle,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_WEIGHT,
  DEFAULT_FONT_STYLE,
} from "../constants/default";
import { getFontStyles } from "../utils/fontUtils";

export interface ThemedTextProps
  extends HTMLAttributes<HTMLSpanElement> {
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
  fontSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

const ThemedTextComponent = forwardRef<HTMLSpanElement, ThemedTextProps>(
  (props, ref) => {
    const {
      fontWeight = DEFAULT_FONT_WEIGHT,
      fontStyle = DEFAULT_FONT_STYLE,
      fontSize = DEFAULT_FONT_SIZE,
      className,
      style,
      children,
      ...restProps
    } = props;

    // Memoize font-related inline styles
    const fontStyles = useMemo<React.CSSProperties>(
      () => getFontStyles(fontWeight, fontStyle, fontSize),
      [fontWeight, fontStyle, fontSize]
    );

    return (
      <span
        ref={ref}
        className={clsx(className)}
        style={{ ...fontStyles, ...style }}
        {...restProps}
      >
        {children}
      </span>
    );
  }
);

ThemedTextComponent.displayName = "ThemedText";

export const ThemedText = memo(ThemedTextComponent);
ThemedText.displayName = "ThemedText";

export type ThemedTextType = typeof ThemedText;
