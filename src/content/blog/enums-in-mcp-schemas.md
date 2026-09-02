---
title: Only 8% of MCP parameters use an enum
description: 20,263 of 257,287 parameters constrain their values. 12.4% of string parameters do. One enum in the corpus has 3,517 values, and 270 have exactly one.
published: 2026-09-10
topic: Tool design
minutes: 6
---

An `enum` is the cheapest thing in JSON Schema. It converts a hint into a constraint: instead of hoping the model sends `"inbox"`, the schema says those are the only words allowed.

Across 4,749 public MCP servers, **20,263 of 257,287 parameters carry one — 7.9%.**

That number needs a denominator to mean anything, though, because most parameters could not have an enum. A free-text `query`, a numeric `limit`, an arbitrary `id` — nothing to enumerate.

## The number that matters

Restrict it to string parameters, which is where a closed set is plausible:

| | Count |
|---|---|
| String parameters | 161,019 |
| …with an `enum` | 20,036 |
| **Share of strings** | **12.4%** |

So roughly one string parameter in eight is constrained, and seven in eight accept anything.

That is still not a target. Most of those seven are genuinely open — search terms, file paths, message bodies. The question is how many *should* be closed and are not, and that is mostly unanswerable from outside a server. You cannot tell from a schema that `status` accepts exactly three values.

## What you can find

You can find the case where the author wrote the values down in prose and left the schema open.

**857 parameters, on 4.4% of servers.** That is 0.5% of all string parameters:

```
delayed_option      "Controls per-user delivery timing.
                     Options: `"timezone"`, `"last-active"`."

outcome_attribution "Attribution type for the outcomes.
                     Valid values: `"direct"`, `"influenced"`,
                     `"unattributed"`, `"total"`."

commitment          "Optional processed|confirmed|finalized commitment"
```

The author knew the closed set. They typed it out. And the schema says `string`, so the model can send `"Direct"` and the server rejects it — which from the model's side looks like a broken tool rather than a fixable mistake.

That one has [its own post](/blog/valid-values-open-string), because it is the most actionable finding in the whole survey: a one-line change, and the population is already identified.

## The shape of the enums people do write

| | Values |
|---|---|
| Median enum | **3** |
| Mean | 5.4 |
| Largest | **3,517** |

The distribution is heavily weighted to the small end — 2 values is the single most common size (6,378 parameters), then 3 (4,987), then 4 (3,442). That is what you would expect: enums are mostly modes, directions and states.

Two tails are interesting.

**258 enums have exactly one value.** That is not a choice, it is a constant. Sometimes it is a discriminator in a `oneOf` branch, which is legitimate. Sometimes it is a parameter that used to have options and no longer does, in which case it is a field the model must send and cannot vary — and could be removed from the surface entirely.

**100 enums have more than fifty values.** At the top, one server — `hasdata/scraping` — has a `geo` parameter with **3,517 enumerated values**, and a `cat` parameter with 1,133. Several `gl` parameters at 245.

Those are country and category codes, and enumerating them is defensible: it is correct, it is machine-checkable, and it stops the model inventing a region. It is also expensive. 3,517 string values is a large fraction of that server's [schema budget, paid on every connection](/blog/what-your-tool-list-costs), to constrain one field — and a model that does not know the code will not learn it from a list of 3,517.

Somewhere between 3 and 3,517 the enum stops being a constraint the model can use and becomes a document it has to skim. We do not know where that line is, and we would not guess from schemas alone.

**Five boolean parameters carry an enum.** `{"type": "boolean", "enum": [true, false]}` is harmless and says nothing the type did not.

## What to do

**Convert your prose enums.** If a description contains "Options:", "Valid values:", or a pipe-separated list, the values belong in the schema. This is the whole recommendation and it needs no judgement.

**Use an enum for modes, states and directions.** Two to six values, closed by design. This is what the corpus already does well and it is worth doing deliberately: it removes a class of argument error rather than documenting it.

**Think twice past about fifty values.** Not never — country codes are real. But weigh what it costs on every connection against how much a long list actually helps, and consider whether the field wants validation on your side and a free-text schema instead.

**Do not enum something that will grow.** An enum is part of your published interface. A list of your five plan names is a breaking change waiting to happen the first time marketing adds a sixth.

## What this cannot tell you

The big one: we cannot tell you how many parameters *should* have an enum. A schema does not reveal that `status` is closed. The 895 prose-enum cases are a floor, not an estimate — they only catch authors who documented the set, and a closed set nobody wrote down anywhere is invisible to this test.

We also never ran a model against these servers, so nothing here measures whether an unconstrained string actually produces a bad call more often than a constrained one. That is the obvious experiment and it needs the follow-up study.

Counts are top-level `inputSchema.properties`. The corpus comes from the [Smithery](https://smithery.ai) registry and inherits its coverage.

## Measuring your own

[The schema checker](/check) counts your enums and flags the parameters that name their values in prose while leaving the schema open — with the description quoted, so you can see the fix. Runs in your browser, nothing uploaded.

Data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
