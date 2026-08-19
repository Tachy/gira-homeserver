export interface VisuElement {
  id: number;
  type: 'VEBox' | 'VEText' | 'VEImage' | 'VECamera' | string;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  fgc?: string;
  bgc?: string;
  text?: string;
  font?: string;
  align?: number;
  src?: string;
  stream?: boolean;
  // Nur bei stream:true gesetzt: Sekunden zwischen Neuabfragen des Kamerabilds (z.B. 0.2 = 5x/s),
  // vom Homeserver selbst vorgegeben - es gibt keinen echten MJPEG-Stream, nur Einzelbilder ohne
  // Cache-Header, die per Polling neu geladen werden muessen (siehe VECameraEl.tsx).
  wait?: number;
  cmd?: string;
  show?: { type: number; id: string };
  raw?: string;
  css?: string;
  classes?: string;
}

export interface VisuPage {
  id: string;
  title1?: string;
  title2?: string;
  w: number;
  h: number;
  bgcol?: string;
  bgimg?: string;
  bgpos?: number;
  elements: VisuElement[];
}

export interface LoginSettings {
  fallbackTime?: number;
  fallbackPage?: string;
  visu?: string;
}

export interface LoginResponse {
  token: string;
  settings: LoginSettings;
}

export interface HsCredentials {
  user: string;
  pw: string;
  cl: string;
}

// Live-Update-Nachricht ueber die WebSocket-Verbindung: enthaelt bereits die geaenderten Elemente
// direkt im Payload (Delta, nicht die ganze Seite) - kein erneutes GET noetig, um sie anzuzeigen.
export interface WsUpdateMessage {
  cmd: string;
  data?: Record<string, { id: string; elements: VisuElement[]; mode?: number }>;
}
