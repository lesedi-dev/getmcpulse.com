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
  url: "https://mcpulse.dev",
  app: "https://mcpulse-eta.vercel.app",
  npm: "https://www.npmjs.com/package/@mcpulse/sdk",
  github: "https://github.com/mcpulse",
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
  { href: "/blog", label: "Blog" },
] as const;

/** The install steps, matching `install_snippets.ts` in the dashboard exactly. */
export const INSTALL_COMMAND = "npm install @mcpulse/sdk";

export const WRAP_SNIPPET = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { watch } from "@mcpulse/sdk";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

// … your registerTool calls …

watch(server, { key: process.env.MCPULSE_KEY });`;
