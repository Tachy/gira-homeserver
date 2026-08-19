import { useEffect, useMemo, useRef, useState } from 'react';
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
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setNonce(0);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [el.src, el.stream, el.wait, token]);

  // stream:true liefert keinen echten MJPEG-Stream (kein multipart/x-mixed-replace), sondern nur
  // Einzelbilder ohne Cache-Header - "wait" (Sekunden) gibt vor, wie oft der Client neu abfragen
  // soll, um den Live-Eindruck per Polling zu simulieren (empirisch ermittelt, siehe CLAUDE.md).
  // Die naechste Anfrage wird erst geplant, NACHDEM das aktuelle Bild fertig geladen ist
  // (onLoad/onError) statt per stumpfem Intervall - sonst staut ein langsamer Homeserver Anfragen
  // auf und blockiert damit auch andere Kameras auf demselben Geraet.
  const scheduleNext = () => {
    if (!el.stream || !el.wait || el.wait <= 0) return;
    timerRef.current = window.setTimeout(() => setNonce((n) => n + 1), el.wait * 1000);
  };

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
      <img
        src={url}
        width={el.w}
        height={el.h}
        alt=""
        style={{ display: 'block', objectFit: 'cover' }}
        onLoad={scheduleNext}
        onError={scheduleNext}
      />
    </div>
  );
}
