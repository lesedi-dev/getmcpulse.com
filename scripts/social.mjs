/**
 * The social-media kit, drawn from the same geometry as the site.
 *
 * Profile pictures and channel headers are the one place the brand shows up
 * outside our own HTML, and the usual way they go wrong is that somebody
 * screenshots the nav and crops it: a different mark, a different cyan, text
 * sitting where the platform is about to paste an avatar over it. This draws
 * every asset from `Logo.astro`'s path and `og.ts`'s palette, at each
 * platform's real pixel size, with the content kept inside that platform's
 * safe area.
 *
 * Run: node scripts/social.mjs   → writes brand/social/
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "brand", "social");
/**
 * `og-default` is also served, so it goes to `public/` as well as the kit.
 *
 * Written by the generator rather than copied, because a copy is a second file
 * that can silently stop matching the mark — which is the whole failure this
 * script exists to prevent. One drawing, two destinations.
 */
const PUBLIC = join(ROOT, "public");
const ALSO_PUBLIC = { "og-default-1200x630.png": "og-default.png" };

/** Same sRGB values as `og.ts` — a raster has no `oklch`. */
const C = {
  bg: "#0b0d13",
  tile: "#0b0e14",
  ink_100: "#eceef4",
  ink_500: "#9fa5b0",
  cyan: "#5ecfe4",
  paper: "#f7f8fa",
  paper_ink: "#141922",
};

const NAME = "MCPulse";
const TAGLINE = "Analytics for MCP servers";
const DOMAIN = "getmcpulse.com";

/** The mark, on its own 32×32 grid. Identical to `Logo.astro`. */
const TRACE = "M4 16h4.5l2-5.5 3.5 11 2.5-6.5 2 3h3";
const DOT = { cx: 26, cy: 16, r: 2.2 };
/** The artwork's own box inside that grid, cropped of padding. */
const ART = { x: 2.5, y: 9, w: 27, h: 14 };

const fonts = [400, 600].map((weight) => ({
  name: "Inter",
  data: readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`)),
  weight,
  style: "normal",
}));

const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/** The mark alone, cropped to the artwork, at whatever size is asked for. */
function mark(width, color = C.cyan) {
  const height = Math.round((width * ART.h) / ART.w);
  return {
    width,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${ART.x} ${ART.y} ${ART.w} ${ART.h}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${TRACE}"/><circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r}" fill="${color}" stroke="none"/></svg>`,
  };
}

/**
 * The banner background: the site's four layers, plus a hairline pulse trace.
 *
 * The trace is the logo's own path repeated across the width, not a generic
 * squiggle — so a header cropped to a thumbnail still reads as this product.
 * It is drawn with an explicit stroke width in *pixels* rather than left to
 * scale with the group: at banner size a uniform scale turns the mark's 2.2
 * units into a 120px slab, which is how the first draft came out looking like
 * four grey blobs instead of a heartbeat.
 */
function background(w, h, safe) {
  const grid = Math.max(28, Math.round(w / 26));
  const foot = Math.max(4, Math.round(h / 90));

  // The trace: one unit of the mark, chained across the canvas.
  //
  // Its band is sized and placed off the *safe* box, not the canvas, so it
  // keeps the same relationship to the lockup everywhere. On YouTube the two
  // differ by a thousand pixels: measured off the canvas the trace lands in
  // the strip a TV crops away, and the header most people see has nothing in
  // it but a wordmark.
  const band = Math.min(safe.safeH * 0.3, 170);
  const baseline = h / 2 + safe.safeH * 0.28;
  const s = band / ART.h;
  //
  // The logo's path is not a cycle — it ends two units above where it began,
  // which is right for a mark and wrong for a repeat: chained nineteen times
  // it walks off the bottom of the banner. The tail is closed back to the
  // baseline with `1.5-2`, so every repetition starts level with the last.
  const unit = "h4.5l2-5.5 3.5 11 2.5-6.5 2 3 1.5-2h2";
  const unitW = 18;
  const repeats = Math.ceil(w / (unitW * s)) + 1;
  const d = `M0 16${unit.repeat(repeats)}`;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <pattern id="grid" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse">
      <path d="M${grid} 0H0V${grid}" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="0.72" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <mask id="gridFade"><rect width="${w}" height="${h}" fill="url(#fade)"/></mask>
    <radialGradient id="wash" cx="0.06" cy="0.02" r="0.85">
      <stop offset="0" stop-color="${C.cyan}" stop-opacity="0.20"/>
      <stop offset="0.55" stop-color="${C.cyan}" stop-opacity="0.05"/>
      <stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ends" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.18" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="0.82" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <mask id="traceFade"><rect width="${w}" height="${h}" fill="url(#ends)"/></mask>
  </defs>

  <rect width="${w}" height="${h}" fill="${C.bg}"/>
  <rect width="${w}" height="${h}" fill="url(#grid)" mask="url(#gridFade)"/>
  <g mask="url(#traceFade)" opacity="0.11">
    <g transform="translate(0 ${baseline - 16 * s}) scale(${s})">
      <path d="${d}" fill="none" stroke="${C.cyan}" stroke-width="${(w > 1800 ? 5 : 3.5) / s}" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
  <rect width="${w}" height="${h}" fill="url(#wash)"/>
  <rect y="${h - foot}" width="${w}" height="${foot}" fill="${C.cyan}" fill-opacity="0.55"/>
</svg>`);
}

const text = (content, style) => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children: content },
});

/**
 * The lockup, laid out inside the platform's safe box.
 *
 * Satori is given the *whole* canvas and the safe box is expressed as padding,
 * because the thing that must not move is the gap between the artwork and the
 * edge the platform is going to cover.
 */
function lockup(w, h, { safeW, safeH, tagline = true }) {
  // Three lines need room. LinkedIn's company banner gives the design a 165px
  // strip, and the domain set under a tagline in that space sits on the foot
  // rule; the lockup and one line of what it is are what fit.
  const domain = tagline && safeH >= 220;
  const padX = Math.round((w - safeW) / 2);
  const padY = Math.round((h - safeH) / 2);

  // Typography follows the safe *height*: a 191px LinkedIn strip and a 1440px
  // YouTube canvas are the same design at two very different scales.
  const unit = safeH;
  const markW = Math.round(Math.min(unit * 0.42, safeW * 0.16));
  const nameSize = Math.round(Math.min(unit * 0.3, safeW * 0.115));
  const tagSize = Math.round(nameSize * 0.36);

  const art = mark(markW);

  return {
    type: "div",
    props: {
      style: {
        width: `${w}px`,
        height: `${h}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: `${padY}px ${padX}px`,
        fontFamily: "Inter",
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", gap: `${Math.round(nameSize * 0.3)}px` },
            children: [
              { type: "img", props: { src: dataUri(art.svg), width: art.width, height: art.height } },
              text(NAME, {
                fontSize: nameSize,
                fontWeight: 600,
                color: C.ink_100,
                letterSpacing: "-0.03em",
              }),
            ],
          },
        },
        ...(tagline
          ? [
              text(TAGLINE, {
                marginTop: `${Math.round(nameSize * 0.34)}px`,
                fontSize: tagSize,
                fontWeight: 400,
                color: C.ink_500,
                letterSpacing: "0.01em",
              }),
              ...(domain ? [text(DOMAIN, {
                marginTop: `${Math.round(tagSize * 0.7)}px`,
                fontSize: Math.round(tagSize * 0.82),
                fontWeight: 500,
                color: C.cyan,
                letterSpacing: "0.06em",
              })] : []),
            ]
          : []),
      ],
    },
  };
}

async function write(name, buffer) {
  writeFileSync(join(OUT, name), buffer);

  const served = ALSO_PUBLIC[name];
  if (served) writeFileSync(join(PUBLIC, served), buffer);

  const { width, height, size } = { ...(await sharp(buffer).metadata()), size: buffer.length };
  console.log(
    `  ${name.padEnd(34)} ${String(width).padStart(5)}×${String(height).padEnd(5)} ${(size / 1024).toFixed(0)} kB` +
      (served ? `   → public/${served}` : ""),
  );
}

/** A square avatar: dark tile, cyan wash, mark centred well inside the circle crop. */
async function avatar(size, { light = false, transparent = false } = {}) {
  const art = mark(Math.round(size * 0.62), light ? "#0e7f95" : C.cyan);
  const radius = Math.round(size * 0.22);

  const tile = transparent
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="none"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="wash" cx="0.22" cy="0.14" r="0.9">
      <stop offset="0" stop-color="${C.cyan}" stop-opacity="${light ? 0.14 : 0.22}"/>
      <stop offset="0.6" stop-color="${C.cyan}" stop-opacity="0.04"/>
      <stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="r"><rect width="${size}" height="${size}" rx="${radius}"/></clipPath>
  </defs>
  <g clip-path="url(#r)">
    <rect width="${size}" height="${size}" fill="${light ? C.paper : C.tile}"/>
    <rect width="${size}" height="${size}" fill="url(#wash)"/>
  </g>
</svg>`;

  return sharp(Buffer.from(tile))
    .composite([
      {
        input: Buffer.from(art.svg),
        top: Math.round((size - art.height) / 2),
        left: Math.round((size - art.width) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** A banner: background layers, lockup composited on top. */
async function banner(w, h, safe) {
  const svg = await satori(lockup(w, h, safe), { width: w, height: h, fonts });
  return sharp(background(w, h, safe))
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * The horizontal lockup on transparent, for slide decks and README headers.
 *
 * Trimmed to its own ink rather than left on the canvas Satori laid it out in.
 * A centred lockup inside a 1600×416 frame is mostly empty pixels, and every
 * place this file gets dropped — a README, a slide, a partner page — sizes it
 * by the image box, so the padding shows up as a mark that looks half the size
 * it was set at.
 */
async function wordmark(w, light = false) {
  const h = Math.round(w * 0.26);
  const el = lockup(w, h, { safeW: w, safeH: h, tagline: false });
  const art = mark(Math.round(Math.min(h * 0.42, w * 0.16)), light ? "#0e7f95" : C.cyan);

  el.props.children[0].props.children[0].props.src = dataUri(art.svg);
  el.props.children[0].props.children[1].props.style.color = light ? C.paper_ink : C.ink_100;

  const svg = await satori(el, { width: w, height: h, fonts });
  const trimmed = await sharp(Buffer.from(svg)).trim({ threshold: 1 }).toBuffer();
  const pad = Math.round(h * 0.09);

  return sharp(trimmed)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * The platforms, with each one's *safe* box rather than its canvas.
 *
 * The canvas is what you upload; the safe box is what survives. YouTube shows
 * 1546×423 of a 2560×1440 image on a phone, X pastes the avatar over the
 * bottom-left of a 1500×500, and LinkedIn crops a company banner on narrow
 * viewports — so the lockup is centred inside the box each of them promises to
 * keep, not inside the file.
 */
const BANNERS = [
  ["x-header-1500x500.png", 1500, 500, { safeW: 1180, safeH: 340 }],
  ["linkedin-company-1128x191.png", 1128, 191, { safeW: 900, safeH: 165 }],
  ["linkedin-personal-1584x396.png", 1584, 396, { safeW: 1200, safeH: 320 }],
  ["github-org-1280x640.png", 1280, 640, { safeW: 1060, safeH: 460 }],
  ["youtube-channel-2560x1440.png", 2560, 1440, { safeW: 1546, safeH: 423 }],
  ["facebook-cover-1640x624.png", 1640, 624, { safeW: 1200, safeH: 440 }],
  ["og-default-1200x630.png", 1200, 630, { safeW: 1000, safeH: 460 }],
];

const AVATARS = [
  ["logo-dark-1000.png", 1000, {}],
  ["logo-dark-400.png", 400, {}],
  ["logo-light-1000.png", 1000, { light: true }],
  ["logo-transparent-1000.png", 1000, { transparent: true }],
  ["logo-transparent-512.png", 512, { transparent: true }],
];

mkdirSync(OUT, { recursive: true });
console.log("\nbrand/social/\n");

for (const [name, size, opts] of AVATARS) await write(name, await avatar(size, opts));
for (const [name, w, h, safe] of BANNERS) await write(name, await banner(w, h, safe));
await write("wordmark-dark.png", await wordmark(2400));
await write("wordmark-light.png", await wordmark(2400, true));

console.log("");
