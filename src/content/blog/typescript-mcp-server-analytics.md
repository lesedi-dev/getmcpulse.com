---
title: Adding analytics to a TypeScript MCP server
description: One import and one wrap, after your tools are registered. Where the wrap goes on a stdio server, where it goes on a streamable-HTTP one, and why those differ.
published: 2026-10-07
topic: Engineering
minutes: 4
---

If your MCP server is built on the official TypeScript SDK, analytics is one install and two lines.

```bash
npm install @mcpulse/sdk
```

The only thing that varies is *where* the second line goes, and that depends on your transport.

## Over stdio

A stdio server builds one `McpServer` and keeps it for the life of the process. Wrap it once, after your tools are registered:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { watch } from "@mcpulse/sdk";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

// … your registerTool calls …

watch(server, { key: process.env.MCPULSE_KEY });

await server.connect(new StdioServerTransport());
```

After registration matters: the startup payload reports the tool list as it stands when `watch` runs, and that list is what [dead-tool detection](/blog/dead-tools) and schema cost are computed from.

## Over streamable HTTP

A streamable-HTTP server usually builds a fresh `McpServer` per request, so there is no long-lived instance to wrap. Wrap inside the factory instead, beside the registration:

```ts
function createServer() {
  const server = new McpServer({ name: "my-server", version: "1.0.0" });

  // … your registerTool calls …

  return watch(server, { key: process.env.MCPULSE_KEY });
}
```

Calling `watch` on every request is expected, and cheap. The session and its buffer are shared for the life of the process, so your calls are grouped into one session rather than scattered one per request — which is what keeps retries and [first-call success](/blog/first-call-success) meaningful.

## It hands back the same server

`watch` returns the object you passed in, instrumented in place. Nothing downstream needs to know it happened, and nothing about how your server is reached changes: same URL, same auth, same deployment. It is a package in your process, [not a proxy in front of it](/blog/not-a-proxy).

If the SDK internals are not the shape it expects — a major version moved something — nothing is patched, and your server is handed back exactly as it arrived, running without analytics. [Breaking the server it measures is the one thing it must never do](/blog/instrumentation-must-never-break-it).

## How it tells a crash from an error

`McpServer` catches whatever your handler throws and turns it into a result with `isError: true`, so from the request handler a bug and a deliberate error look the same.

So the package wraps each tool callback as well as the request. When your handler throws, the wrapper sees it first, records `crashed`, and rethrows, so the SDK's own handling carries on unchanged. An `AsyncLocalStorage` context ties that back to the outgoing response, and concurrent calls cannot cross-contaminate. [The long version is here](/blog/crashed-vs-tool-error).

TypeScript is one of the SDKs where `bad_args` is visible too, because validation failures can be seen at the request layer before your callback would have run.

## Two options

| Option | Default | |
|---|---|---|
| `key` | — | The ingest key. Without one, the SDK does nothing. |
| `debug` | `false` | Logs what is sent, to stderr. |

That is deliberately the whole surface. Every option is another path through code running in your production server, so there is no sampling rate, no custom transport and no hook to enrich payloads.

`debug` writes to **stderr**, never stdout, because stdout is the transport on a stdio server and one stray line there disconnects the client. The SDK has no runtime dependencies, so it brings nothing else into your tree to audit.

## Then restart

The tool list arrives as soon as the server boots, and per-call numbers fill in with traffic. [Here is the order to read them in](/blog/mcp-server-analytics-first-week).
