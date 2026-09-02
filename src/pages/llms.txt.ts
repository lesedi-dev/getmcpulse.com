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
import { publishedPosts } from "../lib/posts";
import { SITE, NAV } from "../lib/site";

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL(SITE.url ?? "https://getmcpulse.com")).origin;
  const url = (path: string) => `${origin}${path}`;

  const posts = await publishedPosts();

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
  /**
   * Every page, described once.
   *
   * ── The order, and why it is not just `NAV` ───────────────────────────────
   * `NAV` is an editorial selection: four questions somebody asks while
   * deciding, chosen to fit a header. That is right for a menu and wrong here —
   * a model asking "what is on this site" should be told everything, including
   * the pages the header leaves out.
   *
   * ── Why it is deduplicated ────────────────────────────────────────────────
   * Because it silently was not, and the file shipped with "Schema checker"
   * listed twice: once written out with a note, once again from `NAV`, which
   * still contains it. Spreading a curated list into a generated one is exactly
   * the shape that produces that, and the failure is invisible — nothing throws,
   * the file is still valid, it just repeats itself to every model that reads it.
   *
   * A described entry always wins over a bare one, whichever came first, so
   * moving a page in or out of `NAV` cannot change what this file says about it.
   */
  const described = [
    { href: "/", label: "Home", note: SITE.description },
    {
      href: "/check",
      label: "Schema checker",
      note: "Paste a tools/list response and score it against 4,749 public servers — undescribed parameters, description collisions, schema token cost. Runs client-side; nothing is uploaded.",
    },
    {
      href: "/how-it-works",
      label: "How it works",
      note: "An npm package inside your own server rather than a proxy in front of it. What leaves the process, the four outcomes of a call, and what MCPulse cannot see.",
    },
    {
      href: "/metrics",
      label: "Metrics",
      note: "All sixteen metrics, what each one tells you, and which are counted live versus computed on the nightly pass.",
    },
    {
      href: "/install",
      label: "Installation",
      note: "Two lines for TypeScript. All ten official MCP SDKs listed, with the nine not ready yet marked coming soon rather than hidden.",
    },
    {
      href: "/pricing",
      label: "Pricing",
      note: "Free for one server, $49 a month for a server people depend on. Recording stops at the cap rather than billing past it.",
    },
    {
      href: "/faq",
      label: "Questions",
      note: "What leaves your process, whether it can slow your tools down, which languages are supported today, and what happens at the plan cap.",
    },
    {
      href: "/blog",
      label: "Blog",
      // Counted, not written down. It said "twenty-one" and three posts later
      // it was wrong — a hardcoded count is a fact with an expiry date on it.
      note: `${posts.length} essays on measuring MCP servers, and on the schemas models read before they call anything.`,
    },
  ];

  const seen = new Set(described.map((page) => page.href));

  const pages = [
    ...described,
    // Anything in the header this file has not described yet — so a page added
    // to `NAV` appears here without anyone remembering, rather than silently not.
    ...NAV.filter((item) => !seen.has(item.href)).map((item) => ({
      href: item.href,
      label: item.label,
      note: "",
    })),
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
