import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are helping a thrift/estate-sale shopper decide whether a piece of \
wall art in a listing photo is worth a closer look — not delivering a formal appraisal.

You will be shown a listing photo plus its title/description/price from a secondhand site. Respond with:

1. **What it looks like**: medium (print, oil, watercolor, poster, etc.), subject, style/era.
2. **Recognizable?**: does it resemble a specific known artist or work you recognize from \
training data? Name it if so, and say plainly if you don't recognize it — never guess an \
artist name just to have an answer.
3. **Reproduction vs. original signals**: visible clues in the photo/listing (canvas texture \
vs. flat print, dot/halftone pattern, signature style, frame/backing, price point, seller's \
own description) that suggest mass-produced print vs. hand-made original. Most thrift-store \
wall art is a reproduction — say so when that's what the evidence points to.
4. **Authenticity tier**: one of "Almost certainly a print/reproduction", "Unclear from photo \
alone", or "Signals worth a professional look" — with your reasoning. Never state a numeric \
probability (e.g. "73% authentic") — a photo and a thrift listing cannot support that kind of \
precision, and a bare percentage misleads more than it informs.
5. **Resale value**: a rough range and how you'd arrive at it (e.g. "reproductions of this \
print typically resell for $20-60 based on how common they are; if it turned out to be an \
original it would be worth appraising separately since originals aren't comparable to prints"). \
State plainly when you don't have enough basis to estimate.

Be honest about uncertainty throughout. This is a lead-generation aid — its job is to help \
someone decide what's worth a second look, not to certify anything.`;

/**
 * @param {import("./listing.js").Listing} listing
 * @param {Anthropic} client
 * @returns {Promise<string>} the analysis writeup
 */
export async function analyzeListing(listing, client) {
  if (!listing.imageUrls.length) {
    return "No image available for this listing — skipped.";
  }

  const imageBlocks = [];
  for (const url of listing.imageUrls.slice(0, 3)) {
    const block = await fetchAsImageBlock(url);
    if (block) imageBlocks.push(block);
  }

  if (!imageBlocks.length) {
    return "Could not download any of this listing's images — skipped.";
  }

  const contextText = [
    `Title: ${listing.title}`,
    listing.price ? `Price: ${listing.price}` : null,
    listing.location ? `Location: ${listing.location}` : null,
    listing.description ? `Seller description: ${listing.description}` : null,
    `Source: ${listing.source} (${listing.url})`,
  ]
    .filter(Boolean)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, { type: "text", text: contextText }],
      },
    ],
  });

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

async function fetchAsImageBlock(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: contentType,
        data: buf.toString("base64"),
      },
    };
  } catch {
    return null;
  }
}
