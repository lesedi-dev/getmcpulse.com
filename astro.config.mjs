// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

/**
 * Static output, no adapter, no framework islands.
 *
 * Every page here is a document. The only JavaScript that ships is the handful
 * of lines that drive the install sequence and the scroll reveals, inlined by
 * Astro rather than pulled from a bundle — a marketing site that ships a
 * runtime to render text is the thing this product is arguing against.
 */
export default defineConfig({
  site: "https://mcpulse.dev",
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
  // "auto" inlines only what is small enough to be worth it. Inlining
  // everything put a full copy of the stylesheet in all 23 pages, so a reader
  // moving from one post to the next re-downloaded CSS they already had.
  build: { inlineStylesheets: "auto" },
  compressHTML: true,
});
