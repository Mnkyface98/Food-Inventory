#!/usr/bin/env node
import "dotenv/config";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * A tiny local web dashboard for browsing past runs' reports (the JSON
 * files written by writeReport). No external dependencies — just Node's
 * built-in http server, since this only ever needs to read local files and
 * render them; it doesn't talk to any external site itself.
 */

const PORT = Number(process.env.DASHBOARD_PORT) || 4000;
const REPORTS_DIR = "reports";

const TIER_LABELS = {
  investigate: "🔎 Worth a professional look",
  unclear: "🤔 Unclear from photo alone",
  reproduction: "🖼️ Almost certainly a reproduction",
  unknown: "❔ Not analyzed",
};
const TIER_ORDER = ["investigate", "unclear", "reproduction", "unknown"];

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function listRuns() {
  let files;
  try {
    files = await fs.readdir(REPORTS_DIR);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  return files
    .filter((f) => f.startsWith("run-") && f.endsWith(".json"))
    .sort()
    .reverse();
}

async function loadRun(filename) {
  const raw = await fs.readFile(path.join(REPORTS_DIR, filename), "utf8");
  return JSON.parse(raw);
}

function pageShell(title, body) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; line-height: 1.4; }
  h1 { font-size: 1.4rem; }
  h2 { margin-top: 2.5rem; border-bottom: 2px solid currentColor; padding-bottom: 0.25rem; }
  .card { display: flex; gap: 1rem; margin: 1.5rem 0; padding-bottom: 1.5rem; border-bottom: 1px solid #8888; }
  .card img { width: 160px; height: 160px; object-fit: cover; border-radius: 6px; flex-shrink: 0; background: #8882; }
  .meta { color: #888; font-size: 0.9rem; }
  .analysis { white-space: pre-wrap; margin-top: 0.5rem; }
  .run-list a { display: block; padding: 0.4rem 0; }
  a { color: inherit; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function renderRunList(runs) {
  if (!runs.length) {
    return pageShell(
      "Thrift Art Scout",
      `<h1>Thrift Art Scout</h1><p>No reports yet — run <code>node src/cli.js</code> first.</p>`,
    );
  }
  const items = runs
    .map((f) => `<a href="/run/${encodeURIComponent(f)}">${escapeHtml(f)}</a>`)
    .join("\n");
  return pageShell("Thrift Art Scout", `<h1>Thrift Art Scout — runs</h1><div class="run-list">${items}</div>`);
}

function renderRun(filename, results) {
  const byTier = new Map(TIER_ORDER.map((t) => [t, []]));
  for (const r of results) {
    const tier = TIER_ORDER.includes(r.analysis?.tier) ? r.analysis.tier : "unknown";
    byTier.get(tier).push(r);
  }

  const sections = TIER_ORDER.filter((t) => byTier.get(t).length).map((tier) => {
    const cards = byTier
      .get(tier)
      .map(({ listing, analysis }) => {
        const img = listing.imageUrls?.[0];
        return `<div class="card">
  ${img ? `<img src="${escapeHtml(img)}" alt="">` : ""}
  <div>
    <strong><a href="${escapeHtml(listing.url)}" target="_blank" rel="noopener">${escapeHtml(listing.title || "(untitled)")}</a></strong>
    <div class="meta">${escapeHtml(listing.source)}${listing.price ? " · " + escapeHtml(listing.price) : ""}${listing.location ? " · " + escapeHtml(listing.location) : ""}</div>
    <div class="analysis">${escapeHtml(analysis.text)}</div>
  </div>
</div>`;
      })
      .join("\n");
    return `<h2>${escapeHtml(TIER_LABELS[tier])} (${byTier.get(tier).length})</h2>\n${cards}`;
  });

  const body = `<a href="/">&larr; all runs</a><h1>${escapeHtml(filename)}</h1>${sections.join("\n") || "<p>No listings in this run.</p>"}`;
  return pageShell(filename, body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === "/") {
      const runs = await listRuns();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderRunList(runs));
      return;
    }

    const match = url.pathname.match(/^\/run\/([^/]+)$/);
    if (match) {
      const filename = decodeURIComponent(match[1]);
      // Guard against path traversal — only allow the exact filenames listRuns() would produce.
      if (!/^run-[\w:.-]+\.json$/.test(filename)) {
        res.writeHead(400).end("Invalid run filename");
        return;
      }
      const results = await loadRun(filename);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderRun(filename, results));
      return;
    }

    res.writeHead(404).end("Not found");
  } catch (err) {
    console.error(err);
    res.writeHead(500).end("Internal error");
  }
});

server.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
