/**
 * `/robots.txt`, built from `site` rather than typed out.
 *
 * A hand-written file in `public/` has to repeat the domain, and a `Sitemap:`
 * line pointing at a host this build is not serving from is worse than no line
 * at all — it is the same class of bug as the canonical tag that used to claim
 * `mcpulse.dev`. Generating it means `SITE_URL` moves the sitemap reference
 * with everything else, and a preview deploy advertises its own sitemap.
 *
 * ── What is deliberately *not* here ────────────────────────────────────────
 * No `Disallow: /og/`. The share cards live under that path, and the crawlers
 * that fetch `og:image` — Facebook's, Slack's, LinkedIn's — read this file
 * first and honour it. Disallowing the directory would have left every shared
 * link showing the blank grey box the cards were added to fix, which is a
 * failure that looks like nothing being wrong.
 *
 * No `Crawl-delay`. Google ignores it, and this is twenty-eight static
 * documents on a CDN.
 */

import type { APIRoute } from "astro";
import { SITE } from "../lib/site";

export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL(SITE.url ?? "https://getmcpulse.com")).origin;

  const body = `# Everything here is meant to be read — by people, crawlers and models alike.
User-agent: *
Allow: /

Sitemap: ${origin}/sitemap-index.xml
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
