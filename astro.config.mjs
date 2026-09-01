// @ts-check
import { readFileSync, readdirSync } from "node:fs";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

/**
 * `lastmod` for the posts, read from the front matter they already carry.
 *
 * The sitemap integration can stamp one date across every URL, which is worse
 * than no date at all: Google leans on `lastmod` only where it has found it to
 * be honest, and twenty-eight pages all claiming to have changed on deploy day
 * is exactly the pattern that teaches it to stop reading the field. A post's
 * `published` is a real date and the only one this repo actually knows.
 *
 * Read with a regex rather than the content collections API because this runs
 * while the config is being evaluated, before `astro:content` exists. It reads
 * one line out of files this same build is about to parse properly, so a
 * malformed date shows up as a missing `lastmod` here and a schema error there
 * — never as a wrong date in the sitemap.
 */
const POSTS_DIR = new URL("./src/content/blog/", import.meta.url);

/** Computed once. `serialize` is called per URL and this reads the whole blog. */
const POST_DATES = (() => {
  const dates = new Map();

  for (const file of readdirSync(POSTS_DIR)) {
    if (!file.endsWith(".md")) continue;

    const front = readFileSync(new URL(file, POSTS_DIR), "utf8").slice(0, 1500);
    const published = /^published:\s*["']?(\d{4}-\d{2}-\d{2})/m.exec(front)?.[1];
    // Keyed without a trailing slash, matching `trailingSlash: "never"` — this
    // is compared against the pathname of a URL the sitemap has already built.
    if (published) dates.set(`/blog/${file.replace(/\.md$/, "")}`, published);
  }

  return dates;
})();

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
   * No trailing slash — the same answer `vercel.json` already gives.
   *
   * `vercel.json` sets `cleanUrls: true` and `trailingSlash: false`, so the
   * host serves this site at `/blog/dead-tools` and 308-redirects
   * `/blog/dead-tools/` to it. Astro's default is the opposite: `directory`
   * output makes `Astro.url.pathname` end in a slash, and that value is what
   * builds every canonical tag, every `og:url` and every entry in the sitemap.
   *
   * So every canonical tag on this site pointed at a URL that redirected, and
   * the sitemap listed twenty-seven of them. Google follows the redirect and
   * usually forgives it, but a canonical that is not itself the final URL is a
   * page telling a crawler two different things about where it lives, and
   * Search Console files the sitemap entries under "Page with redirect" rather
   * than indexing them.
   *
   * `never` makes Astro agree with the host. The files on disk are unchanged —
   * `build.format` is still `directory`, which is what `cleanUrls` expects; it
   * is only the URLs the site *claims* that move.
   */
  trailingSlash: "never",

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

  integrations: [
    sitemap({
      /**
       * `serialize` runs per URL. Pages with no date we know get no `lastmod`,
       * which is the correct thing to say — the field is optional, and omitting
       * it is a crawler's cue to decide for itself rather than a claim that
       * turns out to be false.
       */
      serialize(item) {
        const date = POST_DATES.get(new URL(item.url).pathname.replace(/\/+$/, ""));
        return date ? { ...item, lastmod: `${date}T00:00:00+00:00` } : item;
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
  // "auto" inlines only what is small enough to be worth it. Inlining
  // everything put a full copy of the stylesheet in all 23 pages, so a reader
  // moving from one post to the next re-downloaded CSS they already had.
  build: { inlineStylesheets: "auto" },
  compressHTML: true,
});
