// Balcony Garden Planner — local web server.
// Built on Node's built-in http module only (no framework dependency),
// matching this repo's existing preference for a small, dependency-free
// local UI. Serves the static frontend from ./public and a small JSON API
// backed by ./data (local, private, gitignored — no crowd-sourced layer).

try {
  await import('dotenv/config');
} catch {
  // dotenv not installed yet (run `npm install`) — fall back to whatever
  // is already in process.env rather than hard-failing startup.
}
import http from 'http';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SPECIES } from './data/species.js';
import { scoreEnvironmentalFit } from './lib/scoring.js';
import { checkCompanionFit, checkCompanionPair } from './lib/companions.js';
import { recommendBox, suggestMissing, capacityForSpecies } from './lib/packing.js';
import { computeFloorLoad } from './lib/floorLoad.js';
import { fertilizerGuidance } from './lib/fertilizer.js';
import { lookupSpecies } from './lib/addPlant.js';
import { store } from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 4100;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

async function allSpecies() {
  const userSpecies = await store.getUserSpecies();
  return [...SPECIES, ...userSpecies];
}

function findSpecies(list, id) {
  return list.find((s) => s.id === id) || null;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  try {
    const data = await fsp.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

const routes = [
  {
    method: 'GET',
    path: '/api/species',
    handler: async () => {
      const species = await allSpecies();
      return [200, species];
    },
  },
  {
    method: 'GET',
    path: '/api/site',
    handler: async () => [200, (await store.getSite()) || {}],
  },
  {
    method: 'POST',
    path: '/api/site',
    handler: async (req) => {
      const body = await readBody(req);
      return [200, await store.saveSite(body)];
    },
  },
  {
    method: 'GET',
    path: '/api/containers',
    handler: async () => [200, await store.getContainers()],
  },
  {
    method: 'POST',
    path: '/api/containers',
    handler: async (req) => {
      const body = await readBody(req);
      const containers = await store.getContainers();
      const container = { id: `c${Date.now()}`, plantIds: [], ...body };
      containers.push(container);
      await store.saveContainers(containers);
      return [200, container];
    },
  },
  {
    method: 'PUT',
    path: '/api/containers/:id',
    handler: async (req, params) => {
      const body = await readBody(req);
      const containers = await store.getContainers();
      const idx = containers.findIndex((c) => c.id === params.id);
      if (idx === -1) return [404, { error: 'not found' }];
      containers[idx] = { ...containers[idx], ...body };
      await store.saveContainers(containers);
      return [200, containers[idx]];
    },
  },
  {
    method: 'DELETE',
    path: '/api/containers/:id',
    handler: async (_req, params) => {
      const containers = await store.getContainers();
      const filtered = containers.filter((c) => c.id !== params.id);
      await store.saveContainers(filtered);
      return [200, { removed: filtered.length !== containers.length }];
    },
  },
  {
    method: 'POST',
    path: '/api/recommend',
    handler: async (req) => {
      const body = await readBody(req);
      const species = await allSpecies();
      const { container, site, focus, existingIds, options } = body;
      const result = recommendBox(container, site, { ...options, focus, existingIds, speciesList: species });
      return [200, result];
    },
  },
  {
    method: 'POST',
    path: '/api/suggest-missing',
    handler: async (req) => {
      const body = await readBody(req);
      const species = await allSpecies();
      const { container, site, focus, existingIds, options } = body;
      const result = suggestMissing(container, site, { ...options, focus, existingIds, speciesList: species });
      return [200, result];
    },
  },
  {
    method: 'POST',
    path: '/api/companions/check',
    handler: async (req) => {
      const body = await readBody(req);
      const species = await allSpecies();
      const plants = body.ids.map((id) => findSpecies(species, id)).filter(Boolean);
      const pairs = [];
      for (let i = 0; i < plants.length; i++) {
        for (let j = i + 1; j < plants.length; j++) {
          pairs.push({
            a: plants[i].id,
            b: plants[j].id,
            ...checkCompanionPair(plants[i], plants[j]),
          });
        }
      }
      return [200, { pairs }];
    },
  },
  {
    method: 'POST',
    path: '/api/companions/check-candidate',
    handler: async (req) => {
      const body = await readBody(req);
      const species = await allSpecies();
      const candidate = findSpecies(species, body.candidateId);
      const selected = (body.selectedIds || []).map((id) => findSpecies(species, id)).filter(Boolean);
      if (!candidate) return [404, { error: 'unknown species' }];
      return [200, checkCompanionFit(candidate, selected)];
    },
  },
  {
    method: 'POST',
    path: '/api/capacity',
    handler: async (req) => {
      const body = await readBody(req);
      const species = await allSpecies();
      const plant = findSpecies(species, body.speciesId);
      if (!plant) return [404, { error: 'unknown species' }];
      return [200, capacityForSpecies(body.container, plant, body.count)];
    },
  },
  {
    method: 'POST',
    path: '/api/floor-load',
    handler: async (req) => {
      const body = await readBody(req);
      return [200, computeFloorLoad(body)];
    },
  },
  {
    method: 'POST',
    path: '/api/fertilizer',
    handler: async (req) => {
      const body = await readBody(req);
      const species = await allSpecies();
      const plants = (body.ids || []).map((id) => findSpecies(species, id)).filter(Boolean);
      return [200, fertilizerGuidance(plants)];
    },
  },
  {
    method: 'POST',
    path: '/api/add-plant',
    handler: async (req) => {
      const body = await readBody(req);
      const userSpecies = await store.getUserSpecies();
      const result = await lookupSpecies(body.commonName, userSpecies);
      if (result.profile && !result.duplicate) {
        userSpecies.push(result.profile);
        await store.saveUserSpecies(userSpecies);
      }
      return [200, result];
    },
  },
  {
    method: 'GET',
    path: '/api/journal',
    handler: async () => [200, await store.getJournal()],
  },
  {
    method: 'POST',
    path: '/api/journal',
    handler: async (req) => {
      const body = await readBody(req);
      const journal = await store.getJournal();
      const entry = { id: `j${Date.now()}`, date: new Date().toISOString(), ...body };
      journal.push(entry);
      await store.saveJournal(journal);
      return [200, entry];
    },
  },
];

function matchRoute(method, pathname) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const routeParts = route.path.split('/').filter(Boolean);
    const pathParts = pathname.split('/').filter(Boolean);
    if (routeParts.length !== pathParts.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (routeParts[i] !== pathParts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { route, params };
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    const match = matchRoute(req.method, url.pathname);
    if (!match) return sendJson(res, 404, { error: 'no such route' });
    try {
      const [status, data] = await match.route.handler(req, match.params, url);
      return sendJson(res, status, data);
    } catch (err) {
      console.error(err);
      return sendJson(res, 500, { error: err.message });
    }
  }
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Balcony Garden Planner running at http://localhost:${PORT}`);
});
