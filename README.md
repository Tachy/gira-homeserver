# GIRA Homeserver 4 – VISU-Nachbau (React/Vite)

Ein React/Vite-Client, der live mit einem echten GIRA Homeserver 4 spricht und dessen
HTML5-Visu nachbaut. Der Renderer ist rein datengetrieben: Seiten, Elemente, Positionen und
Befehle kommen zur Laufzeit über die Homeserver-eigene `/hsvisu/`-API – es ist kein Wissen über ein
bestimmtes Projekt oder eine bestimmte Anlage im Code hinterlegt. Jeder mit eigenem GIRA Homeserver 4
und aktivierter HTML5-Visu kann diesen Client gegen sein eigenes Projekt laufen lassen (eigene
Zugangsdaten, eigener Host, siehe unten).

Farben der Client-eigenen Oberfläche (Login-Formular, Fehlermeldungen, Verbindungsbanner) sind fest
im Code hinterlegt – nicht die Visu-Seiten selbst, deren Farben und Schriftgrößen kommen bereits pro
Element vom Homeserver. Standardschrift ist eine frei verfügbare Systemschrift (`Arial Narrow`); wer
eine eigene Schrift einbinden möchte, findet eine Anleitung in
`hsclient/public/font/font.css.example`.

Der komplette Client liegt in **`hsclient/`** – eigenes `package.json`, unabhängig vom Repo-Root.

## Starten (Entwicklung)

Voraussetzung: **Node.js 20.19+ oder 22.12+** (Vite 8 benötigt diese Version, ältere Node-Versionen
brechen beim Start mit einem `node:util`-Importfehler ab). Aktuelle LTS-Version empfohlen, siehe
https://nodejs.org. Auf Ubuntu liefert `apt install nodejs` oft eine veraltete Version – stattdessen
[nvm](https://github.com/nvm-sh/nvm) verwenden (`nvm install 22 && nvm use 22`); `hsclient/.nvmrc`
legt die empfohlene Version fest (`nvm use` im Ordner `hsclient/` reicht dann).

```bash
cd hsclient
npm install
npm run dev
```

Dann `http://localhost:5173/hsclient/` öffnen. Die App spricht den Homeserver ausschließlich relativ an
(kein fester Host im Code) – im Dev-/Preview-Modus reicht der Vite-Proxy (`hsclient/vite.config.ts`) das
an den echten Homeserver durch. Standardziel ist `http://homeserver.local:8080`; per Umgebungsvariable
`VITE_HS_PROXY_TARGET` (z. B. `VITE_HS_PROXY_TARGET=http://192.168.1.10:8080 npm run dev`) auf den
eigenen Homeserver zeigen – kein Zertifikat, keine manuelle Warnungs-Bestätigung nötig.

Titel/Login-Überschrift ("GIRA Homeserver") lassen sich per `VITE_APP_TITLE` überschreiben
(z. B. `VITE_APP_TITLE="Mein Zuhause" npm run dev`).

Login geht auch direkt per URL, wie beim Original: `http://localhost:5173/hsclient/?user=...&pw=...&cl=...`
(der Host kommt immer vom ausliefernden Server, nicht aus der URL).

## Deployment

```bash
cd hsclient
npm run build
```

Der Inhalt von `hsclient/dist/` kann 1:1 auf einen beliebigen (statischen) Webserver unter
**jedem beliebigen Unterpfad** kopiert werden (z. B. `https://servername/hsclient/` oder
`.../opt/hsclient/`) – Asset-Pfade sind relativ gebaut (`base: './'` in `hsclient/vite.config.ts`).
Voraussetzung: die URL muss mit abschließendem `/` aufgerufen werden.

Für automatisierte Rollouts auf mehrere Ziele (Webserver, ETS-`hsupload`-Staging für die
Übertragung auf einen GIRA Homeserver) empfiehlt sich ein eigenes, nicht Teil dieses Repos
befindliches Deploy-Skript (siehe `.gitignore`: `deploy.ps1`, `webserver-configs/` sind bewusst
lokal/nicht eingecheckt, da sie reale Infrastrukturdetails wie Server-IPs und SSH-Zugänge
enthalten würden).

Die eigentliche Geräte-Übertragung für einen Homeserver bleibt danach ein manueller Schritt
in der ETS-Software (Projekteinstellungen → Oberfläche → `hsclient` ankreuzen → Projekt
übertragen).

## Struktur (hsclient/src)

- `api/hsClient.ts` – Login/Token/Seiten laden/Befehle ausführen/WebSocket
- `components/VisuStage.tsx` + `elements/` – generischer, datengetriebener Renderer für jeden
  Seitentyp (`VEBox`, `VEText`, `VEImage`, `VECamera`)
- `components/LoginForm.tsx`, `App.tsx` – Login-Flow (inkl. URL-Auto-Login), Navigation,
  Live-Befehlsausführung, WebSocket-Reconnect mit Verbindungs-Banner

## Funktionsprinzip

- `show`-Referenz an einem Element ⇒ Klick navigiert (clientseitig) zur referenzierten Seite.
- `cmd`-Referenz an einem Element ⇒ Klick führt einen echten Befehl auf dem Homeserver aus
  (z. B. Licht schalten), anschließend wird die aktuelle Seite neu geladen, um den neuen Zustand
  anzuzeigen.
- Alle `VEImage`-Elemente werden als echte Bilder vom Homeserver geladen (`<img src=...>`)
- Standardschrift ist `Arial Narrow` (Systemschrift, keine Lizenz nötig) und fest im Code hinterlegt
  (`hsclient/src/index.css`). Eine eigene Schrift lässt sich rein lokal einbinden, ohne sie ins Repo
  aufzunehmen: `hsclient/public/font/font.css.example` zu `font.css` kopieren, eigene Schriftdatei
  danebenlegen. Diese Datei wird zur Laufzeit optional nachgeladen (`hsclient/src/main.tsx`) – ohne
  sie läuft der Build unverändert mit dem Standard weiter, kein Rebuild-Schritt nötig.

## Bekannter Folgeaufwand

- Nicht jeder auf einem GIRA Homeserver 4 vorkommende Seiten-/Elementtyp wurde bisher gegen den
  generischen Renderer getestet (z. B. Telefonbuch-Listen, Anrufbeantworter-Einträge, mehrseitige
  Diagramm-Ansichten). Bei Darstellungsfehlern auf einem bestimmten Seitentyp gerne einen Issue melden.
  Zum Aufspüren fehlender Elementtypen auf der eigenen Anlage: `node scripts/find-unknown-elements.mjs`
  (rein lesend, Zugangsdaten aus `.env`, siehe `.env.example`) – Anleitung zum Ergänzen eines neuen
  Renderers dafür steht in `CLAUDE.md`.
- Serverseitig gerenderte Verbrauchs-Diagramme (Strom/Wasser, aktuell als Bild eingebunden) könnten
  perspektivisch durch eine echte Chart-Bibliothek ersetzt werden, gespeist über `/hsvisu/api/query/{id}`.
