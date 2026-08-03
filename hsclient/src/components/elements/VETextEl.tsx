import type { VisuElement } from '../../api/types';
import { basePosition, fontStyle, textAlign } from './common';

export function VETextEl({ el, onInteract }: { el: VisuElement; onInteract?: (el: VisuElement) => void }) {
  const clickable = !!(el.cmd || el.show);
  const align = textAlign(el.align) || 'left';
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onInteract?.(el) : undefined}
      className={clickable ? 'visu-el visu-text visu-clickable' : 'visu-el visu-text'}
      style={{
        ...basePosition(el),
        color: el.fgc || undefined,
        background: el.bgc && el.bgc !== 'transparent' ? el.bgc : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <span style={{ ...fontStyle(el.font), whiteSpace: 'nowrap' }}>{el.text}</span>
    </div>
  );
}
