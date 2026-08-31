/**
 * Everything the site states about itself, in one file.
 *
 * The nav, the footer, the OG tags and the JSON-LD all read from here, so the
 * product's name and pitch have one spelling rather than six that drift.
 */

export const SITE = {
  name: "MCPulse",
  tagline: "Analytics for MCP servers",
  description:
    "See whether your MCP tools actually work for the models calling them — retries, empty answers, schema cost and first-call success. Two lines to install.",
  /**
   * Read from Astro's own `site` rather than restated here.
   *
   * These were two hardcoded copies of one fact, and the JSON-LD copy is the
   * kind that rots quietly — nothing renders differently when it is wrong.
   * `import.meta.env.SITE` is whatever `astro.config.mjs` resolved, so the
   * structured data and the canonical tag cannot disagree.
   */
  url: import.meta.env.SITE,
  app: "https://app.getmcpulse.com",
  npm: "https://www.npmjs.com/package/@mcpulse/sdk",

  /**
   * The GitHub *organisation*, which is `getmcpulse`.
   *
   * This said `github.com/mcpulse`, and that account belongs to somebody else —
   * a user, no repositories, registered in 2024. Every "GitHub" link on this
   * site pointed a reader at a stranger's empty profile. It is exactly the trap
   * CLAUDE.md already records for npm ("`mcpulse` on npm is **not** ours"),
   * which is why the packages are scoped and the org is prefixed; the website
   * was the one place that had not caught up.
   */
  github: "https://github.com/getmcpulse",

  /**
   * The documentation, on our own domain now that there is one.
   *
   * Still deliberately **not** `docs.mcpulse.com`, which is where this nearly
   * went and which the docs repo is unhelpfully still named after. That
   * hostname answers 200 — what makes it dangerous rather than obviously broken
   * — and what it serves is HugeDomains' "McPulse.com is for sale" page.
   * `mcpulse.com` is not ours; `getmcpulse.com` is.
   *
   * Being one constant is what made the move a single line here rather than a
   * search across the site, the skills repo and the docs themselves.
   */
  docs: "https://docs.getmcpulse.com",

  /** The agent skill: a workflow guide to pair with the MCP connector. */
  skills: "https://github.com/getmcpulse/skills",
} as const;

/**
 * Real pages, not anchors on the home page.
 *
 * Every one of these used to be a `/#section` jump, which meant the menu could
 * only ever scroll you into the middle of one long document — and the whole
 * menu became inert once you were reading a post. As pages they have their own
 * URL, their own title, and room to say more than a landing section can.
 */
export const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/metrics", label: "Metrics" },
  { href: "/install", label: "Install" },
  /**
   * Pricing, where Docs used to sit.
   *
   * Docs left the menu. It was the one item that took a reader off the site
   * entirely, and it was answering a question nobody asks before they have
   * decided: a reference is what you want *after* you have installed something,
   * which is why it stayed one click away in the footer rather than in the
   * header beside four pages about whether to bother.
   *
   * Pricing is the question they do ask, and it had no answer anywhere on this
   * site — which for a product that now takes money is worse than a bad price.
   *
   * The order is still the reading order: what it is, what it measures, how to
   * fit it, what it costs, then why it thinks what it thinks.
   */
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
] as const;

/** The install steps, matching `install_snippets.ts` in the dashboard exactly. */
export const INSTALL_COMMAND = "npm install @mcpulse/sdk";

export const WRAP_SNIPPET = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { watch } from "@mcpulse/sdk";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

// … your registerTool calls …

watch(server, { key: process.env.MCPULSE_KEY });`;
