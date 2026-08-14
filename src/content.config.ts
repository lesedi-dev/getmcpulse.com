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
  }),
});

export const collections = { blog };
