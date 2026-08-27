# Thrift Art Scout

A CLI tool that searches secondhand/thrift/estate-sale sites for wall art,
then uses Claude to review each listing's photo(s) and write up: what the
piece looks like, whether it resembles anything recognizable, signals for
reproduction-vs-original, and a rough resale value estimate.

**This is a lead-generation aid, not an appraisal tool.** It's designed to
help you decide what's worth a closer look — it does not and cannot
authenticate art. See "What this can't do" below before relying on it.

## Setup

```bash
npm install
cp .env.example .env
# then edit .env and fill in ANTHROPIC_API_KEY (required) and
# EBAY_CLIENT_ID / EBAY_CLIENT_SECRET (required for the eBay source)
```

## Usage

```bash
node src/cli.js --query "vintage oil painting" --sources ebay,shopgoodwill,estatesales --limit 10
```

Options:

| Flag | Default | Meaning |
|---|---|---|
| `-q, --query` | `"wall art"` | Search keywords |
| `-s, --sources` | all three | Comma-separated: `ebay,shopgoodwill,estatesales` |
| `-l, --limit` | `10` | Max listings pulled per source |
| `--include-seen` | off | Re-analyze listings already recorded in `data/seen.json` (by default they're skipped) |

Each run writes a Markdown report and a JSON dump to `./reports/`, with
listings grouped under three headings — worth a professional look, unclear
from photo alone, and almost certainly a reproduction — in that order, so
the reproductions (most of what you'll find) sink to the bottom instead of
burying the interesting ones.

`./data/seen.json` tracks which listings have already been analyzed
(by source + listing id) so re-running the same search doesn't re-spend an
API call re-reading something you've already gotten a writeup for. Delete
it, or pass `--include-seen`, to re-analyze everything.

## Sources — verification status

| Source | Status |
|---|---|
| `ebay` (`src/sources/ebay.js`) | Built against eBay's official, documented [Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html). Requires your own app credentials from https://developer.ebay.com/my/keys. |
| `shopgoodwill` (`src/sources/shopgoodwill.js`) | **Unverified.** ShopGoodwill has no public API; this calls the internal JSON endpoint their own site uses, reconstructed from public knowledge of how it works. Not exercised against the live endpoint — the environment this was built in can't reach shopgoodwill.com. Before trusting it: open the site, search in DevTools' Network tab, and confirm the request/response shape matches what's in the code. |
| `estatesales` (`src/sources/estatesales.js`) | **Unverified.** EstateSales.net has no API at all; this scrapes search-result HTML with best-guess CSS selectors. Very likely needs real selectors swapped in once you view the actual page source — it was not tested against the live site for the same network-access reason as above. |

I could not test the ShopGoodwill or EstateSales.net integrations end-to-end
because outbound network access in the environment this was built in is
restricted to an allowlist (npm registry, the Anthropic API, etc.) that
doesn't include those sites. Treat both as a starting point to debug against
the real site, not as working out of the box.

## Legal/ToS note

- eBay's Browse API is sanctioned, official access — use it under eBay's
  developer terms.
- ShopGoodwill and EstateSales.net do **not** offer a sanctioned API for
  this kind of use. Scraping/calling their internal endpoints is a gray
  area: review each site's Terms of Service and `robots.txt` yourself, keep
  request volume low (this tool does one request per run per source, not a
  crawl), and identify yourself honestly in request headers rather than
  spoofing a browser. Stop if either site tells you not to do this.

## What this can't do

- **No real reverse image search.** Claude can recognize famous works and
  reason about style from training knowledge, but it can't crawl the web to
  find "this exact photo also appears at this other URL" the way a
  dedicated reverse-image-search API (Google Vision Web Detection, TinEye,
  Bing Visual Search) can. Wiring one of those in as an extra signal before
  the Claude analysis step would meaningfully strengthen this.
- **No authenticity percentage, on purpose.** True authentication is a
  physical, expert-driven process (provenance research, material/pigment
  analysis, signature comparison) — nothing a photo and a thrift listing
  can support. The tool reports a coarse tier ("almost certainly a
  reproduction" / "unclear from photo alone" / "worth a professional look")
  with reasoning, never a fabricated number like "73% authentic."
- **Value estimates are rough ranges**, reasoned from what's visible and
  what Claude knows about comparable pieces — not a market data feed. For
  anything the tool flags as promising, treat it as "worth researching
  further" (sold-listing comps, an appraiser), not a number to trade on.
- Most wall art at thrift/estate sales is a mass-produced print. The tool
  is tuned to say so plainly rather than oversell borderline cases.
