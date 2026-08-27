import fs from "node:fs/promises";
import path from "node:path";

/**
 * @param {{listing: import("./listing.js").Listing, analysis: string}[]} results
 * @param {string} outDir
 */
export async function writeReport(results, outDir = "reports") {
  await fs.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  const jsonPath = path.join(outDir, `run-${stamp}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(results, null, 2));

  const md = [
    `# Thrift art scout — run ${new Date().toISOString()}`,
    "",
    `${results.length} listing(s) analyzed.`,
    "",
    ...results.flatMap(({ listing, analysis }) => [
      `## ${listing.title || "(untitled)"}`,
      "",
      `- **Source**: ${listing.source}`,
      `- **Link**: ${listing.url}`,
      listing.price ? `- **Price**: ${listing.price}` : null,
      listing.location ? `- **Location**: ${listing.location}` : null,
      "",
      analysis,
      "",
      "---",
      "",
    ].filter((line) => line !== null)),
  ].join("\n");

  const mdPath = path.join(outDir, `run-${stamp}.md`);
  await fs.writeFile(mdPath, md);

  return { jsonPath, mdPath };
}
