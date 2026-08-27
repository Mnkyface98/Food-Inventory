#!/usr/bin/env node
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { searchEbay } from "./sources/ebay.js";
import { searchShopGoodwill } from "./sources/shopgoodwill.js";
import { searchEstateSales } from "./sources/estatesales.js";
import { analyzeListing } from "./analyze.js";
import { writeReport } from "./report.js";

const SOURCES = {
  ebay: searchEbay,
  shopgoodwill: searchShopGoodwill,
  estatesales: searchEstateSales,
};

function parseArgs(argv) {
  const args = {
    query: "wall art",
    sources: Object.keys(SOURCES),
    limit: 10,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--query" || arg === "-q") args.query = argv[++i];
    else if (arg === "--sources" || arg === "-s") args.sources = argv[++i].split(",");
    else if (arg === "--limit" || arg === "-l") args.limit = Number(argv[++i]);
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node src/cli.js [options]

Options:
  -q, --query <text>       Search keywords (default: "wall art")
  -s, --sources <list>     Comma-separated: ${Object.keys(SOURCES).join(",")} (default: all)
  -l, --limit <n>          Max listings per source (default: 10)
  -h, --help               Show this help

Requires a .env file — copy .env.example and fill in credentials.
Output: a Markdown + JSON report written to ./reports/`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.");
    process.exitCode = 1;
    return;
  }
  const client = new Anthropic();

  const invalidSources = args.sources.filter((s) => !SOURCES[s]);
  if (invalidSources.length) {
    console.error(`Unknown source(s): ${invalidSources.join(", ")}. Valid: ${Object.keys(SOURCES).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Searching for "${args.query}" across: ${args.sources.join(", ")}`);

  const listings = [];
  for (const name of args.sources) {
    try {
      const found = await SOURCES[name](args.query, args.limit);
      console.log(`  ${name}: ${found.length} listing(s)`);
      listings.push(...found);
    } catch (err) {
      console.error(`  ${name} failed: ${err.message}`);
    }
  }

  if (!listings.length) {
    console.log("No listings found — nothing to analyze.");
    return;
  }

  console.log(`Analyzing ${listings.length} listing(s) with Claude...`);
  const results = [];
  for (const listing of listings) {
    process.stdout.write(`  [${listing.source}] ${listing.title.slice(0, 60)} ... `);
    try {
      const analysis = await analyzeListing(listing, client);
      results.push({ listing, analysis });
      console.log("done");
    } catch (err) {
      console.log(`failed (${err.message})`);
    }
  }

  const { mdPath, jsonPath } = await writeReport(results);
  console.log(`\nReport written to:\n  ${mdPath}\n  ${jsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
