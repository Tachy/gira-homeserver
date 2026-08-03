# Hinweise für Claude in diesem Repo

## Worum es hier geht

`hsclient/` ist ein React/Vite-Client, der live mit einem echten GIRA Homeserver 4 spricht und
dessen HTML5-Visu nachbaut. Der Renderer ist rein datengetrieben: Seiten und Elemente kommen zur
Laufzeit aus der JSON-Antwort von `/hsvisu/api/visu/{id}`, siehe `hsclient/src/components/VisuStage.tsx`
(Switch über `el.type`) und `hsclient/src/components/elements/*` (ein `VE*El.tsx` pro Typ).

**Wichtig: `/hsvisu/` ist keine offiziell von GIRA dokumentierte API.** Alles, was dieses Repo über
das Format weiß, wurde durch Beobachten echter Antworten eines laufenden Homeservers ermittelt
(Login-Response, Seiten-JSON, Bild-URL-Schema) – nicht aus einer Spezifikation. Feldnamen/Verhalten
sind empirisch, nicht garantiert vollständig oder für jede Homeserver-4-Version identisch. Bei
Unsicherheit: gegen den echten, eigenen Homeserver verifizieren, nicht raten.

## Fehlende Elemente implementieren

Der Renderer kennt aktuell `VEBox`, `VEText`, `VEImage`, `VECamera` (siehe `case`-Zweige in
`VisuStage.tsx`). Ein unbekannter `el.type` fällt im `switch` still auf `default: return null` –
das Element wird also unsichtbar, ohne Fehler. Wenn ein Nutzer eine Visu mit Elementtypen hat, die
hier fehlen:

1. **`.env` im Repo-Root anlegen** (aus `.env.example` kopieren, echte Zugangsdaten eintragen –
   `.env` ist gitignored, landet nie im Repo).
2. **`node scripts/find-unknown-elements.mjs` ausführen.** Rein lesend (crawlt alle per `show`
   erreichbaren Seiten via GET, ruft **niemals** `/hsvisu/api/cmd/*` auf – löst also keine echten
   Aktionen wie Licht/Garage/Tor aus). Findet es Seiten, die von der Login-Startseite aus nicht per
   `show` erreichbar sind, lassen sich zusätzliche Start-Seiten-IDs als Argumente übergeben:
   `node scripts/find-unknown-elements.mjs V10 V20`.
3. **Ergebnis prüfen:** Konsole zeigt pro unbekanntem Typ Anzahl + ein Beispiel-Vorkommen. Volle
   Details (inkl. Beispiel-JSON je Typ) landen in `unknown-elements.json` (gitignored, nur lokal).
4. **Neuen Renderer bauen:** `hsclient/src/components/elements/VE<Typ>El.tsx` anlegen, nach dem
   Muster der bestehenden Komponenten:
   - `basePosition(el)`, `textAlign(el.align)`, `fontStyle(el.font)` aus `./common.ts`
     wiederverwenden statt neu zu erfinden.
   - Klick-Verhalten wie die anderen: `onInteract?.(el)` bei `cmd`/`show`, CSS-Klassen
     `visu-el`/`visu-clickable` (siehe `hsclient/src/index.css`).
   - `VEBoxEl.tsx` ist das einfachste Beispiel, `VEImageEl.tsx`/`VECameraEl.tsx` zeigen den Umgang
     mit `assetUrl(token, el.src)` für Bild-/Stream-Inhalte.
5. **In `VisuStage.tsx` verdrahten:** neuen `case '<Typ>':` Zweig im `switch` ergänzen.
6. **Optional:** `VisuElement['type']`-Union in `hsclient/src/api/types.ts` um den neuen Literal
   erweitern (nicht zwingend, das Feld ist bereits `| string` typisiert – nur für bessere
   Autovervollständigung).
7. **Verifizieren:** `cd hsclient && npm run build`, dann gegen die echte Seite mit diesem
   Elementtyp im Browser prüfen (visuell + `cmd`/`show`-Interaktion, falls vorhanden).

## Sicherheitsregeln für dieses Repo

- Nie `cmd`-Werte aus Beispieldaten blind aufrufen/testen – das sind echte Schaltbefehle auf einer
  echten Hausautomation (Licht, Tore, Heizung, ...). Nur nach ausdrücklicher Freigabe durch den
  Nutzer und mit genau einem gezielten, bekannten Befehl.
- `.env`, `unknown-elements.json` und alles unter `hsclient/public/font/` außer
  `font.css.example` sind bewusst gitignored (Zugangsdaten, personenbezogene Crawl-Daten,
  ggf. kommerziell lizenzierte Schrift) – niemals gegen die `.gitignore`-Regeln committen.
- Dieses Repo ist öffentlich. Keine echten IPs/Hostnamen/Zugangsdaten/Screenshots mit echten
  Kamerabildern committen (siehe Git-Historie dieser Regeln für den Kontext, warum das wichtig ist).
