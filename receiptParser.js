// Free, rule-based line parser for OCR'd grocery receipt text. No external
// API — heuristics only. Receipt OCR is noisy by nature (abbreviated
// names, misread characters, store-specific formatting), so this is
// intentionally forgiving: it's fine to under-parse (skip a line) rather
// than invent a bogus item, since the user reviews everything before
// anything is saved.

const { guessCategory, guessLocation } = require('./categorize');
const { extractExpiration } = require('./dateParser');

// Lines containing any of these are almost never product lines on a
// grocery receipt.
const SKIP_LINE_RE = new RegExp(
  '\\b(' +
    [
      'total', 'subtotal', 'tax', 'cash', 'change', 'balance', 'visa', 'mastercard',
      'amex', 'discover', 'debit', 'credit', 'card', 'auth', 'approv', 'thank you',
      'store\\s*#', 'cashier', 'receipt', 'order\\s*#', 'reg\\s*#', 'terminal',
      'invoice', 'customer', 'survey', 'www\\.', 'http', '\\.com', 'member',
      'savings', 'coupon', 'rebate', 'refund', 'items? sold', 'ebt', 'tender',
    ].join('|') +
    ')\\b',
  'i'
);

const QTY_PREFIX_RE = /^(\d+)\s*[xX@]?\s+/;
const TRAILING_PRICE_RE = /\$?\d+\.\d{2}\s*[A-Z]?$/;
const PHONE_ONLY_RE = /^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

function looksLikeItemLine(line) {
  const trimmed = line.trim();
  if (trimmed.length < 2) return false;
  if (SKIP_LINE_RE.test(trimmed)) return false;
  if (PHONE_ONLY_RE.test(trimmed)) return false;
  if (!/[a-zA-Z]{2,}/.test(trimmed)) return false; // need at least one real word
  // Store name/address/footer lines almost never carry a trailing price —
  // require one so header noise like "123 Main St" or "WHOLE FOODS
  // MARKET" doesn't get mistaken for a product line. (A leading quantity
  // alone isn't a reliable enough signal: "123 Main St" also matches
  // that.)
  if (!TRAILING_PRICE_RE.test(trimmed)) return false;
  return true;
}

function titleCase(str) {
  return str
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function parseReceiptLine(rawLine) {
  let line = rawLine.trim();
  if (!looksLikeItemLine(line)) return null;

  line = line.replace(TRAILING_PRICE_RE, '').trim();
  if (!line) return null;

  let quantity = 1;
  const qtyMatch = line.match(QTY_PREFIX_RE);
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10);
    line = line.slice(qtyMatch[0].length);
  }

  // Some receipts print an expiration/sell-by date next to perishables.
  const { text: withoutDate, expirationDate } = extractExpiration(line);
  line = withoutDate;

  const cleaned = line
    .replace(/[^a-zA-Z0-9&'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 2) return null;

  const name = titleCase(cleaned);

  return {
    name,
    quantity,
    unit: '',
    location: guessLocation(name),
    category: guessCategory(name),
    action: 'add',
    expirationDate,
  };
}

/**
 * Parse raw OCR'd receipt text into candidate inventory items, one per
 * plausible product line. Non-product lines (totals, tax, card info,
 * store boilerplate) are dropped.
 *
 * @param {string} rawText
 * @returns {{items: Array<object>}}
 */
function parseReceiptText(rawText) {
  const lines = String(rawText || '').split(/\r?\n/);
  const items = lines.map(parseReceiptLine).filter(Boolean);
  return { items };
}

module.exports = { parseReceiptText, parseReceiptLine };
