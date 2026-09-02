---
title: An MCP tool description checklist
description: Nine checks, each with the rate it occurs across 4,749 public servers, so you can spend your time on the two faults that are actually likely.
published: 2026-09-29
topic: Tool design
minutes: 4
---

Every item here has a number attached: how often it actually occurs across 4,749 public MCP servers. Work down the list — it is ordered by likelihood, not by how satisfying each fix feels.

## The two that are probably wrong

**☐ Every parameter has a `description`.** — *21.5% of public parameters do not.*

One clause: what the field is for, what a valid value looks like. Check nested objects and array `items` too; most tooling only shows you the top level, and a field at depth three is exactly as invisible to a model as one at depth one.

Worst offender is the single-parameter tool, at **27.0%** undescribed — a lone `query` or `max_results` feels self-evident to its author and is a coin flip to a model.

**☐ No tool's description is built entirely from words its siblings use.** — *17.7% of public tools are.*

Read the whole list at once and strike every word that appears twice. What survives is your real description. If nothing survives, that is the finding.

## The three worth a minute

**☐ Any closed set is an `enum`, not prose.** — *857 parameters name their values in a description and leave the schema `string`.*

Grep for `valid values`, `options:`, `must be one of`, or a pipe-separated list. Each hit is a one-line fix, and it converts a hint the model may ignore into a constraint it cannot break.

**☐ No two tools use synonyms of the same verb.** — *`get` leads 15.6% of all public tool names.*

One verb per operation, server-wide. Never ship two from the same row:

```
get / fetch / read / retrieve
list / getAll / index
search / query / find / lookup
delete / remove / destroy
```

**☐ No shared preamble on every tool.** — *35 servers repeat 15+ identical words on every description; one repeats 112 across 193 tools.*

A word on every tool distinguishes no tool, and you pay for it once per tool per session. Put shared context in the server description, or reference the sibling that already says it.

## The four to actually add

**☐ Each description says what comes back.** — *almost none do.*

The return shape is the most distinguishing thing about a read-only tool. Two tools that both "search articles" are indistinguishable; one returning DOIs and one returning full text are not.

**☐ Each description contains one specific.** — a format, an upstream service, a limit, an identifier type.

`YYYY-MM-DD`. `Crossref`. `action log`. One concrete noun is distinctive by construction, because no sibling needs that word.

**☐ Numeric parameters have `minimum`/`maximum`.** — *5.6% and 4.7% usage.*

Free, unambiguous, and it stops the model requesting something that will be rejected or silently truncated.

**☐ Anything with a format has an `examples` entry.** — *0.3% usage, the least-used keyword there is.*

A `description` says what the field means; an example shows the string that works. `format: "date-time"` tells a model far less than `["2026-09-29T14:22:31Z"]`.

## Two things not to do

**Do not pad.** Length does not buy distinctiveness — the correlation across 75,914 tools is **+0.034**, which is nothing. A 15-word description at 27% distinctive beats a 60-word one at 25%, and costs a quarter as much on every connection.

**Do not check for duplicate tool names.** *0.19% of servers* — nine in the whole corpus. It is the thing people put on review checklists and it is a hundred times less likely than the first two items above. Automate it in CI with one assertion and never think about it again.

## Where the numbers come from

The survey read the `tools/list` response of 4,749 public MCP servers — 82,549 tools, 257,287 parameters. Full method and caveats in [the survey](/blog/reading-5000-mcp-schemas); data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).

None of it observed a model. Every rate says how often a pattern exists, not how often it costs you a call — which is why this is a checklist and not a ranking of harm.

## Running it on your own server

[The schema checker](/check) does the first five automatically on a paste of your `tools/list`, scored against servers your own size rather than the corpus average. It prints your descriptions with the shared words marked, which does the second item faster than reading can.

Runs in your browser, nothing uploaded.
