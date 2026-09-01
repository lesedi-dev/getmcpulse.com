/**
 * Structured-data nodes, built rather than typed out.
 *
 * `Base.astro` owns the graph and the publisher; this file owns the shapes that
 * more than one page needs. The reason it is a function and not a block of
 * literal JSON in each page is that every URL in structured data must be
 * absolute and must match the canonical tag exactly — a trailing slash on one
 * and not the other is enough for Google to treat them as two pages. Passing
 * `Astro.site` in once means the two cannot drift.
 */

import { SITE } from "./site";

const base = (site: URL | undefined) => site ?? new URL(SITE.url ?? "https://getmcpulse.com");

/**
 * Absolute, and spelled the way the canonical tag spells it.
 *
 * Every URL in structured data has to match the canonical tag exactly. One
 * character of difference — a trailing slash on one and not the other — and
 * Google has two pages rather than one, and the `@id` stops resolving to the
 * thing it is meant to identify.
 *
 * `trailingSlash: "never"` in `astro.config.mjs` is the convention, chosen to
 * match `vercel.json`, and this strips to it. Callers pass whatever reads well
 * — `"/blog"`, or `Astro.url.pathname`, which carries no slash but might one
 * day — and get back the one spelling. The root is the exception: `/` is the
 * whole path, not a trailing separator.
 */
const abs = (site: URL | undefined, path: string) => {
  const normalised = path === "/" ? "/" : path.replace(/\/+$/, "");
  return new URL(normalised, base(site)).href;
};

/**
 * A breadcrumb trail.
 *
 * This is what turns the grey URL under a search result into
 * "MCPulse › Blog › Dead tools". It is also the only signal that tells Google
 * these twenty-two posts sit under `/blog` rather than being twenty-two
 * unrelated pages — nothing in the markup says so, because the blog left the
 * header and a post's only link upward is in its own footer.
 */
export function breadcrumbs(site: URL | undefined, trail: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: abs(site, step.path),
    })),
  };
}

/** One blog post. `dateModified` falls back to publication, never to today. */
export function article(
  site: URL | undefined,
  post: {
    path: string;
    title: string;
    description: string;
    published: Date;
    updated?: Date;
    topic: string;
    minutes: number;
  },
) {
  const url = abs(site, post.path);

  return {
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: post.title,
    description: post.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: post.published.toISOString(),
    dateModified: (post.updated ?? post.published).toISOString(),
    articleSection: post.topic,
    image: abs(site, `/og${post.path}.png`),
    inLanguage: "en-GB",
    /**
     * Both roles are the organisation, and that is the honest answer.
     *
     * These posts are unsigned — no byline on the page, no author in the front
     * matter — and inventing a `Person` here to satisfy a rich-result checklist
     * would be structured data that contradicts the page it describes.
     */
    author: { "@id": `${SITE.url}/#organization` },
    publisher: { "@id": `${SITE.url}/#organization` },
    /** Google reads this for the "N min read" label. */
    timeRequired: `PT${post.minutes}M`,
  };
}

/** A page that is a document rather than the product: how it works, metrics. */
export function webPage(
  site: URL | undefined,
  page: { path: string; title: string; description: string },
) {
  const url = abs(site, page.path);

  return {
    "@type": "WebPage",
    "@id": url,
    name: page.title,
    description: page.description,
    url,
    inLanguage: "en-GB",
    isPartOf: { "@id": `${SITE.url}/#website` },
    publisher: { "@id": `${SITE.url}/#organization` },
  };
}

/** The site itself. Stated once, on the home page, and referenced elsewhere. */
export function website(site: URL | undefined) {
  return {
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    name: SITE.name,
    description: SITE.description,
    url: abs(site, "/"),
    inLanguage: "en-GB",
    publisher: { "@id": `${SITE.url}/#organization` },
  };
}
