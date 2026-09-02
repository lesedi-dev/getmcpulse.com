/**
 * The mark, the palette and the words — asserted identical across every copy.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * The brand kit's README says the point of generating it is that "the mark, the
 * cyan and the tagline stay one decision rather than fourteen". That is the
 * right goal and the README is not a mechanism — nothing stopped the copies
 * diverging, and there are five of them:
 *
 *   public/favicon.svg          the browser tab and the generated icon set
 *   src/components/Logo.astro   the nav and the footer
 *   src/lib/og.ts               every per-page share card
 *   scripts/social.mjs          the social kit, at fourteen pixel sizes
 *   src/lib/site.ts             the name and tagline the kit prints
 *
 * They agree today. The failure this prevents is the quiet one: somebody nudges
 * the trace in `Logo.astro`, the nav updates, and the favicon, the share cards
 * and the X header keep the old drawing — each of which is generated at a
 * different time by a different tool, so nothing renders side by side and
 * nothing looks wrong until a stranger sees two marks.
 *
 * Comparing text rather than pixels is deliberate: these are four different
 * output formats from one drawing, so the drawing is the thing to compare.
 */

import { readFileSync } from "node:fs";

let failures = 0;

function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failures++;
    console.log(`FAIL  ${label}\n        ${JSON.stringify(got)}\n        ${JSON.stringify(want)}`);
  } else {
    console.log(`pass  ${label}`);
  }
}

const read = (p: string) => readFileSync(p, "utf8");
const favicon = read("public/favicon.svg");
const logo = read("src/components/Logo.astro");
const og = read("src/lib/og.ts");
const social = read("scripts/social.mjs");
const site = read("src/lib/site.ts");

const grab = (source: string, re: RegExp, label: string) => {
  const m = re.exec(source);
  if (!m) {
    failures++;
    console.log(`FAIL  could not find ${label}`);
    return null;
  }
  return m[1];
};

/* ── The trace ──────────────────────────────────────────────────────────── */
const TRACE = /d="(M4 16h[^"]*)"/;
const traces = {
  "favicon.svg": grab(favicon, TRACE, "trace in favicon.svg"),
  "Logo.astro": grab(logo, TRACE, "trace in Logo.astro"),
  "og.ts": grab(og, TRACE, "trace in og.ts"),
  "social.mjs": grab(social, /const TRACE = "(M4 16h[^"]*)"/, "TRACE in social.mjs"),
};
for (const [where, value] of Object.entries(traces)) {
  if (where !== "favicon.svg") eq(`trace matches favicon.svg — ${where}`, value, traces["favicon.svg"]);
}

/* ── The dot ────────────────────────────────────────────────────────────── */
const dotOf = (s: string) => {
  const m = /cx="([\d.]+)"\s+cy="([\d.]+)"\s+r="([\d.]+)"/.exec(s);
  return m ? { cx: +m[1], cy: +m[2], r: +m[3] } : null;
};
const faviconDot = dotOf(favicon);
eq("dot matches — Logo.astro", dotOf(logo), faviconDot);
eq("dot matches — og.ts", dotOf(og), faviconDot);
const socialDot = /const DOT = \{ cx: ([\d.]+), cy: ([\d.]+), r: ([\d.]+) \}/.exec(social);
eq(
  "dot matches — social.mjs",
  socialDot ? { cx: +socialDot[1], cy: +socialDot[2], r: +socialDot[3] } : null,
  faviconDot,
);

/* ── The artwork box ────────────────────────────────────────────────────── */
const logoBox = grab(logo, /viewBox="([\d.\s]+)"/, "viewBox in Logo.astro");
const socialArt = /const ART = \{ x: ([\d.]+), y: ([\d.]+), w: ([\d.]+), h: ([\d.]+) \}/.exec(social);
eq(
  "social.mjs ART is Logo.astro's viewBox",
  socialArt ? `${socialArt[1]} ${socialArt[2]} ${socialArt[3]} ${socialArt[4]}` : null,
  logoBox?.trim(),
);

/* ── The palette ────────────────────────────────────────────────────────── */
const paletteOf = (source: string) => {
  const block = /const C = \{([\s\S]*?)\n\} as const;|const C = \{([\s\S]*?)\n\};/.exec(source);
  const body = block ? (block[1] ?? block[2]) : "";
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(\w+):\s*"(#[0-9a-fA-F]{6})"/g)) out[m[1]] = m[2].toLowerCase();
  return out;
};
const ogPalette = paletteOf(og);
const socialPalette = paletteOf(social);
const shared = Object.keys(ogPalette).filter((k) => k in socialPalette);
eq("og.ts and social.mjs share colour keys", shared.length > 0, true);
for (const key of shared) {
  eq(`palette ${key}`, socialPalette[key], ogPalette[key]);
}
// The favicon paints the mark directly, so its cyan must match too.
eq("favicon.svg cyan", /stroke="(#[0-9a-f]{6})"/.exec(favicon)?.[1], ogPalette.cyan);

/* ── The words ──────────────────────────────────────────────────────────── */
eq(
  "social.mjs NAME is SITE.name",
  grab(social, /const NAME = "([^"]+)"/, "NAME"),
  grab(site, /\n  name: "([^"]+)"/, "SITE.name"),
);
eq(
  "social.mjs TAGLINE is SITE.tagline",
  grab(social, /const TAGLINE = "([^"]+)"/, "TAGLINE"),
  grab(site, /\n  tagline: "([^"]+)"/, "SITE.tagline"),
);
eq(
  "social.mjs DOMAIN is the site host",
  grab(social, /const DOMAIN = "([^"]+)"/, "DOMAIN"),
  "getmcpulse.com",
);

/* ── The served default card ────────────────────────────────────────────── */
/**
 * `public/og-default.png` is written by `social.mjs` next to the kit copy, and
 * it is the `og:image` for any page without its own card. A hand-made copy is
 * exactly the drift this file exists to catch, so the two must be byte-equal.
 */
{
  const kit = readFileSync("brand/social/og-default-1200x630.png");
  const served = readFileSync("public/og-default.png");
  eq("public/og-default.png matches the kit copy byte for byte", served.equals(kit), true);
  eq("og.ts falls back to it", read("src/lib/og.ts").includes('OG_FALLBACK = "/og-default.png"'), true);
}

console.log(failures ? `\n${failures} brand inconsistency(ies)` : "\nbrand consistent across all five sources");
process.exit(failures ? 1 : 0);
