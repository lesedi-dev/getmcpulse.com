---
title: 21.5% of MCP parameters have no description at all
description: 55,383 of 257,287 parameters across 4,749 servers ship with nothing but a name and a type. Only 0.4% of tools do. That asymmetry is the whole finding.
published: 2026-09-02
topic: Tool design
minutes: 5
---

Of the 257,287 parameters we read across 4,749 public MCP servers, **55,383 have no `description` field**. That is 21.5%, and they appear on 33.7% of servers — one server in three.

On its own that is a number. What makes it a finding is the comparison.

**Only 0.4% of tools have no description.** 328 out of 82,549.

So authors describe the tool fifty-four times more reliably than they describe its arguments. The same person, in the same file, writing the same schema.

## Why it happens

It is not carelessness, and it is not that anyone thinks parameters do not matter. It is where your attention is when you write the thing.

The tool is what you are thinking about. You are adding `search_orders` because you want the model to be able to search orders, and the description writes itself because it is the reason the tool exists. The parameters are plumbing that comes after the decision — you already know what `query` means, because you just decided what it is for.

The model has the opposite experience. It never saw your decision. It gets the name, the type, and whatever you wrote, and that is the entire brief:

```json
"max_results": { "type": "integer" }
```

Maximum of what? Per page or in total? Is 0 unlimited or an error? Is there a ceiling above which the server rejects it? None of that is knowable from the outside, and all of it changes what a sensible value is.

Here is a real one from the corpus, a paper-search server with seven sibling tools:

```
search                 query, max_results
search_arxiv           query, max_results
search_pubmed          query, max_results
search_biorxiv         query, max_results
search_medrxiv         query, max_results
search_google_scholar  query, max_results
fetch                  id, document_id
```

Every parameter listed is undescribed. Some are guessable — `query` on a search tool is not mysterious. `max_results` is a coin flip. And `fetch` takes both `id` and `document_id`, neither described, which is a genuine puzzle: a model has to pick one, and nothing in the schema says which, or whether they are the same thing.

That last case is the shape worth watching. A name carries a parameter only when the name is unambiguous *among the parameters of that tool*. Two similar names with no descriptions is worse than one bare name.

## It does not get better with practice

We split the corpus by how many tools a server publishes, expecting the rate to improve with size — a bigger server suggests a more experienced author, more review, more people reading the schema.

| Tools on the server | Undescribed parameters |
|---|---|
| 1–3 | 15.2% |
| 4–7 | 22.4% |
| 8–15 | 21.9% |
| 16–30 | 24.8% |
| 31–60 | 21.4% |
| 61+ | 20.1% |

It does not move. Between 20% and 25% at every size above the smallest bucket, with no trend in either direction.

Compare that to the other main finding in the survey, where the rate of tools with [nothing distinguishing them from a sibling](/blog/how-many-tools) rises from 0.5% to 32.4% across the same buckets — a factor of sixty-three.

One of those is a scale problem. This one is a habit. And the practical consequence is that **the two are independent**: shipping fewer tools will not fix your undescribed parameters, and writing more distinctive descriptions will not either. They are separate jobs on separate schedules.

The one thing that does correlate is unexpected: popular servers are *worse*. 28.6% against 20.8% in the long tail. Mostly that is size — popular servers average 30.4 tools against 16.6 — but it is a useful corrective to the idea that install count is a proxy for schema quality.

## The adjacent case: described, but not enforced

A parameter can have a description and still leave the model guessing, and there is a specific version of this worth naming.

**857 parameters** across 4.4% of servers write their valid values into the description in prose and leave the schema an open string:

```
delayed_option    "Controls per-user delivery timing.
                   Options: `"timezone"`, `"last-active"`."

outcome_attribution
                  "Attribution type for the outcomes.
                   Valid values: `"direct"`, `"influenced"`,
                   `"unattributed"`, `"total"`."
```

Those are good descriptions. The author knew the closed set and wrote it down. But the schema says `string`, so the model may send `"Direct"` or `"time-zone"` and the server rejects it — and from the model's side a rejection looks like a broken tool rather than a fixable mistake.

Moving those into an `enum` is a one-line change that converts a prose hint into a constraint. Across the corpus 7.9% of parameters carry an `enum` already; this is the population that should and does not.

That 895 is a floor, not an estimate. It only catches authors who documented the set. A closed set that was never written down anywhere is invisible to this test, and there is no way to count it from outside.

## What to do

**One thing, and it is the most common gap in the entire survey by a distance:** describe every parameter.

Not elaborately. One clause that says what the field is for and what a valid value looks like. For `max_results`, "how many papers to return, up to 100" resolves everything the type does not.

Two shortcuts that make it cheap:

**Write the parameter descriptions while writing the tool description**, in the same pass, before you have finished thinking about what the tool is for. Coming back later is the step that never happens, because by then the tool works.

**Read your schema as JSON, not as code.** In a builder API the parameters are arguments with names you chose and meanings you remember. In the `tools/list` response they are a wall of `{"type": "string"}`. Print the response once and read it the way a model has to.

## What this cannot tell you

We never ran a model against these servers, so nothing here measures how often an undescribed parameter actually causes a wrong call. Some are obvious from the name and cost nothing. Some are `id` versus `document_id` with no help at all.

Which is which — and therefore how much of that 21.5% matters — needs a model in the loop, and that is the follow-up study.

One more limit, and it is not small: the registry we drew from strips the top-level `required` array, so we cannot tell a required undescribed parameter from an optional one. A required parameter with no description is strictly worse, and we cannot separate them.

## Measuring your own

[The schema checker](/check) counts your undescribed parameters and names them, at every depth including inside nested objects, scored against the corpus rate and against servers your size. It runs in your browser and nothing is uploaded.

The full survey is [here](/blog/reading-5000-mcp-schemas), and every figure is in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
