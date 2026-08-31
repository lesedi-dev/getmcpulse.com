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
 * The domain now exists and it is `getmcpulse.com`, so that is the default
 * rather than a guess at whichever host this build landed on. `SITE_URL` still
 * overrides it, which is what a preview deployment wants.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` is gone with it. It resolved to
 * `mcpulse-eta.vercel.app` on a production build, and a deploy host that
 * out-ranks the real domain in every canonical tag is the same bug this comment
 * was written about, pointed at a different stranger.
 */
const site = process.env.SITE_URL ?? "https://getmcpulse.com";

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
