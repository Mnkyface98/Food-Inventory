// Free, rule-based line parser for OCR'd grocery receipt text. No external
// API — heuristics only. Receipt OCR is noisy by nature (abbreviated
// names, misread characters, store-specific formatting), so this is
// intentionally forgiving: it's fine to under-parse (skip a line) rather
// than invent a bogus item, since the user reviews everything before
// anything is saved.

const { guessCategory, guessLocation } = require('./categorize');
const { extractExpiration } = require('./dateParser');
const { extractWeightVolume, hasWeightVolume } = require('./weightVolumeParser');

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
// A quantity line printed on its OWN row instead of as a prefix on the
// item's name — common on digital order receipts/confirmations, e.g.
// "4 x $2.79" sitting just below "OLIPOP ... (12 fl oz)".
const QTY_X_PRICE_LINE_RE = /^(\d+)\s*x\s*\$?\d+(?:\.\d{2})?\b/i;
const TRAILING_PRICE_RE = /\$?\d+\.\d{2}\s*[A-Z]?$/;
const PHONE_ONLY_RE = /^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

function looksLikeItemLine(line) {
  const trimmed = line.trim();
  if (trimmed.length < 2) return false;
  if (SKIP_LINE_RE.test(trimmed)) return false;
  if (PHONE_ONLY_RE.test(trimmed)) return false;
  if (!/[a-zA-Z]{2,}/.test(trimmed)) return false; // need at least one real word
  // Store name/address/footer lines almost never carry a trailing price —
  // normally require one so header noise like "123 Main St" or "WHOLE
  // FOODS MARKET" doesn't get mistaken for a product line. The one
  // exception is a line that carries its own recognizable size (e.g.
  // "(12 fl oz)") — a strong enough product signal on its own, since
  // some receipts print the price on a separate line below the name.
  if (!TRAILING_PRICE_RE.test(trimmed) && !hasWeightVolume(trimmed)) return false;
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

  // Product titles very often carry their own package size — "ELMHURST
  // UNSWEETENED ALMOND MILK 32 FL OZ", "OLIPOP ... (12 fl oz)" — pull it
  // out into its own field rather than leaving it stuck in the name, so
  // it can drive the item's tracked weight/volume automatically. Assumed
  // full, same as a freshly scanned barcode: amount and total match.
  // Done BEFORE the character-cleaning below, which would otherwise
  // strip the decimal point out of e.g. "2.65 oz" (turning it into "2
  // 65 oz" and corrupting the amount) and the parentheses that mark a
  // size apart from an early, similar-looking marketing callout.
  const { text: withoutSize, fullnessAmount, fullnessUnit } = extractWeightVolume(line);
  const nameSource = withoutSize.trim().length >= 2 ? withoutSize : line;

  const cleaned = nameSource
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
    fullnessUnit,
    fullnessAmount,
    fullnessTotal: fullnessAmount,
  };
}

// A long product name can visually wrap in the source image right where
// its "(12 fl oz)"-style size sits, so OCR reads it as two separate
// lines — "...Refrigerated (12 fl" then "oz)" — leaving the size
// unparseable (and, worse, letting an earlier, similar-looking number
// like "9g Fiber" get mistaken for it instead) and pushing the real
// quantity line ("4 x $2.79") one row further away than the lookahead
// below expects. Re-joins any line with an unclosed "(" onto the
// line(s) after it until the parentheses balance, so the rest of the
// parser sees one complete line either way.
function mergeWrappedParenLines(rawLines) {
  const merged = [];
  let i = 0;
  while (i < rawLines.length) {
    let line = rawLines[i];
    const unbalanced = () => (line.match(/\(/g) || []).length > (line.match(/\)/g) || []).length;
    while (unbalanced() && i + 1 < rawLines.length) {
      i++;
      line = `${line} ${rawLines[i]}`.trim();
    }
    merged.push(line);
    i++;
  }
  return merged;
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
  const lines = mergeWrappedParenLines(String(rawText || '').split(/\r?\n/));
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const parsed = parseReceiptLine(rawLine);
    if (!parsed) continue;

    // This line's own text had no leading quantity ("2 x ..." / "2 ...")
    // — check whether the NEXT line is a standalone "N x $price" instead,
    // the common layout on digital order receipts where the item's name
    // (with its size) and its purchase quantity print on separate rows.
    // That's a more reliable count than the default of 1.
    if (!QTY_PREFIX_RE.test(rawLine.trim())) {
      const nextLine = (lines[i + 1] || '').trim();
      const qtyMatch = nextLine.match(QTY_X_PRICE_LINE_RE);
      if (qtyMatch) {
        parsed.quantity = parseInt(qtyMatch[1], 10);
        i++; // consume it so it isn't also evaluated as its own (non-)item
      }
    }

    items.push(parsed);
  }
  return { items };
}

module.exports = { parseReceiptText, parseReceiptLine };
