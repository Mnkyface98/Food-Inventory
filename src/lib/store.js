// Local, private-only JSON persistence. There is deliberately no
// crowd-sourced/shared layer — everything here lives on disk under
// ./data (gitignored) and is never sent anywhere.

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const FILES = {
  site: 'site.json',
  containers: 'containers.json',
  journal: 'journal.json',
  userSpecies: 'user-species.json',
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson(filename, fallback) {
  await ensureDataDir();
  const file = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(filename, data) {
  await ensureDataDir();
  const file = path.join(DATA_DIR, filename);
  await fs.writeFile(file, JSON.stringify(data, null, 2));
  return data;
}

export const store = {
  getSite: () => readJson(FILES.site, null),
  saveSite: (site) => writeJson(FILES.site, site),

  getContainers: () => readJson(FILES.containers, []),
  saveContainers: (containers) => writeJson(FILES.containers, containers),

  getJournal: () => readJson(FILES.journal, []),
  saveJournal: (entries) => writeJson(FILES.journal, entries),

  getUserSpecies: () => readJson(FILES.userSpecies, []),
  saveUserSpecies: (species) => writeJson(FILES.userSpecies, species),
};

export { DATA_DIR };
