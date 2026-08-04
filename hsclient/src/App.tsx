import { useCallback, useEffect, useRef, useState } from 'react';
import { connectWebSocket, DEFAULT_CLIENT, executeCmd, loadPage, login } from './api/hsClient';
import type { HsCredentials, VisuPage, WsUpdateMessage } from './api/types';
import { LoginForm } from './components/LoginForm';
import { VisuStage } from './components/VisuStage';

interface Session {
  creds: HsCredentials;
  token: string;
  fallbackPage: string;
}

const WS_RECONNECT_DELAY_MS = 3000;

// Original-URL-Muster des Homeservers ("/hs?user=...&pw=...&cl=..."): sind diese Parameter in der
// URL vorhanden, wird direkt eingeloggt und das Formular komplett uebersprungen - fuer den rein
// lokalen Einsatz per Lesezeichen/Kiosk-Link, analog zum Original. Der Host ist kein Parameter
// mehr - die App spricht immer den Server an, von dem sie selbst ausgeliefert wurde.
function credsFromUrl(): HsCredentials | null {
  const params = new URLSearchParams(window.location.search);
  const user = params.get('user');
  const pw = params.get('pw');
  if (!user || !pw) return null;
  return {
    user,
    pw,
    cl: params.get('cl') || DEFAULT_CLIENT,
  };
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [page, setPage] = useState<VisuPage | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(true);

  // Einzige Quelle der Wahrheit fuer "welche Seite ist gerade angefordert" - auch fuer Closures
  // (WebSocket-Handler), die nur einmal pro Session eingerichtet werden.
  const pageIdRef = useRef<string | null>(null);
  // Ebenfalls fuer den WS-Handler: aktuellster Fehlerstand, ohne dass die Verbindung bei jeder
  // pageError-Aenderung neu aufgebaut werden muss (siehe onOpen unten).
  const pageErrorRef = useRef<string | null>(null);
  // Generation-Zaehler: jede Navigation/jeder Ladeauftrag erhoeht ihn. Eine Ladeantwort wird nur
  // noch uebernommen, wenn sie zur *aktuellsten* Generation gehoert - so kann eine spaet
  // eintreffende Antwort einer veralteten Anfrage nicht mehr die gerade angezeigte neue Seite
  // ueberschreiben ("Hin- und Herspringen").
  const genRef = useRef(0);
  // Laufenden Request abbrechen, bevor ein neuer gestartet wird (z.B. bei schnell aufeinander
  // folgenden Klicks), damit sich nie mehrere Anfragen ueberlappen.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    pageIdRef.current = pageId;
  }, [pageId]);

  useEffect(() => {
    pageErrorRef.current = pageError;
  }, [pageError]);

  const loadCurrentPage = useCallback(async () => {
    const id = pageIdRef.current;
    if (!session || !id) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const gen = ++genRef.current;
    try {
      const p = await loadPage(session.token, id, controller.signal);
      if (gen !== genRef.current) return; // veraltet, verwerfen
      setPage(p);
      setPageError(null);
    } catch (err) {
      if (gen !== genRef.current || controller.signal.aborted) return;
      setPageError(err instanceof Error ? err.message : String(err));
    }
  }, [session]);

  // Wendet eine per WebSocket gepushte Delta-Aktualisierung direkt auf die aktuell angezeigte
  // Seite an (Server schickt bereits die geaenderten Elemente im Payload mit) - dafuer ist KEIN
  // erneuter GET-Request noetig. Das war vorher der Flaschenhals: jede Live-Update-Nachricht loeste
  // ein komplettes Neuladen der Seite per HTTP aus, obwohl die Daten schon in der Nachricht steckten.
  const applyWsUpdate = useCallback((targetId: string, elements: VisuPage['elements']) => {
    setPage((prev) => {
      if (!prev || prev.id !== targetId) return prev; // andere/nicht aktive Seite - ignorieren
      const byId = new Map(elements.map((el) => [el.id, el]));
      return { ...prev, elements: prev.elements.map((el) => byId.get(el.id) ?? el) };
    });
  }, []);

  const handleLogin = useCallback(async (creds: HsCredentials) => {
    setLoginPending(true);
    setLoginError(null);
    try {
      const res = await login(creds);
      const override = new URLSearchParams(window.location.search).get('page');
      const start = override || res.settings?.fallbackPage || res.settings?.visu || 'V2';
      setSession({ creds, token: res.token, fallbackPage: start });
      setPageId(start);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoginPending(false);
    }
  }, []);

  // Auto-Login per URL-Parametern (einmalig beim Start), sonst bleibt das manuelle Formular aktiv.
  useEffect(() => {
    const creds = credsFromUrl();
    if (creds) void handleLogin(creds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session && pageId) void loadCurrentPage();
  }, [session, pageId, loadCurrentPage]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const handleMessage = (raw: string) => {
      let msg: WsUpdateMessage;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.cmd !== 'update' || !msg.data) return;
      for (const [targetId, payload] of Object.entries(msg.data)) {
        if (Array.isArray(payload?.elements)) applyWsUpdate(targetId, payload.elements);
      }
    };

    const connect = () => {
      if (cancelled) return;
      ws = connectWebSocket(session.token, {
        onMessage: handleMessage,
        onOpen: () => {
          if (cancelled) return;
          setWsConnected(true);
          // Der Server ist nachweislich wieder erreichbar - eine zuvor an einem toten Server
          // gescheiterte Seite (z.B. "Failed to fetch") jetzt automatisch neu laden, statt fuer
          // immer auf dem Fehlerbildschirm stehen zu bleiben.
          if (pageErrorRef.current) void loadCurrentPage();
        },
        onClose: () => {
          if (cancelled || reconnectTimer) return; // bereits geplant/abgebaut
          setWsConnected(false);
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, WS_RECONNECT_DELAY_MS);
        },
      });
    };
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [session, applyWsUpdate, loadCurrentPage]);

  const handleNavigate = useCallback((id: string) => {
    setPageId(id);
  }, []);

  const handleCmd = useCallback(
    async (cmd: string) => {
      if (!session) return;
      try {
        await executeCmd(session.token, cmd);
        // Ergebnis kommt kurz danach per WebSocket-Delta-Update von selbst - kein sofortiger
        // Neu-Fetch der ganzen Seite noetig.
      } catch (err) {
        setPageError(err instanceof Error ? err.message : String(err));
      }
    },
    [session],
  );

  if (!session) {
    return <LoginForm onSubmit={handleLogin} error={loginError} pending={loginPending} />;
  }

  return (
    <>
      {pageError ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100vw',
            height: '100vh',
            boxSizing: 'border-box',
            padding: 24,
            color: '#ed2024',
            fontSize: 25,
            textAlign: 'center',
          }}
        >
          Fehler beim Laden von {pageId}: {pageError}
        </div>
      ) : !page ? (
        <div style={{ color: '#edb678', padding: 24 }}>Lade...</div>
      ) : (
        <VisuStage page={page} token={session.token} onNavigate={handleNavigate} onCmd={handleCmd} />
      )}
      {!wsConnected && <ConnectionBanner />}
    </>
  );
}

function ConnectionBanner() {
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#000',
        color: '#edb678',
        border: '1px solid #ed2024',
        borderRadius: 6,
        padding: '16px 32px',
        fontFamily: 'var(--font-family)',
        fontSize: 25,
        textAlign: 'center',
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      Verbindung unterbrochen – versuche erneut zu verbinden …
    </div>
  );
}

export default App;
