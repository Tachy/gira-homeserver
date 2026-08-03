import type { CSSProperties } from 'react';
import type { VisuElement } from '../../api/types';

export function basePosition(el: VisuElement): CSSProperties {
  return {
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
  };
}

const ALIGN: Record<number, CSSProperties['textAlign']> = {
  1: 'left',
  2: 'center',
  3: 'right',
};

export function textAlign(align?: number): CSSProperties['textAlign'] {
  return (align !== undefined && ALIGN[align]) || 'left';
}

export function fontStyle(font?: string): CSSProperties {
  if (!font) return {};
  const match = font.match(/([\d.]+)pt\/([\d.]+)px/);
  if (!match) return {};
  const [, pt, px] = match;
  return {
    fontSize: `${pt}pt`,
    lineHeight: `${px}px`,
    fontFamily: 'var(--font-family)',
  };
}
