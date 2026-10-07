---
title: A server-wide average hides which client is struggling
description: Your first-call rate is an average over every model that connects to you. When one reads a description correctly and another does not, the average points at nothing.
published: 2026-10-07
topic: Measurement
minutes: 5
---

Say a tool's first-call success is 62%. What do you change?

You cannot tell. 62% might be a tool every model finds mildly confusing, which means the description needs work. Or it might be a tool one client reads perfectly and another reads badly, which means something quite different. The number is the same either way.

## One server, several readers

An MCP server is not called by "the model". It is called by whatever clients your users connect from — Claude Desktop, Cursor, and frequently something you did not expect — each putting a different model, a different system prompt and a different tool-selection strategy in front of the same descriptions.

Those readers disagree. A description that is unambiguous to one can be read two ways by another. A required parameter one client fills from context, another has to guess. And all of it lands in the same column of your metrics, averaged together.

## What the average does

Here is the sample server that every new MCPulse account is seeded with. It was constructed deliberately to show this shape, so treat the numbers as an illustration rather than a measurement:

| Client | First-call success on one tool |
|---|---|
| `claude-desktop` | 76% |
| `cursor` | 21% |
| All clients | 62% |

Same tool, same description, same day. Three readings of it:

- **From the server-wide figure**, the tool is a bit weak. You might reword the description in general terms and hope.
- **From the split**, the tool is fine in one client and badly broken in another. The handler is not the problem, and neither, really, is the description in general — something specific in it is being read differently.
- **And the larger client hides the smaller.** The good client's traffic pays for the bad one's, so the average looks survivable while one group of users is having a terrible time.

The gap between the two rows is the finding. A single number cannot contain it.

## The same goes for every metric

First-call success is the sharpest case, but nothing is immune:

- **Bad arguments** concentrated in one client point at a parameter that client's model fills in differently.
- **Empty answers** in one client usually mean that client is passing narrower filters.
- **Latency** can differ by client too, when one sends larger requests or calls tools in a different order.
- **Dead tools** are sometimes dead in one client only, because its model always reaches for a sibling instead.

## Where the client name comes from

You do not have to guess it. Every MCP connection starts with an `initialize` request, and the client names itself in `clientInfo.name`. MCPulse reads it from that request and attaches it to every call in the session.

The cost of keeping it is a column. The counters are stored [one row per hour, per tool, per client](/blog/rollups-exist-so-events-can-be-deleted) — which was itself a fix. An earlier version kept tool counts and client counts in two separate tables, so "how is `search_orders` doing in Cursor only" could not be asked at all. One table keyed by both is what lets a tool filter and a client filter narrow the same rows.

## What to do with a gap

When one client is far below the others on one tool:

1. **Read the description as that client would.** Look for the word that has two meanings, the parameter whose format is implied rather than stated, the constraint that lives only in the schema. [The checklist](/blog/mcp-tool-description-checklist) is a quick pass.
2. **Check `bad_args` for the same pair.** If it is high, the model is failing to fill the schema — [usually a schema problem](/blog/bad-args-is-a-schema-problem).
3. **Fix for the struggling client without breaking the good one.** Watch both rows after the change. A rewrite that lifts one client from 21% to 60% and drops the other from 76% to 50% is not progress.

## What it cannot tell you

The client name is what the client says it is. It identifies software, not a model version, and a client can change its model without changing its name. When a client's numbers move overnight and your server did not change, that is the first thing to suspect.

It also cannot tell you *why* one model reads your description differently. It can only tell you that one does, on which tool, by how much — which is the part you had no way of seeing before.

[The demo](https://app.getmcpulse.com/m/demo) has the client filter on every panel, on the sample server above.
