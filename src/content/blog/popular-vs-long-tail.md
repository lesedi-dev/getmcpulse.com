---
title: Popular MCP servers vs the long tail
description: The most-installed servers are bigger — 30.4 tools against 16.6 — and worse on both schema measures. 28.6% of their parameters are undescribed, against 20.8%.
published: 2026-09-12
topic: Measurement
minutes: 5
---

Our corpus of 4,749 public MCP servers is two populations, not one, because the registry's pagination caps at 500 results.

| Pool | Servers | Tools | Parameters |
|---|---|---|---|
| Popular | 263 | 8,003 | 22,858 |
| Long tail | 4,486 | 74,546 | 234,429 |

The popular pool is the most-installed servers — page one opens in the tens of thousands of installs. The long tail is a union of a few hundred search terms: whatever else the registry would show us.

Neither is a random sample. They are two *different* biases, which is the point of having both. And they disagree in a direction we did not expect.

## Popular servers are worse on both measures

| | Popular | Long tail |
|---|---|---|
| Parameters with no description | **28.6%** | 20.8% |
| Tools with nothing distinctive | **28.1%** | 16.6% |
| Median distinctive share | **16.7%** | 27.3% |
| Servers with ≥1 colliding tool | **27.8%** | 22.6% |

Every row is worse in the pool with more installs. The undescribed-parameter rate is 7.4 points higher; colliding tools are 5.7 points more common.

The obvious reading — that install count is a proxy for schema quality — is not just unsupported, it points the other way.

## Most of it is size

Before concluding anything about care or maturity, the boring explanation:

| | Popular | Long tail |
|---|---|---|
| Mean tools per server | **30.4** | 16.6 |
| Median tools per server | 8 | 7 |
| Servers over 20 tools | **25.8%** | 20.1% |
| Largest | 2,530 | 1,515 |

Popular servers are substantially bigger — a mean of 30.4 tools against 16.6 — and [collision scales sharply with tool count](/blog/how-many-tools), from 0.5% at 1–3 tools to 32.4% at 61+. So the collision gap is largely composition: the popular pool has more big servers in it, and big servers collide.

That explanation works for collisions. It works less well for parameters, because [the undescribed-parameter rate is flat across every size bucket](/blog/which-descriptions-matter) — 20% to 25% regardless. If size does not drive that number in the corpus overall, size cannot be the whole story for a 7.4-point gap between pools.

Note the medians, too: 8 tools against 7. Nearly identical. The mean gap is driven by the tail of very large servers in the popular pool, not by typical popular servers being bigger.

## What might actually explain it

We do not know, and these are hypotheses rather than findings. Worth stating because each one is testable and none of them is flattering to an assumption people hold.

**Wrapping a large API.** The popular servers are disproportionately wrappers of big commercial APIs — the mail, issue-tracker and cloud-platform integrations people actually install. A generated wrapper inherits its parameter names from the upstream API and inherits nothing else, because upstream docs live on a website and not in a JSON Schema `description` field. The parameters are undescribed because they were never *written* — they were mapped.

**Generation at scale.** A 200-tool server was not hand-written, and a template produces tools that read alike by construction. One server in the corpus repeats [112 identical words across all 193 of its descriptions](/blog/shared-tool-preambles).

**Install count measures usefulness, not schema quality.** People install a Gmail server because they want Gmail. They do not read `tools/list` first. Nothing in the incentive loop rewards a described parameter, which is exactly why the rate is 21.5% corpus-wide.

The third one is the one we believe most and can prove least.

## What to take from it

**Do not copy a popular server's schema as a model.** This is the practical consequence, and it is the reason this post exists. "Look at how the big ones do it" is reasonable-sounding advice that, on these two measures, points you at the worse half of the corpus.

**Do not read a good install count as a passed review.** Yours or anybody's.

**If you wrap a large API, the parameter descriptions are the work.** They are what does not come across in the mapping, and they are the corpus's most common gap by a distance.

## What this cannot tell you

Neither pool is a random sample of anything, and that limits this post more than any other in the series. The popular pool is capped at 465 by the registry's pagination; the long tail is a union of search terms we chose. A difference between two non-random samples can be a difference in the sampling.

We also cannot separate the size effect from the rest cleanly. Doing that properly means comparing pools *within* a size bucket, and the popular pool thins out fast when you split it six ways — 465 servers does not support that division.

And we never ran a model against any of these servers, so "worse on both measures" means worse on two schema properties, not worse in use.

Every figure is reported for both pools in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study). The full survey is [here](/blog/reading-5000-mcp-schemas).

## Measuring your own

[The schema checker](/check) scores your server against the combined corpus and against servers your own size — which, given everything above, is the comparison that means something. Runs in your browser, nothing uploaded.
