import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
// Straight from zod rather than the `astro:content` re-export, which is
// deprecated in Astro 7.
import { z } from "zod";

/**
 * The blog.
 *
 * `topic` is a closed set rather than free text — the index groups by it, and
 * a typo in front matter would otherwise create a fourth topic silently.
 */
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.coerce.date(),
    topic: z.enum(["Measurement", "Tool design", "Engineering", "Privacy"]),
    /** Minutes. Written down rather than counted, so it matches the edit. */
    minutes: z.number().int().positive(),
    /**
     * Written, not published.
     *
     * A draft is excluded from the index, the feed, the sitemap, `llms.txt` and
     * the share-card build — everywhere a post is *discovered*. Its own URL
     * still renders, because a private link is how a draft gets reviewed.
     *
     * This exists for the post about the registry stripping `required`: it is a
     * bug report about somebody else's product, and it should not be findable
     * before they have been told. Writing it and remembering not to deploy is
     * not a mechanism; a flag is.
     */
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
