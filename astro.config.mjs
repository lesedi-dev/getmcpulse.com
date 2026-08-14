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
/**
 * Where this site claims to live.
 *
 * `site` is not decoration: every canonical tag, every `og:url` and the whole
 * sitemap are built from it. It was hardcoded to `mcpulse.dev` — a domain
 * nobody here owns — so every page was telling search engines that the real
 * version of itself lived on somebody else's property. That is worse than
 * having no canonical at all.
 *
 * There is no custom domain yet, so the honest answer is wherever this is
 * actually deployed. Vercel sets `VERCEL_PROJECT_PRODUCTION_URL` at build time
 * to the production host, which is true on any given build without anyone
 * maintaining it. The day a domain exists, set `SITE_URL` and nothing else
 * changes.
 */
const site =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:4321");

export default defineConfig({
  site,
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
  // "auto" inlines only what is small enough to be worth it. Inlining
  // everything put a full copy of the stylesheet in all 23 pages, so a reader
  // moving from one post to the next re-downloaded CSS they already had.
  build: { inlineStylesheets: "auto" },
  compressHTML: true,
});
