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

  /** Creates an account. Every "Sign up — free" button on the site. */
  signup: "https://app.getmcpulse.com/signup",
  /** For somebody who already has one. Every "Sign in" link. */
  login: "https://app.getmcpulse.com/login",
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
  /**
   * The checker, first.
   *
   * It is the only item in this row that is a *tool* rather than a page about
   * us, and the only one somebody gets something from without an account, an
   * install or a price. First because the row is read left to right and this is
   * the cheapest thing in it to say yes to.
   *
   * It is deliberately not last. After "Pricing" it reads as an afterthought,
   * and the reader who would most use it — somebody who has just been told a
   * sixth of public tools cannot be told apart — has already decided by then.
   */
  { href: "/check", label: "Schema checker" },
  { href: "/how-it-works", label: "How it works" },
  /**
   * Metrics is **not** here, and it used to be.
   *
   * Four things decided it. The row had five links and two actions and only fit
   * from 1024px, so something had to give. The home page now carries the same
   * material in its own section — sixteen metrics, and the tool table above it.
   * And of the five, this was the only one answering "what will I see once I
   * care", which is a question asked after the decision rather than during it:
   * the same argument that put Docs in the footer.
   *
   * The fourth is the one that made it safe. `/metrics` had no link anywhere
   * except this row and the footer — not even from the home page's own metrics
   * section. Dropping it from the nav without fixing that would have left a
   * 1,083-word page reachable only from the footer, so the home section now
   * links to it directly, which is a better entry point than a nav slot: the
   * reader arrives already interested rather than browsing.
   */
  /**
   * "Installation", not "Install".
   *
   * The others are all nouns — a thing to go and read. "Install" is a verb, and
   * next to four nouns it reads as a button that will do something rather than
   * a page that will explain something. It is also no longer only the
   * TypeScript steps: the page opens on ten languages, and the honest name for
   * a page answering "is there one for me" is the subject, not the command.
   *
   * The path stays `/install`. A URL is not copy — it is linked from
   * `llms.txt`, from the footer and from anywhere a reader has bookmarked it,
   * and renaming it to match a menu label would break all three to fix nothing.
   */
  { href: "/install", label: "Installation" },
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
   * The order is the reading order: what it is, what it measures, how to fit
   * it, then what it costs.
   */
  { href: "/pricing", label: "Pricing" },
  /**
   * Blog is **not** here, and the writing is not gone with it.
   *
   * It left for the same reason Docs did, one step further along: the menu is
   * the questions somebody asks while deciding whether to bother, and twenty
   * essays on retry semantics is not one of them.
   *
   * The width argument that used to be here — "five links and a button is
   * where the header stops fitting a small laptop" — was an estimate, and it
   * was wrong. Five fit, with 16px to spare at 768px; the measurement is in
   * `Nav.astro`. Blog stays out on the editorial argument alone, which is the
   * stronger of the two anyway.
   *
   * It keeps its own column in the footer, with the two posts worth starting
   * on and the feed, which is where someone who has finished deciding goes
   * looking. Every post also links two more at its foot, so the blog is
   * navigable from inside itself rather than only from the chrome.
   */
] as const;

/**
 * What the buttons say. One label, in one place.
 *
 * ── Why this is a constant ────────────────────────────────────────────────
 * There were five labels for the same action: "Sign up — free" in the header,
 * "Start measuring — free" in twenty-five body CTAs, "Start measuring" on the
 * free plan card, and "Start measuring — free →" on the checker. All four went
 * to the same URL and did the same thing. On the home page a visitor met three
 * of them, which reads as three different offers rather than one.
 *
 * ── Why this wording ─────────────────────────────────────────────────────
 * "Sign up — free", chosen deliberately over "Start measuring — free".
 *
 * "Start measuring" was the incumbent on twenty-five of thirty pages and is the
 * better *copy* — it names what happens next rather than the form in the way of
 * it. It loses anyway, because next to "Sign in" the pair has a job that copy
 * does not: a visitor scanning a header is looking for the two words they have
 * looked for on every other site, and making them read a sentence to find out
 * which one creates an account is a cost paid by every first-time visitor to
 * save a cliché.
 *
 * "— free" carries the part that actually persuades, and it is true: there is a
 * free tier rather than a trial, so nothing expires.
 *
 * **To change it, change it here.** One edit moves every button on the site.
 */
export const CTA = {
  /** Creates an account. Every button that does this says exactly this. */
  primary: "Sign up — free",
  /** For somebody who already has one. */
  signin: "Sign in",
} as const;

/** The install steps, matching `install_snippets.ts` in the dashboard exactly. */
export const INSTALL_COMMAND = "npm install @mcpulse/sdk";

export const WRAP_SNIPPET = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { watch } from "@mcpulse/sdk";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

// … your registerTool calls …

watch(server, { key: process.env.MCPULSE_KEY });`;
