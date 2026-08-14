---
title: Instrumentation must never break the thing it measures
description: The SDK runs inside someone else's production server. Three rules follow from that, and none of them are negotiable — including handing the server back unmodified.
published: 2026-04-21
topic: Engineering
minutes: 5
---

`@mcpulse/sdk` runs inside a customer's MCP server, in the same process, on the same call path as their tools. It patches request handlers on a live object.

That is a lot of trust for an analytics package. Three rules make it defensible.

## Never throw

Every entry point is wrapped in a `try/catch` that swallows.

If MCPulse throws inside a tool call, the customer's tool fails. Their user sees an error, they investigate their own code, and eventually discover the monitoring package broke the thing it was monitoring. That is the single worst outcome available to us, and it is worse than collecting nothing at all.

So: recording failures are caught and dropped. Serialisation failures are caught and dropped. A malformed result that breaks the empty check is caught and dropped. The measurement is lost; the call is untouched.

The strongest form of this rule is at attach time. `watch()` inspects the server's internals to patch them. If those internals are not the shape expected — because the MCP SDK changed, or the object is a wrapper, or a version moved something — nothing is patched and your server is handed back exactly as it arrived. It runs without analytics.

A monitoring package that breaks servers on a minor version bump has destroyed more value than every metric it ever collected.

## Never block

Record, buffer, return. Nothing awaits the network on the path a model is waiting on.

A call writes into an in-memory array and the function returns. The array flushes at 30 items or 5 seconds, whichever comes first, on its own. If the network is slow, the flush is slow, and the tool call does not know.

The buffer is capped at 1,000 and drops the oldest when full. That cap is not a nicety. If the API is unreachable for an hour on a busy server, an uncapped buffer grows until the process dies — and a customer's server running out of memory over our analytics is the one failure we must never cause. Losing old payloads is the correct trade, made explicitly.

On network failure the batch is dropped. No retry queue, no exponential backoff, no growth. Retrying is how a small outage on our side becomes a memory problem on theirs.

There is one flush on the way out, best effort, with a one second timeout. If the process is exiting and the network does not cooperate, it exits anyway.

## Never store customer data

Sizes and hashes only. Never the arguments, never the results.

`args_hash` is twelve hex characters of SHA-256 over the arguments with keys sorted. `response_bytes` is `JSON.stringify(result).length` — the length, not the string. `is_empty` is a boolean computed at the call site, after which the result is discarded.

There is no option to change this. A guarantee with a switch is a default, and defaults get flipped by whoever is debugging at 2am.

## The rule that falls out of all three

Stdout belongs to the transport.

A stdio MCP server speaks JSON-RPC over stdout. A single `console.log` from a dependency corrupts the stream and the client disconnects — with an error that gives no hint at all about where it came from.

So every diagnostic in the SDK goes to stderr, including everything `debug: true` produces. It is a one-line rule that sounds obvious and has broken plenty of packages, because the reflex to `console.log` while debugging is very strong and the failure appears far away from the cause.

## What this means for the surface area

Each option is a way for something to go wrong inside a process we do not control. So there are two: `key` and `debug`.

There is no sampling rate, no custom transport, no hook to enrich payloads. Those are the features that make a package flexible, and each one is another path through code running in a customer's production server.

The one that gets asked for most is a way to capture arguments for debugging. The answer is no, permanently — it would break the third rule, and the third rule is the one that makes the other two worth having.
