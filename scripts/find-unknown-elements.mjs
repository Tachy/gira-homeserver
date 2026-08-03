// Read-only Diagnose-Tool: crawlt alle per "show" erreichbaren Seiten der eigenen GIRA Homeserver 4
// Visu und meldet Element-Typen, die hsclient noch nicht rendert (VisuStage.tsx faellt bei
// unbekannten Typen still auf "nichts anzeigen" zurueck - das macht sie sonst unsichtbar).
// Ruft NIEMALS /hsvisu/api/cmd/* auf, loest also keine echten Aktionen (Licht, Garage, ...) aus.
//
// Nutzung:
//   node scripts/find-unknown-elements.mjs [zusaetzliche Start-Seiten-IDs...]
// Zugangsdaten aus .env im Repo-Root (siehe .env.example). Zusaetzliche Start-IDs sind nur noetig,
// falls Seiten existieren, die von der Login-Startseite aus nicht per "show" erreichbar sind.

import { readFileSync, writeFileSync } from 'node:fs';
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

// Bekannte Element-Typen direkt aus dem Renderer ableiten (Single Source of Truth), damit dieses
// Skript nie von Hand synchron gehalten werden muss, wenn ein neuer VE*El.tsx dazukommt.
function knownTypesFromRenderer() {
  const src = readFileSync(path.join(ROOT, 'hsclient/src/components/VisuStage.tsx'), 'utf8');
  const types = new Set();
  for (const m of src.matchAll(/case '(\w+)':/g)) types.add(m[1]);
  return types;
}

async function main() {
  const knownTypes = knownTypesFromRenderer();
  console.log(`Bekannte Element-Typen im Renderer: ${[...knownTypes].join(', ')}`);

  console.log(`\nLogin bei ${BASE} ...`);
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
  const unknown = new Map(); // type -> { count, examples: [{ pageId, elementId, sample }] }

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
      if (!el.type || knownTypes.has(el.type)) continue;
      if (!unknown.has(el.type)) unknown.set(el.type, { count: 0, examples: [] });
      const entry = unknown.get(el.type);
      entry.count += 1;
      if (entry.examples.length < 3) {
        entry.examples.push({ pageId: id, elementId: el.id, sample: el });
      }
    }

    for (const childId of extractChildIds(page)) {
      if (!visited.has(childId) && !notPages.has(childId) && !queue.includes(childId)) {
        queue.push(childId);
      }
    }
  }

  console.log(`\nFertig: ${visited.size} Seiten durchsucht.`);

  if (unknown.size === 0) {
    console.log(
      'Keine unbekannten Element-Typen gefunden - der Renderer deckt alles ab, was auf dieser Anlage vorkommt.',
    );
    return;
  }

  console.log(`\n${unknown.size} unbekannte(r) Element-Typ(en) gefunden:`);
  const report = {};
  for (const [type, entry] of unknown) {
    console.log(
      `  ${type}: ${entry.count}x, z.B. Seite ${entry.examples[0].pageId}, Element ${entry.examples[0].elementId}`,
    );
    report[type] = entry;
  }

  const outFile = path.join(ROOT, 'unknown-elements.json');
  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`\nDetails (inkl. Beispiel-JSON je Typ) geschrieben nach: ${outFile}`);
  console.log('Naechster Schritt: siehe CLAUDE.md, Abschnitt "Fehlende Elemente implementieren".');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
