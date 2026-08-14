---
title: Dead tools — registered, described, and never once called
description: Every server has at least one. It costs schema tokens on every session, competes for the model's attention, and returns nothing, because nobody has ever reached it.
published: 2026-07-14
topic: Measurement
minutes: 4
---

A dead tool is one that appears in `tools/list` and has never been called. Not "rarely called" — never, across every session you have data for.

Almost every MCP server has one. They are easy to create and impossible to notice, because nothing about a tool that is never used produces any signal at all. No errors, no latency, no logs. It is quiet in exactly the way a working tool is quiet.

## How they happen

**It was built for a case that never came up.** `export_report` made sense during design. In practice nobody asks an assistant to export a report.

**Another tool absorbed it.** You added `search_orders` with a status filter, and `list_pending_orders` became redundant — but it still works, so it stayed.

**The model cannot tell when to use it.** This is the interesting one. The tool is useful and the need arises often, but its description overlaps with a neighbour's, and the model consistently picks the other one. The tool is dead because it lost a competition you did not know it was in.

**It requires arguments the model never has.** A tool needing an internal `warehouse_id` is unreachable from a conversation where nobody has ever seen a warehouse ID.

Those last two are worth separating from the first two, because the first two want deleting and the last two want fixing.

## Detecting them takes two sources

You cannot find a dead tool by looking at your call data, because a tool with no calls has no rows in it. Absence is not a record.

So it takes both sides:

- `tools` — every tool your server registered, from the startup payload, with its schema size
- `tool_days` — one row per tool per day that had at least one call

A dead tool is in the first and absent from the second, over the range you are looking at. That is why the SDK sends a startup payload at all: without it, a tool that has never run is indistinguishable from a tool that does not exist.

It also means a server that has booted but never been called still shows something useful. You can see what you are shipping, and what it costs per session, before the first user arrives.

## The output is a number, not a badge

> `export_report` has never been called, but costs 480 tokens of schema every session.

Both halves matter. "Never called" alone invites a shrug — it is not hurting anything. The second half says what it is actually costing: a fixed charge on every conversation, in the resource the model has least of, for nothing in return.

## Deciding what to do

Take the range seriously first. A tool with no calls in seven days might be quarterly. Look at 90 days before concluding anything.

Then split by cause:

**Genuinely unwanted** — delete it. You get the tokens back and every remaining tool becomes easier to choose between.

**Wanted but unreachable** — the model does not know when to use it. Compare its description against the tool that keeps winning. Nine times out of ten they claim overlapping territory, and the fix is to make the boundary explicit in both: "Use this for X. For Y, use `other_tool`."

**Needs arguments nobody has** — either derive the argument yourself from something conversational, or have another tool return it, so there is a path from a question to this tool.

**Deliberately kept for API consumers** — fine. Keep it, and know it is costing you 480 tokens per session for that convenience, which is a decision rather than an accident.

## The pattern behind it

Dead tools are the visible end of something more general: your server has a fixed budget of the model's attention, and every tool spends some of it whether or not it earns anything back.

Deleting a dead tool is not tidying. It is giving the tools that do get used a better chance of being picked correctly.
