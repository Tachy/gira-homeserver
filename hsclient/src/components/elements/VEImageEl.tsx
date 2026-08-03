import type { VisuElement } from '../../api/types';
import { assetUrl } from '../../api/hsClient';
import { basePosition } from './common';

export function VEImageEl({
  el,
  token,
  onInteract,
}: {
  el: VisuElement;
  token: string;
  onInteract?: (el: VisuElement) => void;
}) {
  if (!el.src) return null;
  const url = assetUrl(token, el.src);
  const clickable = !!(el.cmd || el.show);
  const props = {
    role: clickable ? ('button' as const) : undefined,
    tabIndex: clickable ? 0 : undefined,
    onClick: clickable ? () => onInteract?.(el) : undefined,
    className: clickable ? 'visu-el visu-clickable' : 'visu-el',
    style: basePosition(el),
  };

  return (
    <div {...props}>
      <img src={url} width={el.w} height={el.h} alt="" draggable={false} style={{ display: 'block' }} />
    </div>
  );
}
