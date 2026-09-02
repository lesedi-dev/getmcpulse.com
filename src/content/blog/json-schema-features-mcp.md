---
title: Which JSON Schema features do MCP servers actually use?
description: default appears on 17.2% of parameters — more than enum. format is 2.1%, pattern 1.6%, and examples 0.3%. Most of JSON Schema goes unused.
published: 2026-09-22
topic: Tool design
minutes: 5
---

`inputSchema` is JSON Schema, so a parameter can carry a great deal more than a type and a description. Almost none of it does.

Across 257,287 parameters on 4,749 public MCP servers:

| Keyword | Parameters | Share |
|---|---|---|
| `default` | 44,156 | **17.2%** |
| `enum` | 20,263 | 7.9% |
| `title` | 19,788 | 7.7% |
| `minimum` | 14,464 | 5.6% |
| `items` | 13,903 | 5.4% |
| `maximum` | 12,121 | 4.7% |
| `minLength` | 8,862 | 3.4% |
| `maxLength` | 8,434 | 3.3% |
| `format` | 5,326 | 2.1% |
| `pattern` | 4,116 | 1.6% |
| `examples` | 768 | **0.3%** |
| `const` | 130 | 0.1% |

## `default` is the most-used feature, and that is interesting

More parameters carry a `default` than an `enum`. That is not what we expected, and it says something about how these schemas get built: `default` is the keyword that survives generation from a typed source, because a function signature with `limit = 20` has somewhere obvious to put it.

It is also the keyword with the least ambiguous payoff. A parameter with a sensible default is a parameter the model does not have to invent a value for — which removes a whole category of argument error rather than documenting it. If you are adding one keyword to your schemas, this is a better candidate than most.

One caveat worth knowing: `default` in JSON Schema is annotation, not behaviour. It does not fill the value in — the client or your handler has to. A `default` the model reads and your server ignores is a mismatch that only shows up under traffic.

## `examples` at 0.3% is the real gap

768 parameters out of 257,287.

That is striking because an example is the single most useful thing you can hand a model that is filling in a field. A `description` says what the field means; an example shows the exact string that works. And [the corpus's most common fault is parameters with no description at all](/blog/21-percent-of-parameters) — so the field that would help most is used least, in a population where the baseline field is missing a fifth of the time.

The comparison that makes the point: `format` (2.1%) is used seven times more often than `examples`, and `format: "date-time"` tells a model far less than `"examples": ["2026-09-22T14:22:31Z"]`. One names a standard; the other shows the string.

## `format` and `pattern` are barely used, and that is defensible

2.1% and 1.6%.

`format` is the weaker case for adoption than it looks. Most JSON Schema validators treat it as annotation by default, so `format: "email"` frequently enforces nothing — it is a hint dressed as a constraint. If you want an email validated, your handler validates it.

`pattern` genuinely constrains, and 1.6% is probably about right. A regex in a schema is read by the model as text, and a model that gets a regex wrong produces a rejected call it cannot diagnose — the same failure mode as [a closed set written in prose](/blog/valid-values-open-string). For a truly rigid format it earns its place; for most fields a described example does more.

## `minimum` and `maximum` are the quiet win

5.6% and 4.7% — and unlike `format`, these do exactly what they say with no interpretation.

A `limit` parameter with `minimum: 1, maximum: 100` cannot receive 10,000, so the model cannot ask for a payload that will be rejected or, worse, silently truncated. On a numeric parameter this is close to free and it is used on roughly one in twenty.

## What we would actually add

In order, given the corpus:

1. **A `description`** on every parameter. 21.5% do not have one. Nothing below matters until this is done.
2. **An `examples` entry** on anything with a format — dates, IDs, query syntax. 0.3% usage, and the highest information per byte in the whole keyword list.
3. **A `default`** wherever one is sensible. Already the most-used feature; it removes the guess entirely.
4. **`minimum`/`maximum`** on numbers. Free, unambiguous, prevents a request that cannot be served.
5. **An `enum`** wherever the set is closed — and particularly on [the 857 parameters that name their values in prose and leave the schema open](/blog/valid-values-open-string).

And the ones to be relaxed about: `title` (7.7%, and it duplicates a good name), `format` (annotation, not enforcement), `const` (a constant is a parameter that should not exist).

## What this cannot tell you

We counted keywords on top-level `inputSchema.properties`. Nested fields are excluded, for the same comparability reason as everywhere else in the survey.

Presence is not correctness. A `pattern` that does not match the values the server accepts is worse than no `pattern`, and we cannot evaluate that from outside. Same for `default` — we can see one is declared, not whether anything applies it.

And no model was run against these servers, so the ranking above is reasoning from what each keyword tells a model, not a measurement of which ones reduce errors. That ordering is exactly the kind of thing the follow-up study should overturn.

## Measuring your own

[The schema checker](/check) reports your enum coverage and flags the parameters that describe a closed set without constraining it. It runs in your browser and nothing is uploaded.

Data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
