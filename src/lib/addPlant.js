// "Add a plant" — the user types a common name, and this either:
//   1. asks Claude to draft a species_reference profile (requires
//      ANTHROPIC_API_KEY), tagged field-by-field with confidence, or
//   2. hands back a blank template for manual entry if there's no API key.
//
// Either way, the result is NOT silently trusted: it comes back with
// verified: false and a warning, is usable right away for this one user,
// and never overwrites or gets merged into the seed SPECIES list — it's
// stored separately (user-species.json) and merged in at query time.

import { SPECIES } from '../data/species.js';

const PROFILE_SCHEMA_HINT = `Return ONLY a JSON object (no prose, no markdown fences) with this shape:
{
  "commonName": string,
  "scientificName": string,
  "category": "herb" | "vegetable" | "flower" | "foliage",
  "origin": string,
  "exotic": boolean,
  "sunHours": { "min": number, "max": number },
  "zone": { "min": number, "max": number },
  "saltTolerance": "low" | "medium" | "high",
  "windTolerance": "low" | "medium" | "high",
  "aphidSusceptibility": "low" | "medium" | "high",
  "toxicity": { "status": "toxic" | "non-toxic" | "uncertain" | "undocumented", "confidence": "verified" | "unverified", "source": string },
  "vine": boolean,
  "matureSpreadIn": number,
  "minDepthIn": number,
  "startMethod": "seed" | "cutting" | "division" | "nursery-start",
  "traits": { "nitrogenFixer": boolean, "pestRepellent": boolean, "trapCrop": boolean, "pollinatorMagnet": boolean, "heavyFeeder": boolean, "allelopathic": boolean },
  "waterNeed": "low" | "medium" | "high",
  "fertilizerLean": "nitrogen" | "balanced" | "phosphorus-potassium",
  "heatLevel": "none" | "mild" | "hot",
  "bestMonths": number[] | null,
  "notes": string
}
Use your best real horticultural knowledge. If genuinely unsure about a field (especially toxicity), say so honestly with "uncertain"/"undocumented" and confidence "unverified" rather than guessing confidently.`;

function blankTemplate(commonName) {
  return {
    commonName,
    scientificName: '',
    category: 'herb',
    origin: '',
    exotic: false,
    sunHours: { min: 6, max: 8 },
    zone: { min: 9, max: 11 },
    saltTolerance: 'medium',
    windTolerance: 'medium',
    aphidSusceptibility: 'medium',
    toxicity: { status: 'undocumented', confidence: 'unverified', source: 'Not looked up — no ANTHROPIC_API_KEY configured.' },
    vine: false,
    matureSpreadIn: 12,
    minDepthIn: 8,
    startMethod: 'nursery-start',
    traits: { nitrogenFixer: false, pestRepellent: false, trapCrop: false, pollinatorMagnet: false, heavyFeeder: false, allelopathic: false },
    waterNeed: 'medium',
    fertilizerLean: 'balanced',
    heatLevel: 'none',
    bestMonths: null,
    notes: 'Manually entered — fill in the fields you know and verify toxicity yourself before trusting it around pets.',
  };
}

function findDuplicate(commonName, userSpecies) {
  const norm = commonName.trim().toLowerCase();
  const all = [...SPECIES, ...userSpecies];
  return all.find((s) => s.commonName.trim().toLowerCase() === norm);
}

/**
 * @param {string} commonName
 * @param {object[]} userSpecies existing user-added species (for duplicate detection)
 * @returns {{ duplicate: object|null, profile: object|null, verified: boolean, warning: string }}
 */
export async function lookupSpecies(commonName, userSpecies = []) {
  const duplicate = findDuplicate(commonName, userSpecies);
  if (duplicate) {
    return {
      duplicate,
      profile: null,
      verified: false,
      warning: `"${commonName}" looks like a duplicate of an existing entry ("${duplicate.commonName}"). Not adding a second copy.`,
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      duplicate: null,
      profile: blankTemplate(commonName),
      verified: false,
      warning: 'No ANTHROPIC_API_KEY configured — returning a blank template for manual entry instead of an AI-drafted profile.',
    };
  }

  let Anthropic;
  try {
    ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
  } catch {
    return {
      duplicate: null,
      profile: blankTemplate(commonName),
      verified: false,
      warning: '@anthropic-ai/sdk is not installed (run `npm install`) — returning a blank template for manual entry instead.',
    };
  }

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Draft a balcony-gardening species profile for "${commonName}". ${PROFILE_SCHEMA_HINT}`,
      },
    ],
  });

  const text = message.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
  let profile;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    profile = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    return {
      duplicate: null,
      profile: blankTemplate(commonName),
      verified: false,
      warning: "Couldn't parse a profile from the model's response — falling back to a blank template.",
    };
  }

  profile.id = `user-${commonName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  profile.userAdded = true;

  return {
    duplicate: null,
    profile,
    verified: false,
    warning:
      'AI-drafted profile — unverified against a real botanical/ASPCA source. Usable right away for your own recommendations, but double-check toxicity yourself before it goes anywhere near pets.',
  };
}
