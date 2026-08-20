// Free, rule-based extraction of an expiration date from a sentence, e.g.
// "add milk expiring next Friday" or "best by 8/25". No external API.

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
];

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Parse a date expression like "tomorrow", "next friday", "in 3 days",
 * "8/25", "8/25/2026", or "august 25th" relative to `now`.
 * Returns an ISO "YYYY-MM-DD" string, or null if it couldn't be parsed.
 */
function parseDateExpression(rawExpr, now = new Date()) {
  const expr = rawExpr.trim().toLowerCase().replace(/^(on|by|in)\s+/, '').replace(/[.,]$/, '');
  if (!expr) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (expr === 'today') return toISODate(today);
  if (expr === 'tomorrow') return toISODate(addDays(today, 1));

  // "in N days" / "in N weeks"
  let m = expr.match(/^(\d+)\s+(day|days|week|weeks)$/);
  if (m) {
    const n = parseInt(m[1], 10);
    const days = m[2].startsWith('week') ? n * 7 : n;
    return toISODate(addDays(today, days));
  }

  if (expr === 'next week') return toISODate(addDays(today, 7));

  // "next <weekday>" or bare "<weekday>" — both mean the nearest upcoming
  // occurrence; "next X" only differs from bare "X" when today IS X, where
  // it means next week's X rather than today.
  m = expr.match(/^(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (m) {
    const targetDow = WEEKDAYS.indexOf(m[2]);
    let delta = (targetDow - today.getDay() + 7) % 7;
    if (m[1] && delta === 0) delta = 7;
    return toISODate(addDays(today, delta));
  }

  // MM/DD or MM/DD/YYYY (also M-D, M-D-YYYY)
  m = expr.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
  if (m) {
    const month = parseInt(m[1], 10) - 1;
    const day = parseInt(m[2], 10);
    let year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    return toISODate(new Date(year, month, day));
  }

  // "Month Day[, Year]" or "Day Month[, Year]" (e.g. "august 25", "25th of august", "aug 25 2026")
  const monthPattern = MONTHS.map((mo) => mo.slice(0, 3)).join('|');
  m = expr.match(
    new RegExp(`\\b(${MONTHS.join('|')}|${monthPattern})\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`)
  );
  if (!m) {
    m = expr.match(
      new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS.join('|')}|${monthPattern})\\b(?:,?\\s+(\\d{4}))?`)
    );
    if (m) m = [m[0], m[2], m[1], m[3]]; // normalize to [full, monthWord, day, year]
  }
  if (m) {
    const monthWord = m[1];
    const monthIdx = MONTHS.findIndex((mo) => mo.startsWith(monthWord));
    const day = parseInt(m[2], 10);
    let year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    if (monthIdx === -1 || day < 1 || day > 31) return null;
    return toISODate(new Date(year, monthIdx, day));
  }

  return null;
}

const TRIGGER_RE = /\b(expires?|expiring|best\s+by|use\s+by|good\s+(?:until|till)|sell\s+by|exp(?:iration)?(?:\s+date)?)\b\s*:?\s*/i;

/**
 * Find and strip an expiration-date clause from a sentence.
 * Returns { text, expirationDate } — `text` has the clause removed,
 * `expirationDate` is an ISO date string or null if none was found/parsed.
 */
function extractExpiration(sentence, now = new Date()) {
  const match = sentence.match(TRIGGER_RE);
  if (!match) return { text: sentence, expirationDate: null };

  const before = sentence.slice(0, match.index);
  const after = sentence.slice(match.index + match[0].length).trim();

  // Try to parse a leading date expression out of what follows the trigger,
  // trying progressively shorter prefixes (up to 6 words) so trailing words
  // that belong to the item, if any, don't break the match.
  const words = after.split(/\s+/);
  for (let len = Math.min(6, words.length); len >= 1; len--) {
    const candidate = words.slice(0, len).join(' ');
    const parsed = parseDateExpression(candidate, now);
    if (parsed) {
      const remainder = words.slice(len).join(' ');
      return { text: `${before} ${remainder}`.trim(), expirationDate: parsed };
    }
  }

  // Trigger word found but no parseable date after it — drop the trigger
  // word itself so it doesn't pollute the item name, but no date captured.
  return { text: `${before} ${after}`.trim(), expirationDate: null };
}

module.exports = { parseDateExpression, extractExpiration };
