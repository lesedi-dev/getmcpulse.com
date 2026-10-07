---
title: How to monitor an MCP server in production
description: Uptime and an error rate tell you the process is alive. They do not tell you whether the model can use your tools. Here is what to watch, in the order it breaks.
published: 2026-10-07
topic: Measurement
minutes: 6
---

Most MCP servers are monitored the way a web service is: a health check, a log stream, maybe an error rate. That catches the server falling over. It does not catch the failure that actually costs you users, which is a server that is up, answering, returning 200s — and that the model cannot use.

Monitoring an MCP server means watching two things at once. The process, which your existing tools already handle. And the conversation between your tools and a model, which nothing in your stack can see.

## Why the usual signals go quiet

Three properties of the protocol defeat the instincts you bring from HTTP.

**Over stdio there is no request log at all.** The server is a child process of the client, speaking JSON-RPC over a pipe on someone else's machine. Over streamable HTTP there is a request log, but every call is a POST to the same endpoint, and the tool name is inside the body.

**Every failure looks like a success from outside.** The MCP SDK catches whatever your handler throws and returns it as a result with `isError: true`. A crash, a deliberate error and [a set of arguments that failed validation](/blog/bad-args-is-a-schema-problem) all leave the server as the same well-formed response.

**An empty answer is a success by every definition the protocol has.** The model got `[]`, could not use it, and moved on. Nothing anywhere recorded a problem. That is [the failure nobody reports](/blog/empty-results-are-failures).

So the question is not "how do I get logs out of my MCP server". It is which facts about each call are worth recording, and where to record them.

## The five things to watch

In the order they usually break.

### 1. Outcome, split four ways

Every call ends as exactly one of `ok`, `bad_args`, `tool_error` or `crashed`, and the four mean different things:

- `crashed` is a bug list. Any non-zero rate is worth a look.
- `tool_error` is your code reporting a condition on purpose. A steady low rate is healthy.
- `bad_args` is the model failing to fill in your schema — almost always the schema's fault.
- `ok` is not the same as useful. See the next point.

Pooling them into one error rate is the most common monitoring mistake on MCP servers, because the healthy one and the unhealthy ones [cancel each other out](/blog/crashed-vs-tool-error).

### 2. Empty answers

Count every `ok` that returned an empty array, an empty object or an empty string. Above about 5% of a tool's calls, the model is getting nothing back often enough to change how it behaves — and the user sees an assistant that shrugs.

### 3. First-call success

The share of calls where the model asked once, got something usable, and did not have to try again. This is [the grade on your tool descriptions](/blog/first-call-success), and it is the metric that finds the tool that works perfectly when you test it and badly when a model does.

It needs the sequence of calls in a session, so it is computed after the fact rather than as calls land.

### 4. Cost

Two numbers: the schema bytes every session pays before anyone asks a question, and the response bytes per call. Together they are [what a session with your server costs](/blog/cost-per-session). A tool returning 10kb of JSON is [about 2,500 tokens every time it runs](/blog/what-a-heavy-response-costs).

### 5. Dead tools

Tools that are registered, described, charged on every connection, and never called. You only find these by comparing the tool list a server starts with against the calls it actually receives. [Every server has at least one](/blog/dead-tools).

## Keyed by client, not just by tool

Every one of those numbers changes meaning when you split it by the client that made the call. Claude Desktop, Cursor and whatever else connects to you are different models reading the same descriptions, and a tool can be fine in one and broken in another.

A server-wide average hides that completely. Wherever you store these numbers, store the client name with them — the MCP handshake gives you one in `clientInfo.name` on every connection, so there is no excuse not to. [More on why that column matters](/blog/averages-hide-clients).

## Where to measure it

Not from outside. A proxy in front of your server sees the same well-formed responses your access log does, and it [changes your URL and breaks your OAuth](/blog/not-a-proxy) to do it.

The facts above are only all visible from inside the process — specifically, from inside the SDK's tool registry, where a thrown exception can still be told apart from a returned error. That is where instrumentation has to live, and why it has to follow [three non-negotiable rules](/blog/instrumentation-must-never-break-it): never throw, never block, never keep the customer's data.

## Doing it with MCPulse

This is the job MCPulse was built for. One package, wrapped around the server you already built:

```ts
import { watch } from "@mcpulse/sdk";

watch(server, { key: process.env.MCPULSE_KEY });
```

There are packages for [all ten official MCP SDKs](/install). You get the four-way outcome, empty answers, first-call success, cost, dead tools and eleven more, every one of them filterable by client. What leaves your process is sizes and a hash of the arguments — [never the arguments or the results](/blog/what-mcpulse-receives).

If you would rather build it yourself, the list above is the specification. The [live demo](https://app.getmcpulse.com/m/demo) shows what it looks like once it is built.
