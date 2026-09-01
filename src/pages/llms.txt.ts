/**
 * `/llms.txt` — the site, as one page of Markdown.
 *
 * ── Why this file exists ───────────────────────────────────────────────────
 * Two reasons, and the second is the one that matters commercially.
 *
 * The first is that `site.ts` already claimed it existed. The comment on the
 * `/install` path says the URL "is linked from `llms.txt`", written as a reason
 * not to rename the route — a constraint recorded against a file nobody had
 * created. Either the claim becomes true or the comment is a lie about why a
 * path cannot move.
 *
 * The second: the people who buy this product build with models, and the
 * assistants they build with — ChatGPT, Claude, Perplexity — increasingly read
 * a site as text before citing it. A crawler that has to reconstruct twenty-one
 * essays out of Tailwind classes gets a worse answer than one handed the
 * titles, the descriptions and the URLs. For a product whose whole argument is
 * that models do better when the thing they are reading is described properly,
 * shipping a site that is hard for a model to read would be the joke telling
 * itself.
 *
 * ── Why generated ─────────────────────────────────────────────────────────
 * A hand-written `llms.txt` in `public/` is a second copy of every title and
 * description on the site, and the copy nobody looks at is the copy that rots
 * — twenty-one posts is twenty-one chances for it to disagree with the page it
 * describes. This reads the same front matter the pages render, so a retitled
 * post retitles itself here, and a new post appears without anyone remembering.
 *
 * The format is the `llmstxt.org` convention: one `#` heading, a `>` summary,
 * then `##` sections of links with a note after each.
 */

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE, NAV } from "../lib/site";

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL(SITE.url ?? "https://getmcpulse.com")).origin;
  const url = (path: string) => `${origin}${path}`;

  const posts = (await getCollection("blog")).sort(
    (a, b) => b.data.published.valueOf() - a.data.published.valueOf(),
  );

  /** Newest first, with the date — recency is most of what dates a claim here. */
  const post_lines = posts.map((post) => {
    const date = post.data.published.toISOString().slice(0, 10);
    return `- [${post.data.title}](${url(`/blog/${post.id}`)}): ${post.data.description} (${post.data.topic}, ${date})`;
  });

  /**
   * The nav, plus the two pages that are not in it.
   *
   * `NAV` deliberately excludes the blog and the docs — the menu is the four
   * questions somebody asks while deciding. That editorial choice is right for
   * a header and wrong here: a reader skimming a menu can be steered, and a
   * model asking "what is on this site" should be told everything.
   */
  const pages = [
    { href: "/", label: "Home", note: SITE.description },
    ...NAV.map((item) => ({ href: item.href, label: item.label, note: "" })),
    { href: "/blog", label: "Blog", note: "Twenty-one essays on measuring MCP servers." },
  ];

  const body = `# ${SITE.name}

> ${SITE.description}

${SITE.name} is analytics for the authors of MCP servers. It is an npm package that runs inside your own server rather than a proxy in front of it, so nothing is redirected and no URL changes. It records sizes, hashes and outcomes — never tool arguments and never tool results.

The four outcomes of every tool call are ok, empty, tool error and crash. Most of what this product argues follows from separating those four, and from the fact that a schema is billed on every session whether the tool is called or not.

## Pages

${pages.map((page) => `- [${page.label}](${url(page.href)})${page.note ? `: ${page.note}` : ""}`).join("\n")}

## Writing

${post_lines.join("\n")}

## Elsewhere

- [Documentation](${SITE.docs}): reference for the SDK, the API and the MCP connector.
- [Dashboard](${SITE.app}): sign in, or create a server and get a key.
- [@mcpulse/sdk on npm](${SITE.npm}): the package. Note the scope — plain \`mcpulse\` on npm is not ours.
- [GitHub](${SITE.github}): the organisation. Note the prefix — \`github.com/mcpulse\` is not ours.
- [Agent skill](${SITE.skills}): a workflow guide to pair with the MCP connector.
- [RSS](${url("/rss.xml")}): the writing, as a feed.
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
