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

  /**
   * Syntax highlighting in the site's own palette, in both themes.
   *
   * Astro's default Shiki theme is `github-dark`, and a Shiki theme is
   * **inline styles**: every highlighted block carried
   * `background-color:#24292e` on the `<pre>` and a hex on every token. Inline
   * styles outrank a stylesheet, so `.prose pre` in the post layout — border,
   * radius, the themed surface — was overridden on all thirteen posts that
   * contain a code block, whichever theme the reader had chosen. A light-mode
   * reader got a slab of GitHub's dark grey in the middle of a white page,
   * and the plain fenced blocks beside it stayed in the site's palette, so
   * one post could show two different kinds of code block.
   *
   * `css-variables` makes Shiki emit `var(--astro-code-*)` instead of hexes.
   * Those are defined once per theme in `global.css` next to every other
   * colour, so code follows light and dark like the rest of the page and the
   * `<pre>` keeps the surface the layout gives it.
   */
  markdown: {
    shikiConfig: { theme: "css-variables", wrap: false },
  },

  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
  // "auto" inlines only what is small enough to be worth it. Inlining
  // everything put a full copy of the stylesheet in all 23 pages, so a reader
  // moving from one post to the next re-downloaded CSS they already had.
  build: { inlineStylesheets: "auto" },
  compressHTML: true,
});
