import type { VisuElement } from '../../api/types';
import { assetUrl } from '../../api/hsClient';
import { basePosition } from './common';

export function VECameraEl({
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
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onInteract?.(el) : undefined}
      className={clickable ? 'visu-el visu-clickable' : 'visu-el'}
      style={basePosition(el)}
    >
      <img src={url} width={el.w} height={el.h} alt="" style={{ display: 'block', objectFit: 'cover' }} />
    </div>
  );
}
