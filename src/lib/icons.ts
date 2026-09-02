/**
 * The favicon set, rasterised from the one SVG at build time.
 *
 * ── What was wrong ────────────────────────────────────────────────────────
 * Five things, and only the first is the one people usually find:
 *
 *   1. `public/favicon.ico` was **not an ICO**. It was a 32×32 PNG with the
 *      wrong extension. Browsers sniff the bytes and render it anyway, so it
 *      looked fine everywhere a human checked.
 *   2. It was linked from nowhere. It worked only through the convention that a
 *      browser asks for `/favicon.ico` unprompted.
 *   3. At 32×32 it was under Google's stated requirement of a square icon whose
 *      side is a multiple of 48 — so the one raster we shipped was the wrong
 *      size even before the wrong container.
 *   4. The SVG carries a `viewBox` and no `width`/`height`, so it has no
 *      intrinsic pixel size for anything measuring one.
 *   5. `Organization.logo` in the structured data pointed at that SVG. Google's
 *      logo guidance wants a raster, so the one image we told it was our logo
 *      was the one format it is least likely to take.
 *
 * ── Why generated rather than committed ───────────────────────────────────
 * Because six binaries in `public/` are six things that can silently disagree
 * with the mark. The SVG is the same file the dashboard and the docs ship, and
 * every size here is rasterised from it on each build, so redrawing the logo
 * cannot leave a stale 192px PNG behind.
 *
 * Astro serves these from static endpoints, so the paths are stable and
 * unhashed across deploys — which favicons need, because a crawler that cached
 * `/favicon.ico` will come back to exactly that URL.
 */

import sharp from "sharp";
/**
 * The mark, inlined by Vite at build time.
 *
 * `?raw` rather than `readFileSync(new URL(..., import.meta.url))`, which is
 * what this was and which broke the build: Astro bundles this module into
 * `dist/.prerender/`, so `import.meta.url` points there and a path relative to
 * `src/lib/` resolves to `dist/public/favicon.svg`, which has never existed.
 *
 * The `?raw` form has no filesystem in it at all — the file's contents become a
 * string constant in the bundle — so it cannot depend on where the bundle ends
 * up. It is still the same `public/favicon.svg` the dashboard and docs ship, so
 * the single-source-of-truth property is unchanged.
 */
import SOURCE from "../../public/favicon.svg?raw";

/**
 * Rasterise at a given size.
 *
 * `width`/`height` are injected rather than left to a density guess: librsvg
 * scales a `viewBox`-only SVG from an assumed 96 DPI, which turns a 32-unit
 * drawing into a blurry upscale at 192px. Telling it the output size makes it
 * draw at that size instead.
 */
export async function iconPng(size: number): Promise<Buffer> {
  // Any existing width/height comes off first. Prepending without stripping is
  // what the first version did, and since the source SVG now declares 32×32 of
  // its own, that produced `<svg width="180" ... width="32">` — which librsvg
  // rejects outright as "Attribute height redefined" rather than ignoring.
  const sized = SOURCE.replace(
    /<svg\b([^>]*)>/,
    (_match, attrs: string) =>
      `<svg${attrs.replace(/\s*(?:width|height)="[^"]*"/g, "")} width="${size}" height="${size}">`,
  );

  return sharp(Buffer.from(sized)).png({ compressionLevel: 9 }).toBuffer();
}

/**
 * A real `.ico`, assembled by hand.
 *
 * `sharp` cannot write ICO, and the format does not need it to: since Vista an
 * icon directory entry may point at a whole PNG rather than a BMP, so the file
 * is a 6-byte header, a 16-byte entry per image, and the PNGs themselves.
 *
 * 16, 32 and 48 because that is what actually gets asked for — 16 in a tab, 32
 * on a high-density tab and in a bookmark bar, 48 for Windows shortcuts and as
 * the smallest size Google names.
 */
export async function faviconIco(): Promise<Buffer> {
  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map((size) => iconPng(size)));

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + sizes.length * 16;
  const entries = sizes.map((size, i) => {
    const entry = Buffer.alloc(16);
    // 0 means 256 in this field; none of our sizes need that, but the encoding
    // is why the byte is written rather than assigned directly.
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette size — 0 for truecolour
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(images[i].length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += images[i].length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images]);
}

/**
 * The PNGs the head declares.
 *
 * 96 and 192 are both multiples of 48, which is Google's stated requirement.
 * 180 is Apple's size for a home-screen icon and is served at its own
 * conventional path, because Safari looks for `/apple-touch-icon.png` by name
 * whether or not the page links it.
 */
export const ICON_SIZES = [96, 192] as const;
export const APPLE_TOUCH_SIZE = 180;
