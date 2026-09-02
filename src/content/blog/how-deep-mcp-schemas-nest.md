---
title: How deep do MCP input schemas nest?
description: 83.1% of tools are one level deep and the deepest is thirteen. Deeply nested schemas are better documented than flat ones, not worse — 18.2% against 21.8%.
published: 2026-09-19
topic: Tool design
minutes: 5
---

A model filling in a tool call has to construct whatever shape your `inputSchema` describes. A flat object of strings is one thing; an array of objects each containing an object is another.

So: how nested are real MCP schemas? We measured depth across 74,666 tools that take parameters, following `properties`, `items`, and `anyOf`/`oneOf`/`allOf` branches.

## Almost everything is flat

| Depth | Tools | Share |
|---|---|---|
| 1 | 62,054 | **83.1%** |
| 2 | 9,279 | 12.4% |
| 3 | 2,333 | 3.1% |
| 4 | 599 | 0.8% |
| 5 | 216 | 0.3% |
| 6 | 77 | 0.1% |
| 7–13 | ~108 | <0.1% |

**Five tools in six are a flat object of scalars.** No nesting at all — `{"query": string, "limit": integer}` and nothing more.

Add depth 2 and you have 95.5% of the corpus. Depth 2 is the array-of-strings and the single options object: `{"tags": string[]}`, `{"filter": {"from": string}}`.

The deepest schema in the corpus is **thirteen levels**. There are five of those.

## The finding that reverses the expectation

We split the undescribed-parameter rate by schema depth, expecting deep schemas to be worse — more structure, more fields, more places to skip a description.

**The opposite.** Tools at depth 3 or more: **18.2% of top-level parameters undescribed.** Tools below depth 3: **21.8%**.

Deep schemas are better documented than flat ones, by 3.6 points.

We think the reason is who writes them. A depth-5 schema is not something you arrive at casually — it is either generated from a typed source (an OpenAPI spec, a Zod schema, a protobuf definition) where descriptions come along for the ride, or hand-built by someone modelling a genuinely structured input and paying attention. Flat schemas are where the two-line afterthought lives, and [the single-parameter tool is the worst-described shape in the corpus at 27.0%](/blog/params-per-tool).

So depth is not a warning sign. It correlates with care.

## But the corpus rate hides the nested fields

One important caveat about that comparison, and about [the 21.5% corpus figure](/blog/21-percent-of-parameters) generally: it counts **top-level** `inputSchema.properties` only. A field three levels down is not in the denominator.

That was the right call for the survey — the study's per-tool parameter counts had to mean one thing consistently — but it means the corpus number understates the real gap. A tool whose top-level parameters are all described and whose nested object is bare scores clean.

And an undescribed field at depth 4 is exactly as invisible to a model as one at depth 1. It has a name, a type, and nothing else.

## What this means practically

**Do not flatten a schema to look simpler.** Depth is not the problem the data points at. If your input genuinely has structure — a filter object, a list of line items — modelling it honestly is better than a dozen underscore-joined top-level fields, and the corpus suggests people who do it describe their fields better anyway.

**Do describe the nested fields.** They are the ones most likely to be missed, because most tooling shows you the top level. This is the one place where the survey's own methodology would let you off and a model would not.

**Past about four levels, ask what the model is meant to construct.** 0.4% of the corpus goes deeper than four. A model generating a five-level nested object has many more ways to get the shape wrong than to get it right, and there is usually a flatter representation of the same request. Not always — but at that depth it is worth checking.

**Watch `anyOf` and `oneOf` specifically.** They are depth without looking like depth: a parameter that is "either a string or an object with three fields" is two shapes the model has to choose between, and the choice is rarely documented. A `description` on the branch point is worth more than one on either branch.

## What this cannot tell you

We measured depth, not difficulty. A depth-3 schema of well-named described fields is easier for a model than a flat one with two bare `id` parameters, and nothing here captures that.

The correlation between depth and better documentation is a correlation. The generated-from-typed-source explanation is our reading of it, not something the data shows — we cannot see how a schema was produced.

And as always: no model was run against any of these servers. Whether nesting depth actually causes malformed arguments is unmeasured, and it is one of the more testable things on our list.

## Measuring your own

[The schema checker](/check) walks your schema to every depth — through `properties`, `items` and union branches — and names undescribed fields by their full path: `filter.from`, `tags[].label`. It reports the top-level count separately, so the number scored against the corpus stays comparable while the list of things to fix does not leave anything out.

Runs in your browser, nothing uploaded. Data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
