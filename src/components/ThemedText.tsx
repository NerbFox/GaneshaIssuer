'use client';

import { forwardRef, memo, useMemo } from 'react';
import type { HTMLAttributes } from 'react';
import clsx from 'clsx';
import {
  FontWeight,
  FontStyle,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_WEIGHT,
  DEFAULT_FONT_STYLE,
} from '../constants/default';
import { getFontStyles } from '../utils/fontUtils';

export interface ThemedTextProps extends HTMLAttributes<HTMLSpanElement> {
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
  fontSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

const ThemedTextComponent = forwardRef<HTMLSpanElement, ThemedTextProps>((props, ref) => {
  const {
    fontWeight = DEFAULT_FONT_WEIGHT,
    fontStyle = DEFAULT_FONT_STYLE,
    fontSize = DEFAULT_FONT_SIZE,
    className,
    style,
    children,
    ...restProps
  } = props;

  // Check if className contains a Tailwind text size class
  const hasTailwindTextSize = useMemo(() => {
    if (!className) return false;
    // Match text-{size} classes like text-sm, text-xl, text-[28px], etc.
    return /text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[[^\]]+\])/.test(className);
  }, [className]);

  // Memoize font-related inline styles
  const fontStyles = useMemo<React.CSSProperties>(() => {
    const styles = getFontStyles(fontWeight, fontStyle, fontSize);
    // If Tailwind text size class is present, remove fontSize from inline styles
    if (hasTailwindTextSize) {
      const { fontSize: _, ...stylesWithoutFontSize } = styles;
      return stylesWithoutFontSize;
    }
    return styles;
  }, [fontWeight, fontStyle, fontSize, hasTailwindTextSize]);

  return (
    <span ref={ref} className={clsx(className)} style={{ ...fontStyles, ...style }} {...restProps}>
      {children}
    </span>
  );
});

ThemedTextComponent.displayName = 'ThemedText';

export const ThemedText = memo(ThemedTextComponent);
ThemedText.displayName = 'ThemedText';

export type ThemedTextType = typeof ThemedText;
