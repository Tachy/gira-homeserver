// Read-only Diagnose-Tool: crawlt alle per "show" erreichbaren Seiten der eigenen GIRA Homeserver 4
// Visu, sammelt alle VECamera-Elemente ein und prueft, ob deren Bild-URL ein echter
// MJPEG-Multipart-Stream ist oder nur ein statisches Einzelbild liefert. Hintergrund: VECameraEl.tsx
// rendert aktuell ein einziges statisches <img src=...>, das sich nie aktualisiert - dieses Skript
// klaert, ob der Homeserver ueberhaupt einen Stream anbietet oder ob der Client aktiv pollen muesste.
//
// Ruft NIEMALS /hsvisu/api/cmd/* auf, loest also keine echten Aktionen (Licht, Garage, ...) aus.
//
// Nutzung:
//   node scripts/inspect-camera.mjs [zusaetzliche Start-Seiten-IDs...]
// Zugangsdaten aus .env im Repo-Root (siehe .env.example).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnv(file) {
  const text = readFileSync(file, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}
const env = loadEnv(path.join(ROOT, '.env'));

// Self-signed Zertifikat des Homeservers akzeptieren (nur fuer dieses lokale Geraet).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE = `https://${env.GIRA_HOST}`;

async function login() {
  const res = await fetch(`${BASE}/hsvisu/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: env.GIRA_USER, pw: env.GIRA_PW, cl: env.GIRA_CLIENT }),
  });
  if (!res.ok) throw new Error(`Login fehlgeschlagen: HTTP ${res.status}`);
  return res.json();
}

function apiUrl(urlPath, token) {
  const sep = urlPath.includes('?') ? '&' : '?';
  return `${BASE}${urlPath}${sep}token=${token}`;
}

async function fetchPage(id, token) {
  const res = await fetch(apiUrl(`/hsvisu/api/visu/${id}`, token));
  if (!res.ok) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    const json = JSON.parse(text);
    if (!json || !Array.isArray(json.elements)) return null;
    return json;
  } catch {
    return null;
  }
}

function extractChildIds(page) {
  const ids = new Set();
  for (const el of page.elements) {
    if (el.show && el.show.type === 1 && el.show.id) ids.add(el.show.id);
  }
  return [...ids];
}

// Ein paar Sekunden vom Bild-Stream lesen und zaehlen, wie oft die MJPEG-Frame-Boundary
// ("--<boundary>" bzw. neue "Content-Type: image/jpeg"-Teile) im Rohdaten-Strom auftaucht.
// Das ist ein simples, aber robustes Signal fuer "das ist ein aktiver Stream, keine Einzelantwort".
async function probeStream(res, contentType, durationMs = 4000) {
  const boundaryMatch = /boundary=("?)([^;"]+)\1/i.exec(contentType || '');
  const boundary = boundaryMatch ? boundaryMatch[2] : null;
  const marker = boundary ? `--${boundary}` : 'Content-Type: image/jpeg';

  const reader = res.body.getReader();
  const decoder = new TextDecoder('latin1');
  let buf = '';
  let boundaryHits = 0;
  let totalBytes = 0;
  const deadline = Date.now() + durationMs;

  try {
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const timeout = new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), remaining));
      const result = await Promise.race([reader.read(), timeout]);
      if (result.timedOut) break;
      const { done, value } = result;
      if (done) break;
      totalBytes += value.length;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf(marker)) !== -1) {
        boundaryHits += 1;
        buf = buf.slice(idx + marker.length);
      }
      if (buf.length > 8192) buf = buf.slice(-1024);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return { boundary, boundaryHits, totalBytes };
}

async function inspectCamera(el, token) {
  console.log(`\n=== VECamera Element ${el.id} ===`);
  console.log('Rohes JSON:');
  console.log(JSON.stringify(el, null, 2));

  if (!el.src) {
    console.log('(kein "src" Feld - kann Bild-URL nicht pruefen)');
    return;
  }

  const url = apiUrl(el.src, token);
  console.log(`\nFetch: ${url.replace(token, '<token>')}`);
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.log(`  Fehler beim Abruf: ${err.message}`);
    return;
  }

  console.log(`  HTTP Status: ${res.status}`);
  const contentType = res.headers.get('content-type');
  console.log(`  Content-Type: ${contentType}`);
  console.log(`  Cache-Control: ${res.headers.get('cache-control')}`);
  console.log(`  Expires: ${res.headers.get('expires')}`);
  console.log(`  Transfer-Encoding: ${res.headers.get('transfer-encoding')}`);
  console.log(`  Content-Length: ${res.headers.get('content-length')}`);

  if (!res.body) {
    console.log('  (keine lesbare Response-Body-Stream-API verfuegbar)');
    return;
  }

  const isMultipart = /multipart\/x-mixed-replace/i.test(contentType || '');
  if (isMultipart) {
    console.log('  -> sieht nach echtem MJPEG-Multipart-Stream aus, pruefe 4s auf mehrere Frames ...');
  } else {
    console.log('  -> kein multipart Content-Type, pruefe trotzdem 4s ob mehrfach Daten nachkommen ...');
  }
  const { boundary, boundaryHits, totalBytes } = await probeStream(res, contentType);
  console.log(`  Boundary erkannt: ${boundary || '(keine, wurde auf "Content-Type: image/jpeg" im Body geprueft)'}`);
  console.log(`  Frame-Boundary-Treffer in 4s: ${boundaryHits}`);
  console.log(`  Insgesamt gelesene Bytes in 4s: ${totalBytes}`);
  console.log(
    boundaryHits > 1
      ? '  => ECHTER STREAM: mehrere Frames kamen ueber dieselbe Verbindung, <img src> sollte das nativ animiert darstellen.'
      : '  => KEIN STREAM erkannt: entweder ein einzelnes Standbild oder Verbindung wurde nach einem Frame geschlossen. Client muesste aktiv pollen.',
  );
}

async function main() {
  console.log(`Login bei ${BASE} ...`);
  const loginData = await login();
  const token = loginData.token;

  const seeds = new Set(process.argv.slice(2));
  if (loginData.settings?.fallbackPage) seeds.add(loginData.settings.fallbackPage);
  if (loginData.settings?.visu) seeds.add(loginData.settings.visu);
  if (!seeds.size) {
    throw new Error(
      'Login lieferte weder fallbackPage noch visu als Startseite - bitte Start-Seiten-ID(s) als Argument angeben.',
    );
  }

  const visited = new Map();
  const notPages = new Set();
  const queue = [...seeds];
  const cameras = [];

  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id) || notPages.has(id)) continue;

    const page = await fetchPage(id, token);
    if (!page) {
      notPages.add(id);
      continue;
    }
    visited.set(id, page);
    console.log(`  ${id}: "${page.title1 || ''}" (${page.elements.length} Elemente)`);

    for (const el of page.elements) {
      if (el.type === 'VECamera') cameras.push({ pageId: id, el });
    }

    for (const childId of extractChildIds(page)) {
      if (!visited.has(childId) && !notPages.has(childId) && !queue.includes(childId)) {
        queue.push(childId);
      }
    }
  }

  console.log(`\nFertig gecrawlt: ${visited.size} Seiten durchsucht.`);

  if (cameras.length === 0) {
    console.log(
      'Keine VECamera-Elemente gefunden. Falls die Kameraseite von der Login-Startseite aus nicht per\n' +
        '"show" erreichbar ist, deren Seiten-ID als Argument uebergeben:\n' +
        '  node scripts/inspect-camera.mjs <Seiten-ID>',
    );
    return;
  }

  console.log(`\n${cameras.length} VECamera-Element(e) gefunden, pruefe jedes einzeln ...`);
  for (const { pageId, el } of cameras) {
    console.log(`\n(Seite ${pageId})`);
    await inspectCamera(el, token);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
