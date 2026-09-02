---
title: Is there a right number of parameters per MCP tool?
description: The median MCP tool takes 2 parameters and 9.5% take none. The undescribed-parameter rate is worst on tools with exactly one — 26.9%, against 19.9% at four to six.
published: 2026-09-05
topic: Tool design
minutes: 5
---

Tool count gets all the attention. Parameter count barely comes up, which is odd, because a parameter is the part the model has to *fill in* rather than merely choose.

We counted them across 4,749 public MCP servers — 82,549 tools, 257,287 parameters.

## The distribution

| Parameters | Tools | Share |
|---|---|---|
| 0 | 7,857 | **9.5%** |
| 1 | 21,559 | 26.1% |
| 2–3 | 29,893 | **34.4%** |
| 4–6 | 16,806 | 20.4% |
| 7–10 | 5,600 | 6.8% |
| 11–20 | 2,285 | 2.8% |
| 21+ | 386 | 0.5% |

Median **2**, mean **3.1**, maximum **136**.

Two things stand out. Nearly one tool in ten takes **no parameters at all** — a pure verb, `list_projects` with nothing to configure. And the distribution is tight: 90% of tools take six or fewer.

So the practical answer to "is there a right number" is that the corpus has already voted. Two or three is normal, up to six is unremarkable, and past ten you are in the 3% tail.

## The finding we did not expect

We split the undescribed-parameter rate by how many parameters the tool has, expecting it to get worse as tools got more complex — more parameters, more chances to skip one.

The opposite:

| Parameters | Undescribed |
|---|---|
| 1 | **27.0%** |
| 2–3 | 21.1% |
| 4–6 | **19.6%** |
| 7–10 | 23.0% |
| 11–20 | 21.1% |
| 21+ | 23.4% |

**Single-parameter tools are the worst-documented tools on the corpus** — 27.0% of their parameters have no description, against 19.6% for tools with four to six.

It is not a large gap and it is a consistent one, and we think the reason is that a single parameter feels self-evident to its author. `search(query)` — what else would `query` be? The tool name and the parameter name together seem to say everything, so the description gets skipped.

Sometimes they do say everything. Here is a real case from the corpus where they do not — a paper-search server, seven sibling tools:

```
search                 query, max_results
search_arxiv           query, max_results
search_pubmed          query, max_results
search_google_scholar  query, max_results
fetch                  id, document_id
```

Every parameter shown is undescribed. `query` survives. `max_results` is a coin flip — per page or total, is 0 unlimited, is there a server-side ceiling. And `fetch` takes both `id` **and** `document_id`, neither described, which a model simply cannot resolve: it has to pick one and nothing says which, or whether they differ.

That last row is the shape to watch. A name carries a parameter only when it is unambiguous *against the other parameters of the same tool*. Two similar bare names are worse than one.

## The zero-parameter tools

7,857 tools take no arguments, and they are worth a separate thought because they cannot have an argument problem at all. They can only be picked wrongly or not picked.

Which means for that 9.5% of the corpus, everything that matters is the name and the description — the [distinctiveness question](/blog/why-models-pick-the-wrong-tool) and nothing else. If a no-parameter tool is not getting called, no amount of schema work will help; the text is the entire surface.

## Is more parameters a smell?

We cannot answer this properly, and it is worth saying why rather than guessing.

A 136-parameter tool is obviously unusual. Whether it is *wrong* depends on whether those 136 fields correspond to something real — a search endpoint with 136 genuine filters is a faithful wrapper of a large API, and splitting it into twenty tools would trade a parameter problem for a [collision problem](/blog/how-many-tools), which the data says gets worse faster.

What we can say is that the tradeoff exists and runs in both directions. Fewer tools with more parameters means less to choose between and more to fill in. More tools with fewer parameters means the reverse. The corpus shows collisions scaling sharply with tool count and undescribed parameters staying flat at 20–25% regardless — which mildly favours the fewer-tools-more-parameters side, on the grounds that the failure it moves you toward is the one that does not compound.

Mildly. This is the weakest claim in this post and we are labelling it as such.

## What to do

**Describe the single parameter.** It is the one most likely to be skipped and the case where the author's confidence is least warranted. One clause: what it is for, and what a valid value looks like.

**Never ship two bare parameters with similar names.** `id` and `document_id` on the same tool, both undescribed, is unresolvable from outside. If you keep both, describe both.

**Don't split a tool to reduce its parameter count.** You are trading a flat problem for a compounding one.

## What this cannot tell you

We never ran a model against these servers, so nothing here measures how often a missing parameter description causes a bad call — only how often one is missing.

And the corpus is missing a field that matters here: the [Smithery](https://smithery.ai) registry strips the top-level `required` array, so we cannot tell a required undescribed parameter from an optional one. A required parameter with no description is strictly worse, and the split is unmeasurable in this data.

Counts are top-level `inputSchema.properties`. Nested object properties are not in the denominator.

## Measuring your own

[The schema checker](/check) counts your parameters and names the undescribed ones — at every depth, including inside nested objects, which this corpus figure deliberately excludes so it stays comparable.

Runs in your browser, nothing uploaded. Data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
