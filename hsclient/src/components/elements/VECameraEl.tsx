import { useEffect, useMemo, useState } from 'react';
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
  const [nonce, setNonce] = useState(0);

  // stream:true liefert keinen echten MJPEG-Stream (kein multipart/x-mixed-replace), sondern nur
  // Einzelbilder ohne Cache-Header - "wait" (Sekunden) gibt vor, wie oft der Client neu abfragen
  // soll, um den Live-Eindruck per Polling zu simulieren (empirisch ermittelt, siehe CLAUDE.md).
  useEffect(() => {
    if (!el.stream || !el.wait || el.wait <= 0) return;
    const id = setInterval(() => setNonce((n) => n + 1), el.wait * 1000);
    return () => clearInterval(id);
  }, [el.stream, el.wait]);

  const url = useMemo(() => {
    if (!el.src) return undefined;
    const base = assetUrl(token, el.src);
    if (!el.stream) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}_=${nonce}`;
  }, [el.src, el.stream, token, nonce]);

  if (!url) return null;
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
