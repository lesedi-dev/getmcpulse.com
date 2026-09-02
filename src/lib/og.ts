/**
 * The share card, drawn at build time.
 *
 * Every `og:image` on this site is a real 1200×630 PNG generated from the same
 * title the page already renders, not a single stock card reused twenty-eight
 * times. Without one of these, a link pasted into Slack, X, LinkedIn or Discord
 * gets a blank grey rectangle — the tags in `Base.astro` were complete apart
 * from the one that actually shows up in the feed.
 *
 * ── Why two layers ─────────────────────────────────────────────────────────
 * The background is hand-written SVG and the foreground is Satori. That split
 * is deliberate:
 *
 *   - the background wants gradients, a pattern and a mask, which SVG says in
 *     four lines and Satori's flexbox subset cannot say at all;
 *   - the foreground wants text wrapped inside a box, which SVG cannot do and
 *     Satori exists for.
 *
 * Sharp composites the two and rasterises. `librsvg` renders the background's
 * masks and gradients properly, so nothing here depends on Satori growing SVG
 * features it does not have.
 *
 * ── Why the font is read from disk ─────────────────────────────────────────
 * Satori does its own text layout against a font file we hand it, so the card
 * is Inter on every machine that builds it. The alternative — letting `librsvg`
 * resolve a font name through `fontconfig` — renders in whatever the build
 * container happens to have installed, which on Vercel is not Inter and might
 * be nothing. `@fontsource/inter` ships `.woff`, which Satori reads; the
 * variable package this site loads in the browser ships only `.woff2`, which it
 * does not.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { publishedPosts } from "./posts";
import satori from "satori";
import sharp from "sharp";
import { SITE } from "./site";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * The dark palette, resolved to sRGB.
 *
 * `global.css` states these in `oklch`, which is the right thing for a
 * stylesheet and the wrong thing here: an OG card is rasterised by `librsvg`,
 * whose colour parsing predates `oklch` and silently drops what it cannot read
 * — a colour that becomes black is not a bug you notice until the card is
 * already in somebody's timeline. These are the same values converted once.
 *
 * The card is always dark. A share card has no reader preference to follow, and
 * the dark palette is the one the product is recognised by.
 */
const C = {
  bg: "#0b0d13",
  ink_100: "#eceef4",
  ink_300: "#c6cbd4",
  ink_500: "#9fa5b0",
  ink_800: "#252931",
  cyan: "#5ecfe4",
} as const;

/** The mark, same geometry as `Logo.astro` and `public/favicon.svg`. */
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="24" viewBox="2.5 9 27 14" fill="none" stroke="${C.cyan}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16h4.5l2-5.5 3.5 11 2.5-6.5 2 3h3"/><circle cx="26" cy="16" r="2.2" fill="${C.cyan}" stroke="none"/></svg>`;

function dataUri(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * The background: a cyan wash off the top-left, the site's grid fading
 * downward, and one hairline along the foot for the card to stand on. The same
 * four layers `PostCover.astro` draws, at share-card scale.
 */
function background() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="#ffffff" stroke-opacity="0.055" stroke-width="1"/>
    </pattern>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="0.72" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <mask id="gridFade"><rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#fade)"/></mask>
    <radialGradient id="wash" cx="0.06" cy="0.02" r="0.85">
      <stop offset="0" stop-color="${C.cyan}" stop-opacity="0.20"/>
      <stop offset="0.55" stop-color="${C.cyan}" stop-opacity="0.05"/>
      <stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${C.bg}"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#grid)" mask="url(#gridFade)"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#wash)"/>
  <rect y="${OG_HEIGHT - 6}" width="${OG_WIDTH}" height="6" fill="${C.cyan}" fill-opacity="0.55"/>
</svg>`;
}

/**
 * Inter, loaded once per build.
 *
 * `createRequire().resolve` rather than a path stitched onto `node_modules`,
 * because the file's real location is the package manager's business — a
 * hoisted install, a pnpm store and a monorepo put it in three different
 * places, and all three answer this correctly.
 */
let fonts: { name: string; data: Buffer; weight: 400 | 600; style: "normal" }[] | null = null;

function interFonts() {
  if (fonts) return fonts;

  const require = createRequire(import.meta.url);
  const load = (weight: 400 | 600) => ({
    name: "Inter",
    data: readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`)),
    weight,
    style: "normal" as const,
  });

  fonts = [load(400), load(600)];
  return fonts;
}

/**
 * Title size, by length.
 *
 * These titles run from "Pricing" to "Instrumentation must never break the
 * thing it is instrumenting", and one font size cannot serve both — the short
 * one looks lost and the long one runs off the card. Buckets rather than a
 * formula because the thing being chosen is *how many lines it should take*,
 * which is a judgement about the layout, not a ratio.
 */
function titleSize(length: number) {
  if (length <= 30) return 76;
  if (length <= 48) return 64;
  if (length <= 70) return 54;
  if (length <= 96) return 46;
  return 40;
}

/**
 * Trim to fit, preferring a full sentence.
 *
 * These descriptions are two or three sentences, and cutting the second one in
 * half mid-clause — "82,549 tools, 257,287 parameters,…" — reads as a broken
 * page rather than a summary. Ending on the last full stop that fits says the
 * same thing and finishes a thought. Falling back to a word boundary, and only
 * then to a hard cut, because a description could be one long sentence.
 */
function clamp(text: string, limit: number) {
  if (text.length <= limit) return text;

  const cut = text.slice(0, limit);

  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (sentence > limit * 0.45) return cut.slice(0, sentence + 1);

  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export interface OgCard {
  /** The path under `/og/`, without the extension — `index`, `blog/dead-tools`. */
  id: string;
  /** Small line above the title: the section, or a post's topic. */
  eyebrow: string;
  title: string;
  /** One line under the title. A post's own description, trimmed. */
  blurb: string;
}

const text = (
  content: string,
  style: Record<string, string | number>,
): Record<string, unknown> => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children: content },
});

/**
 * The in-page hero: the same drawing, centred.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * Posts used to open on `PostCover.astro` — a motif drawn per topic and varied
 * by a hash of the slug. Good instinct, wrong output: the "Tool design" motif
 * renders as five coloured pills, which reads as a loading skeleton rather than
 * a picture. That file's own comment concedes one of its four motifs "read as
 * an empty card rather than a drawing".
 *
 * So the hero is now generated from the post itself, from the same template
 * every time, with the title in the middle. Same background, same palette and
 * the same mark as the share card — it is one design seen in two places rather
 * than two pieces of art to keep in step.
 *
 * ── Why centred rather than the share card verbatim ───────────────────────
 * The share card is left-aligned because it sits alone in a timeline. The hero
 * sits inside a reading column, where a left-aligned block of the same text
 * reads as a duplicate paragraph. Centred, it reads as a plate.
 *
 * It carries the title everywhere it appears — the post page and every index
 * card get the identical image. An earlier version dropped the title on the
 * post page, on the grounds that the `h1` is directly above it; one image per
 * post is the simpler contract and the one this site wants.
 */
function heroForeground(card: OgCard) {
  const title = clamp(card.title, 110);

  return {
    type: "div",
    props: {
      style: {
        width: `${OG_WIDTH}px`,
        height: `${OG_HEIGHT}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "72px 96px",
        fontFamily: "Inter",
      },
      children: [
        // The mark and the topic, above the title, centred.
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", gap: "12px" },
            children: [
              { type: "img", props: { src: dataUri(MARK), width: 58, height: 30 } },
              text(card.eyebrow.toUpperCase(), {
                fontSize: 27,
                fontWeight: 600,
                color: C.cyan,
                letterSpacing: "0.14em",
              }),
            ],
          },
        },

        text(title, {
          marginTop: "34px",
          fontSize: titleSize(title.length) + 6,
          fontWeight: 600,
          color: C.ink_100,
          lineHeight: 1.1,
          letterSpacing: "-0.025em",
          textAlign: "center",
          maxWidth: "980px",
        }),

        /**
         * One hairline, then the domain, centred.
         *
         * Sized up from 20px in `ink_500`, which was legible on the 1200×630
         * original and gone by the time the same file was scaled into a 349px
         * index card — the one place the domain has a job to do, because that
         * card is what somebody sees before they know whose site it is.
         * 30px in `ink_300` survives the scale-down.
         */
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              marginTop: "40px",
              paddingTop: "30px",
              borderTop: `1px solid ${C.ink_800}`,
              width: "340px",
              justifyContent: "center",
            },
            children: [
              text(new URL(SITE.url ?? "https://getmcpulse.com").host, {
                fontSize: 30,
                fontWeight: 500,
                color: C.ink_300,
                letterSpacing: "0.01em",
              }),
            ],
          },
        },
      ],
    },
  };
}

/** Satori's element form, written as plain objects — no JSX, so no React. */
function foreground(card: OgCard) {
  const title = clamp(card.title, 120);

  return {
    type: "div",
    props: {
      style: {
        width: `${OG_WIDTH}px`,
        height: `${OG_HEIGHT}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "68px 76px 74px",
        fontFamily: "Inter",
      },
      children: [
        // The mark and the wordmark, top-left; the section, top-right.
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between" },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", alignItems: "center", gap: "14px" },
                  children: [
                    { type: "img", props: { src: dataUri(MARK), width: 46, height: 24 } },
                    text(SITE.name, {
                      fontSize: 30,
                      fontWeight: 600,
                      color: C.ink_100,
                      letterSpacing: "-0.02em",
                    }),
                  ],
                },
              },
              text(card.eyebrow.toUpperCase(), {
                fontSize: 19,
                fontWeight: 600,
                color: C.cyan,
                letterSpacing: "0.12em",
              }),
            ],
          },
        },

        // The title, and one line of what it is about.
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column" },
            children: [
              text(title, {
                fontSize: titleSize(title.length),
                fontWeight: 600,
                color: C.ink_100,
                lineHeight: 1.12,
                letterSpacing: "-0.025em",
              }),
              text(clamp(card.blurb, 120), {
                marginTop: "26px",
                fontSize: 25,
                fontWeight: 400,
                color: C.ink_500,
                lineHeight: 1.45,
                maxWidth: "930px",
              }),
            ],
          },
        },

        // The domain, so a screenshot of the card still says where it is from.
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "16px",
              paddingTop: "30px",
              borderTop: `1px solid ${C.ink_800}`,
            },
            children: [
              text(new URL(SITE.url ?? "https://getmcpulse.com").host, {
                fontSize: 26,
                fontWeight: 500,
                color: C.ink_300,
              }),
            ],
          },
        },
      ],
    },
  };
}

/** One card, as PNG bytes. `hero` is the centred in-page variant. */
export async function renderOgCard(
  card: OgCard,
  variant: "card" | "hero" = "card",
): Promise<Buffer> {
  const build = variant === "hero" ? heroForeground : foreground;
  const svg = await satori(build(card) as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: interFonts(),
  });

  return sharp(Buffer.from(background()))
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * `/` → `index`, `/pricing/` → `pricing`, `/blog/dead-tools/` → `blog/dead-tools`.
 *
 * Shared by the endpoint that writes the cards and the layout that links them,
 * so the two cannot disagree about what a page's card is called.
 */
export function ogSlug(pathname: string) {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "index" : trimmed;
}

/**
 * The static pages, in the order the nav reads them.
 *
 * `404` is deliberately absent: it is `noindex`, nobody shares it, and a card
 * for it would be one more thing to keep true.
 */
const STATIC_PAGES: (OgCard & { path: string })[] = [
  {
    path: "/",
    id: "index",
    eyebrow: "Analytics for MCP servers",
    // Kept in step with the `h1`. The card and the page are the same promise
    // seen in two places, and a share preview that pitches something the page
    // does not say is a bait the click then has to absorb.
    title: "See what models actually do with your MCP server",
    blurb:
      "Which tools they call, which they retry, which come back empty, and what your schemas cost every session.",
  },
  {
    path: "/how-it-works",
    id: "how-it-works",
    eyebrow: "How it works",
    title: "How MCPulse sees your server without touching its traffic",
    blurb:
      "An npm package inside your own server. Sizes and hashes only, never arguments or results.",
  },
  {
    path: "/metrics",
    id: "metrics",
    eyebrow: "Metrics",
    title: "The sixteen metrics MCPulse records",
    blurb:
      "What each metric tells you, and which are counted live versus computed on the nightly pass.",
  },
  {
    path: "/install",
    id: "install",
    eyebrow: "Installation",
    title: "Install MCPulse in two lines",
    blurb: "Pick your language, add the package, set your key, wrap your server. About two minutes.",
  },
  {
    path: "/check",
    id: "check",
    eyebrow: "Free tool",
    title: "Score your tool schemas against 4,749 servers",
    blurb:
      "Paste your tools/list JSON. Undescribed parameters, description collisions and schema token cost. Runs in your browser.",
  },
  {
    path: "/pricing",
    id: "pricing",
    eyebrow: "Pricing",
    title: "Free for one server. $49 for a server people depend on.",
    blurb:
      "Recording stops at the cap rather than billing past it, and history is hidden by a plan rather than deleted.",
  },
  {
    path: "/faq",
    id: "faq",
    eyebrow: "Questions",
    title: "Common questions about MCPulse",
    blurb:
      "What leaves your process, whether it can slow your tools down, which languages work today, and what happens at the cap.",
  },
  {
    path: "/blog",
    id: "blog",
    eyebrow: "Blog",
    title: "Notes on measuring what models do with your tools",
    blurb:
      "Retries, empty results, schema cost, and what the four outcomes of a tool call actually tell you.",
  },
];

let cards: (OgCard & { path: string })[] | null = null;

/** Every card this build produces: the static pages, then every post. */
export async function ogCards() {
  if (cards) return cards;

  const posts = await publishedPosts();

  cards = [
    ...STATIC_PAGES,
    ...posts.map((post) => ({
      path: `/blog/${post.id}`,
      id: `blog/${post.id}`,
      eyebrow: post.data.topic,
      title: post.data.title,
      blurb: post.data.description,
    })),
  ];

  return cards;
}

/**
 * The card for a page, as a site-absolute path.
 *
 * ── The fallback ──────────────────────────────────────────────────────────
 * Falls back rather than returning nothing, because a missing `og:image` is
 * the failure this whole file exists to fix — a page added without a card
 * entry should share badly, not share blank.
 *
 * It falls back to `/og-default.png`, the generic brand card from
 * `scripts/social.mjs`, and not to the home page's card. The home card carries
 * the home page's headline, so a page with no card of its own was sharing a
 * promise about a different page — which is most obvious on `/404`, the only
 * page that actually uses this branch today.
 *
 * That file is generated by `social.mjs` into `public/` alongside the kit copy,
 * so it is the same drawing as every avatar and header rather than a
 * hand-exported one that can stop matching the mark.
 */
export const OG_FALLBACK = "/og-default.png";

export async function ogImageFor(pathname: string) {
  const slug = ogSlug(pathname);
  const known = (await ogCards()).some((card) => card.id === slug);
  return known ? `/og/${slug}.png` : OG_FALLBACK;
}
