import fs from "node:fs/promises";
import path from "node:path";
import { tierSortValue } from "./analyze.js";

const TIER_HEADINGS = {
  investigate: "🔎 Worth a professional look",
  unclear: "🤔 Unclear from photo alone",
  reproduction: "🖼️ Almost certainly a reproduction",
  unknown: "❔ Not analyzed",
};

/**
 * @param {{listing: import("./listing.js").Listing, analysis: {text: string, tier: string}}[]} results
 * @param {string} outDir
 */
export async function writeReport(results, outDir = "reports") {
  await fs.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  const jsonPath = path.join(outDir, `run-${stamp}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(results, null, 2));

  const sorted = [...results].sort(
    (a, b) => tierSortValue(a.analysis.tier) - tierSortValue(b.analysis.tier),
  );

  const sections = [];
  let currentTier = null;
  for (const { listing, analysis } of sorted) {
    if (analysis.tier !== currentTier) {
      currentTier = analysis.tier;
      sections.push(`\n## ${TIER_HEADINGS[currentTier] ?? currentTier}\n`);
    }
    sections.push(
      [
        `### ${listing.title || "(untitled)"}`,
        "",
        `- **Source**: ${listing.source}`,
        `- **Link**: ${listing.url}`,
        listing.price ? `- **Price**: ${listing.price}` : null,
        listing.location ? `- **Location**: ${listing.location}` : null,
        "",
        analysis.text,
        "",
        "---",
      ]
        .filter((line) => line !== null)
        .join("\n"),
    );
  }

  const md = [
    `# Thrift art scout — run ${new Date().toISOString()}`,
    "",
    `${results.length} listing(s) analyzed.`,
    ...sections,
  ].join("\n");

  const mdPath = path.join(outDir, `run-${stamp}.md`);
  await fs.writeFile(mdPath, md);

  return { jsonPath, mdPath };
}
