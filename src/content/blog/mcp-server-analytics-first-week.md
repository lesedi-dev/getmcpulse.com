---
title: "MCP server analytics: what to read in your first week"
description: Sixteen numbers arrive at once and most of them mean nothing yet. Read them in this order — the first one is useful before a single call has landed.
published: 2026-10-07
topic: Measurement
minutes: 5
---

You have installed analytics on your MCP server. The dashboard has sixteen numbers on it, and on day one most of them are describing eleven calls you made yourself.

This is the order to read them in, and when each one starts meaning something.

## Minute one: the startup payload

Before anyone calls anything, the server reports its own tool list when it boots — each tool's name and the byte size of its schema. Two things are readable immediately.

**Schema size.** The total is what every session pays before a question is asked. Divide the bytes by four for a rough token count, and compare it with [the public median of about 1,250 tokens](/blog/what-your-tool-list-costs). If you are well above the 90th percentile, around 8,000, that is worth knowing before you have any traffic at all.

**Which tool is heaviest.** One tool carrying a third of the schema is common, and it is usually the one with a free-text description of every valid value — [which belongs in an `enum`](/blog/valid-values-open-string), not in prose.

## Day one: outcomes

As soon as calls land, read the outcome split per tool rather than the total:

- Any `crashed` at all is a bug. Fix these first; they are the cheapest wins you will get.
- `bad_args` on one tool, and not the others, points at that tool's schema. [It is the schema talking](/blog/bad-args-is-a-schema-problem).
- `tool_error` is fine at a low, steady rate. A spike is worth reading.

Ignore the server-wide percentages for now. With a few hundred calls, one bad session swings them by ten points.

## Day two: first-call success

Retries and first-call success are computed overnight, because deciding whether a call was retried means [looking at what came after it](/blog/the-nightly-pass). So the first value appears the morning after your first real traffic, labelled as of yesterday.

This is the number to spend the week on. Look for one tool well below the rest — there is almost always one — and read its description as if you had never seen the code. Then read [why the model might not call it at all](/blog/why-the-model-wont-call-your-tool).

## Day three: empty answers

Empty-answer counts need some volume before they mean anything, because any tool can legitimately return nothing for a query with no matches. Past a few hundred calls, look for a tool above about 5% empty. That is the model searching, getting nothing, and either giving up or retrying with looser arguments — which shows up a second time in first-call success.

The usual fix is the description, not the handler. "Returns an empty array when no orders match the filters" stops the model treating nothing as a failure.

## Day four: the client split

By now you will have calls from more than one client, and this is where the per-client view earns its place. Filter the tool table by each client in turn.

A tool at 80% first-call in one client and 40% in another is not a broken tool. It is a description that one model reads correctly and another does not, and [the server-wide figure averages the two into a number that points at nothing](/blog/averages-hide-clients).

## End of the week: dead tools and pairs

**Dead tools** need a week before you trust them. A tool nobody called on Tuesday might be a tool for Fridays. After seven days with real traffic, a tool with zero calls is [a cost with no return](/blog/dead-tools) — remove it, merge it, or rewrite its description so a model can tell when to reach for it.

**Tool pairs** need volume too. Once they settle, [the recurring pairs](/blog/tool-pairs) tell you where the model is making two round trips to do one job.

## What to leave alone

**Calls per day**, for now. The first week of any server is its author testing it, a handful of early users, and a spike from whatever link went out. The shape means little until you are past it, and [it was never a count of users anyway](/blog/calls-per-day-is-not-users).

**Latency**, unless a tool is consistently slow. Speed is [four buckets](/blog/percentiles-cannot-be-summed), and the one that matters is the share over two seconds. If that is under 10% for every tool, there is nothing to do this week.

**Cost per session**, until sessions look like real ones. [It is the number to quote](/blog/cost-per-session) — just not about your own test sessions.

If you have not installed anything yet, [the demo](https://app.getmcpulse.com/m/demo) is the real dashboard reading a sample server, so you can practise this order on numbers that already have a story in them.
