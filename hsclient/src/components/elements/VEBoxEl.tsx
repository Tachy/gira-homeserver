import type { VisuElement } from '../../api/types';
import { basePosition } from './common';

export function VEBoxEl({ el, onInteract }: { el: VisuElement; onInteract?: (el: VisuElement) => void }) {
  const clickable = !!(el.cmd || el.show);
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onInteract?.(el) : undefined}
      className={clickable ? 'visu-el visu-clickable' : 'visu-el'}
      style={{
        ...basePosition(el),
        background: el.color && el.color !== 'transparent' ? el.color : undefined,
      }}
    />
  );
}
