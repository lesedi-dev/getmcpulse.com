import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";
import { SITE } from "../lib/site";

export async function GET(context: APIContext) {
  const posts = (await getCollection("blog")).sort(
    (a, b) => b.data.published.valueOf() - a.data.published.valueOf(),
  );

  return rss({
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    site: context.site ?? SITE.url,
    /**
     * `@astrojs/rss` appends a trailing slash to every `link` unless told not
     * to — it does not read `trailingSlash` from the Astro config — so setting
     * the path without one here is not enough on its own.
     */
    trailingSlash: false,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.published,
      categories: [post.data.topic],
      // No trailing slash, matching `trailingSlash: "never"` and so the
      // canonical tag on the page this points at. A feed reader following a
      // link that redirects is the same inconsistency, one hop further out.
      link: `/blog/${post.id}`,
    })),
  });
}
