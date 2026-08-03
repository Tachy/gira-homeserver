import type { HsCredentials, LoginResponse, VisuPage } from './types';

export const DEFAULT_CLIENT = 'GIRA1024V';

// Alle Aufrufe sind bewusst relativ (kein Host/Schema-Praefix): die App spricht immer den
// Server an, von dem sie selbst ausgeliefert wurde. Der jeweilige Webserver (lokal oder oeffentlich)
// ist dafuer verantwortlich, "/hsvisu/" zum echten Homeserver durchzureichen - siehe README.
export function buildUrl(urlPath: string, token: string): string {
  const sep = urlPath.includes('?') ? '&' : '?';
  return `${urlPath}${sep}token=${token}`;
}

export async function login(creds: HsCredentials): Promise<LoginResponse> {
  const res = await fetch('/hsvisu/api/login', {
    method: 'POST',
    // text/plain vermeidet einen CORS-Preflight (der Homeserver erlaubt Content-Type nicht
    // in Access-Control-Allow-Headers); der Server parst den Body unabhaengig vom Header als JSON.
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ user: creds.user, pw: creds.pw, cl: creds.cl }),
  });
  if (!res.ok) {
    throw new Error(`Login fehlgeschlagen (HTTP ${res.status}). Ist der Homeserver erreichbar?`);
  }
  return res.json();
}

export async function loadPage(token: string, id: string, signal?: AbortSignal): Promise<VisuPage> {
  const res = await fetch(buildUrl(`/hsvisu/api/visu/${id}`, token), { signal });
  if (!res.ok) throw new Error(`Seite ${id} nicht ladbar (HTTP ${res.status})`);
  const text = await res.text();
  if (!text) throw new Error(`Seite ${id} lieferte keine Daten`);
  return JSON.parse(text);
}

export async function executeCmd(token: string, cmdId: string): Promise<void> {
  const res = await fetch(buildUrl(`/hsvisu/api/cmd/${cmdId}`, token));
  if (!res.ok) throw new Error(`Befehl ${cmdId} fehlgeschlagen (HTTP ${res.status})`);
}

export function assetUrl(token: string, src: string): string {
  return buildUrl(src, token);
}

export function connectWebSocket(
  token: string,
  handlers: {
    onMessage: (data: string) => void;
    onOpen?: () => void;
    onClose?: () => void;
  },
): WebSocket {
  // wss:// wenn die Seite selbst ueber HTTPS geladen wurde (sonst blockt der Browser als
  // Mixed-Content), sonst ws:// - Host = die Adresse, ueber die diese Seite gerade laeuft.
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${window.location.host}/hsvisu/ws?token=${token}`);
  ws.addEventListener('message', (ev) => {
    if (typeof ev.data === 'string') handlers.onMessage(ev.data);
  });
  if (handlers.onOpen) ws.addEventListener('open', handlers.onOpen);
  if (handlers.onClose) {
    ws.addEventListener('close', handlers.onClose);
    ws.addEventListener('error', handlers.onClose);
  }
  return ws;
}
