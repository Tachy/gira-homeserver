import { useEffect, useRef, useState } from 'react';
import type { VisuElement } from '../../api/types';
import { assetUrl } from '../../api/hsClient';
import { basePosition } from './common';

// Alle VECamera-Elemente der App teilen sich diese Warteschlange: global ist immer nur eine
// Bild-Anfrage gleichzeitig unterwegs, Kameras auf derselben Seite rollieren reihum statt
// gleichzeitig zu pollen. Das verhindert, dass mehrere parallele Polling-Schleifen den kleinen
// Embedded-Homeserver ueberlasten (siehe fruehere Regression: Hoftor-/Pelletlager-Kamera luden
// nicht mehr, weil die Tuerkamera allein schon alle Ressourcen des Geraets belegte). Empirisch
// bestaetigt: auch Kameras ohne "stream"-Flag liefern bei jeder Anfrage ein frisches Bild - das
// Flag ist keine technische Einschraenkung, daher pollen inzwischen alle Kameras mit "src".
//
// "generation" ist ein zusaetzlicher, von VisuStage bei jedem Seitenwechsel per
// ensureCameraSchedulerForPage() erhoehter Zaehler: er stoppt Kameras der vorherigen Seite
// explizit und sofort, statt sich allein auf React's Unmount-Timing zu verlassen (beobachtete
// Regression: eine Kamera pollte nach dem Verlassen ihrer Seite unbegrenzt weiter, weil sich ihr
// eigener Weiterplanungs-Zyklus - onLoad/onError -> Timer -> naechste Anfrage - selbst am Leben
// hielt). ensureCameraSchedulerForPage() wird synchron im Render von VisuStage aufgerufen (nicht
// in einem useEffect!), weil React Kind-Effekte vor Eltern-Effekten ausfuehrt - ein Reset im
// useEffect der VisuStage wuerde frisch gemountete Kameras der NEUEN Seite sofort wieder
// invalidieren, da deren eigener Mount-Effekt (und damit ihr erster enqueueFetch) vorher liefe.
const queue: Array<() => void> = [];
let busy = false;
let generation = 0;
let currentPageId: string | undefined;

export function ensureCameraSchedulerForPage(pageId: string) {
  if (currentPageId === pageId) return;
  currentPageId = pageId;
  generation += 1;
  queue.length = 0;
  busy = false;
}

function requestTurn(run: () => void) {
  queue.push(run);
  pump();
}

function cancelTurn(run: () => void) {
  const idx = queue.indexOf(run);
  if (idx !== -1) queue.splice(idx, 1);
}

function pump() {
  if (busy) return;
  const next = queue.shift();
  if (!next) return;
  busy = true;
  next();
}

function releaseTurn() {
  busy = false;
  pump();
}

interface CameraState {
  stopped: boolean;
  holdingLock: boolean;
  pendingTask: (() => void) | null;
  timer: number | undefined;
}

export function VECameraEl({
  el,
  token,
  onInteract,
}: {
  el: VisuElement;
  token: string;
  onInteract?: (el: VisuElement) => void;
}) {
  const [url, setUrl] = useState<string | undefined>();
  const stateRef = useRef<CameraState>({
    stopped: false,
    holdingLock: false,
    pendingTask: null,
    timer: undefined,
  });

  const enqueueFetch = () => {
    const state = stateRef.current;
    if (!el.src) return;
    const myGeneration = generation;
    const task = () => {
      state.pendingTask = null;
      if (state.stopped || myGeneration !== generation) {
        // Seite wurde gewechselt, seit diese Kamera sich angestellt hat - Slot direkt
        // weiterreichen, statt ein Bild fuer eine nicht mehr sichtbare Seite zu laden.
        releaseTurn();
        return;
      }
      state.holdingLock = true;
      const base = assetUrl(token, el.src!);
      const sep = base.includes('?') ? '&' : '?';
      setUrl(`${base}${sep}_=${Date.now()}`);
    };
    state.pendingTask = task;
    requestTurn(task);
  };

  useEffect(() => {
    const state = stateRef.current;
    state.stopped = false;
    enqueueFetch();

    return () => {
      state.stopped = true;
      if (state.timer !== undefined) window.clearTimeout(state.timer);
      if (state.pendingTask) {
        cancelTurn(state.pendingTask);
        state.pendingTask = null;
      }
      // Falls diese Kamera gerade den globalen "Slot" haelt (eigenes Bild laedt noch): freigeben,
      // sonst haengt die Warteschlange fuer alle Kameras fest, weil onLoad/onError nach dem
      // Unmount nicht mehr feuert.
      if (state.holdingLock) {
        state.holdingLock = false;
        releaseTurn();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el.src, token]);

  const handleSettled = () => {
    const state = stateRef.current;
    state.holdingLock = false;
    releaseTurn();
    if (state.stopped) return;
    // Homeserver schickt bei stream:false-Kameras "wait: 0" (nicht etwa "kein wait"): das ist
    // keine Aufforderung, so schnell wie moeglich zu pollen, sondern schlicht "kein eigener
    // Vorgabewert". Empirisch bestaetigt (Startseite V6, Kameras 174/247): ohne Mindestabstand
    // feuert das Round-Robin fuer genau diese Kameras ungebremst mit 0ms Pause - >20 Requests/s,
    // massiver CPU-Verbrauch auf schwacher Hardware, obwohl die Seite optisch ruhig wirkt.
    const FALLBACK_DELAY_MS = 3000;
    const delay = el.wait && el.wait > 0 ? el.wait * 1000 : FALLBACK_DELAY_MS;
    const myGeneration = generation;
    state.timer = window.setTimeout(() => {
      state.timer = undefined;
      if (!state.stopped && myGeneration === generation) enqueueFetch();
    }, delay);
  };

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
        onLoad={handleSettled}
        onError={handleSettled}
      />
    </div>
  );
}
