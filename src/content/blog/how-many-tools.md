---
title: How many tools should an MCP server have?
description: Across 4,749 public servers, the share of tools with nothing to tell them apart rises from 0.5% to 32.4% as the tool count grows. That is a factor of sixty-three.
published: 2026-09-02
topic: Tool design
minutes: 7
---

There is no protocol limit. You can register two tools or two thousand, and `tools/list` will return all of them.

So the question is not what is allowed, it is what starts to break. We can answer that part, because we read the tool schemas of 4,749 public MCP servers — 82,549 tools — and the thing that breaks is legible from outside the server.

**The short answer: somewhere past thirty tools, your descriptions stop being able to tell your tools apart, and that becomes the dominant risk on your server.** Below about eight it is almost never the problem.

## What most servers actually ship

Before the failure, the distribution. It is more skewed than people expect:

| | Tools |
|---|---|
| Median server | **7** |
| Mean server | 17.4 |
| Servers over 10 tools | 37.8% |
| Servers over 20 tools | 20.6% |
| Largest in the corpus | **2,530** |

A median of 7 against a mean of 17.6 tells you the shape on its own: most servers are small, and a long tail of very large ones drags the average up. One in five servers is over twenty tools.

## The number that moves

For every tool we took the content words in its description and asked how many appear in **no other tool's description on the same server**. Call that its distinctive share. A tool at zero has not one word that separates it from its siblings.

Splitting the corpus by tool count:

| Tools on the server | Servers | Tools with nothing distinctive |
|---|---|---|
| 1–3 | 1,193 | **0.5%** |
| 4–7 | 1,257 | **1.6%** |
| 8–15 | 1,013 | **4.4%** |
| 16–30 | 738 | **7.6%** |
| 31–60 | 350 | **16.6%** |
| 61+ | 198 | **32.4%** |

It rises monotonically and by a factor of sixty-three. On the largest servers, nearly one tool in three carries a description containing no word that distinguishes it from the tool next to it.

Note where it accelerates. From 16–30 to 31–60 the rate more than doubles, and doubles again by 61+. That is the basis for "past about thirty" — not a round number chosen for being round.

## Some of this is arithmetic, and some of it is not

More tools means more pairs that could collide, so some rise is inevitable. Sixty-three times is not inevitable.

What produces the extreme cases is templating. Past a certain size, authors stop writing each description and start generating them, and a template is a machine for producing tools that read alike. The corpus contains one server that appends the same 51-word context block to all 275 of its tools; the sentence that actually distinguishes one tool from another is 8 words out of 59.

The clearest cases need no template at all. Two tools on one server, at 1.00 similarity by content words:

```
tool_markdown_to_html    "Convert Markdown to HTML."
tool_html_to_markdown    "Convert HTML to Markdown."
```

Those tools do opposite things. Both descriptions are correct, clear, and minimal. And as a bag of content words they are identical — *convert*, *markdown*, *html* — so a model choosing between them on description alone has nothing to choose on. Word order is doing all the work, and word order is a thin thing to bet a tool call on.

Or, without even the symmetry:

```
ror_search               "Search organizations."
search_organizations     "Search organizations."
```

Same server. Same sentence. Two tools.

## The failure that does not care how big you are

Here is the part that makes the size question narrower than it looks. Alongside collisions, we measured how many parameters ship with no `description` at all. By the same buckets:

| Tools on the server | Undescribed parameters |
|---|---|
| 1–3 | 15.2% |
| 4–7 | 22.4% |
| 8–15 | 21.9% |
| 16–30 | 24.8% |
| 31–60 | 21.4% |
| 61+ | 20.1% |

Flat. Between 20% and 25% at every size above the smallest bucket, with no trend at all.

**So the two failures are independent.** Collisions scale with tool count; undescribed parameters are a habit, and a two-tool server has it about as much as a two-hundred-tool one. Which means splitting a large server will not fix your undescribed parameters, and writing better descriptions will not fix your collisions. They are separate jobs.

## So: how many?

The honest version of the answer has a shape rather than a number.

**Under about eight tools, size is not your problem.** Collision sits at 1.6% or below. If a model is picking wrong on a five-tool server, look at the individual descriptions, not the count.

**Between eight and thirty, watch it but do not reorganise for it.** 4.4% to 7.6%. Real, and cheaper to fix by rewriting two descriptions than by restructuring.

**Past thirty, the count itself is the risk.** 16.6%, then 32.4%. At that size, rewording is treating a symptom: you have enough tools that some of them genuinely overlap in what they do, and no amount of careful prose separates two tools that do nearly the same thing. Splitting the server, or collapsing near-identical tools into one with a mode parameter, does more than any edit to the text.

**Past sixty, assume it is happening.** Nearly one in three, in the corpus. It is not a question of whether you have collisions; it is which ones cost you.

## What this cannot tell you

This is static analysis. We never ran a model against any of these servers, so nothing here says how often a model actually picks the wrong tool.

"A model has nothing to discriminate on" is a fact about a schema. "A model therefore picks wrong 31% of the time on a large server" is a fact about traffic, and we do not have it. A zero-distinctive description may cost nothing when the tool *name* is unambiguous — `tool_html_to_markdown` is a fairly clear name — and may cost a great deal when it is not.

Our guess is that real misuse is worse than a schema predicts in some places and better in others, and that the ranking of these signals by how much they matter is the interesting open question. That needs a model in the loop, which is the follow-up study.

Two narrower caveats. The corpus comes from the [Smithery](https://smithery.ai) registry and inherits its coverage and scan freshness, and neither of its two pools is a random sample.

## Measuring your own

Paste your `tools/list` response into [the schema checker](/check) and it runs this test on your server, scored against the bucket your tool count actually falls into rather than the corpus-wide average. That last part matters more than it sounds: a five-tool server told it beats the 17.6% corpus average has learned nothing, because servers its size sit at 1.6%.

It runs in your browser — the schema is not uploaded, which matters because plenty of the servers worth checking are not public yet.

The method, the corpus and every figure above are in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study). The full survey, with the parts this post leaves out, is [here](/blog/reading-5000-mcp-schemas).
