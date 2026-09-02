import { getCollection, type CollectionEntry } from "astro:content";

/**
 * The published posts, newest first.
 *
 * ── Why this is a function and not six calls to `getCollection` ───────────
 * Six places listed the blog — the index, the feed, `llms.txt`, the share-card
 * build, the related-posts row and `getStaticPaths` — and every one of them
 * called `getCollection("blog")` directly. Adding a `draft` flag would have
 * meant remembering to filter in all six, and the failure mode of forgetting
 * one is the worst possible: the draft stays out of the index and appears in
 * the sitemap, so the only place it shows up is a search engine.
 *
 * So the filter lives here and the call sites read from it. `getStaticPaths` is
 * the deliberate exception below.
 */
export async function publishedPosts(): Promise<CollectionEntry<"blog">[]> {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf());
}

/**
 * Every post including drafts, for route generation only.
 *
 * A draft still needs a URL — that is how it gets read and reviewed before it
 * goes out. What it must not have is a way to be *found*: no index entry, no
 * feed item, no sitemap line, no share card. `Base.astro` gives it a `noindex`
 * so a crawler that is handed the link anyway does not keep it.
 */
export async function allPosts(): Promise<CollectionEntry<"blog">[]> {
  const posts = await getCollection("blog");
  return posts.sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf());
}
