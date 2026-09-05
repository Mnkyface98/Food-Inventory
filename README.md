# Balcony Garden Planner

A private, local tool that recommends what to plant in a balcony container
based on real environmental conditions — sun hours, USDA zone, salt-water
proximity, wind exposure, and container size — rather than compass direction
alone. It grew out of a real conversation about a 49th-floor, SE-facing,
Zone 11 balcony in Miami with recurring aphid problems, and generalizes that
reasoning into a tool for any balcony gardener at any altitude, orientation,
or zone.

**There is no crowd-sourced or shared dataset.** Everything is local to your
own machine (`./data`, gitignored) — the recommendation engine runs entirely
on seeded, documented horticultural data plus whatever you add yourself.

## Why sun hours, not compass direction

Direction is only ever a rough proxy for how much sun a spot actually gets —
"SE" means very different things in December versus June, and nearby
buildings can shade away a lot of it. This tool asks for (or lets you
measure) actual sun hours per container instead, and uses that as the
primary environmental score. Zone is a hard filter; salt and wind tolerance
are conditional penalties; pest pressure is weighted up for floor-standing
containers, which lose the wind-driven knockback on soft-bodied pests and
gain easier crawling-pest access that a railing box several feet up doesn't
have to deal with.

## Setup

```bash
npm install
cp .env.example .env
# ANTHROPIC_API_KEY is optional — only needed for the "Add a plant" AI lookup.
# Without it, "Add a plant" hands back a blank template for manual entry.
npm start
# then open http://localhost:4100 (or the PORT you set)
```

## What it does

- **Site profile** — floor, building height, orientation, USDA zone, salt
  proximity, humidity band, and a self-rated wind-exposure score, saved
  once for the whole balcony.
- **Containers** — add rail boxes or floor-standing planters with length
  and width (required) and optional depth, plus their own sun-hours and
  wind-exposure reading (a wall-sheltered floor spot can genuinely see less
  of both than a railing box).
- **Recommend** — fills a container with plants that:
  - pass hard filters: USDA zone, minimum container depth, and whatever
    personal rules you have on (exclude toxic-to-pets, exclude vines,
    exclude hot peppers, and/or only show plants in season this month);
  - fit the container's actual remaining length using each species' real
    mature spread, not a guess;
  - don't clash with what's already planted (companion compatibility);
  - can be focused on "mix" (one herb + one vegetable + one flower + one
    foliage pick before filling freely) or a single category only.
  - Also supports "suggest what's missing" — rank candidates for whatever
    space is left in a partially-planted box, rather than committing to a
    full greedy fill.
- **Companion check** — pairwise compatibility from a small trait system
  (nitrogen-fixer, pest-repellent, trap-crop, pollinator-magnet,
  heavy-feeder, allelopathic, water need) plus a short curated-exception
  table for well-documented cases the traits alone wouldn't catch (e.g.
  fennel's near-universal suppression effect on neighbors).
- **Floor load calculator** — a structural safety check kept deliberately
  separate from the horticultural recommendations. It estimates a
  floor-standing container's wet weight (soil + container + plants) and
  the load per square foot that implies. **The pass/fail threshold is only
  as good as the rated capacity you give it** — that number has to come
  from your building (management or condo documents), never a guess. A
  commonly-cited residential minimum (40 lb/sq ft) is used as a fallback if
  you don't supply one, and the result says so explicitly.
- **Add a plant** — look up a species not in the built-in list. With
  `ANTHROPIC_API_KEY` set, this asks Claude to draft a full profile,
  tagged unverified; without a key (or without the dependency installed),
  it hands back a blank template instead. Either way, an added plant only
  ever affects your own recommendations — it's stored separately from the
  seed data and never overwrites or outranks it. Duplicate names are
  detected against both the seed list and anything you've already added.
- **Journal** — a private log per container/species (status, issue tags,
  notes). Never shared anywhere; it's just for your own record.

## Data model

`src/data/species.js` holds the seed `species_reference` data — one entry
per plant, sourced from documented horticultural and ASPCA toxicity
references, not assumed. Key fields: `category`, `origin`/`exotic`,
`sunHours`, `zone`, `saltTolerance`, `windTolerance`,
`aphidSusceptibility`, `toxicity` (`status` + `confidence` + `source` —
common names collide across genuinely different species, so this is never
a flat boolean), `vine`, `matureSpreadIn`, `minDepthIn`, `startMethod`,
`traits`, `waterNeed`, `fertilizerLean`, `heatLevel`, and `bestMonths`.

`src/lib/` holds the pure-function engine (`scoring.js`, `companions.js`,
`packing.js`, `floorLoad.js`, `fertilizer.js`, `addPlant.js`) — all
independently unit tested in `test/` with Node's built-in test runner
(`npm test`). `src/server.js` is a small dependency-free HTTP server (no
framework) exposing that engine as a JSON API to the static frontend in
`public/`. `src/lib/store.js` persists site/container/journal/user-species
data to local JSON files under `./data` (gitignored — nothing here is
committed or shared).

## Known simplifications

- **Single-row greedy packing.** Container fill is a best-fit-first pass
  with no backtracking — it can end a few inches short of optimal the way
  a human filling a shelf left-to-right would, and it only handles one row.
  A wider planter needing real 2D packing isn't modeled.
- **No live species lookup without an API key.** The built-in list is
  fixed seed data; "Add a plant" either asks Claude for a draft profile or
  falls back to a manual template — neither is a live botanical database
  call.
- **Companion logic is trait-based plus a short curated list**, not an
  exhaustive hand-written compatibility chart — it'll miss specific,
  undocumented interactions that aren't captured by the trait set or the
  exception table.
