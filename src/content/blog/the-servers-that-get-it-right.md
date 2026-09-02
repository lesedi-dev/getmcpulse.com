---
title: The MCP servers that get their schemas right
description: 718 of 2,255 servers have no undescribed parameters, no colliding tools, and no unenforced closed sets. They are smaller, cheaper and more distinctive.
published: 2026-10-01
topic: Tool design
minutes: 6
---

Every post in this series so far has been about a fault. This one is about the servers that do not have any.

Of 2,255 public MCP servers with at least eight tools and eight parameters, **718 — 31.8% — score zero on all four faults the survey measures:**

- no parameter missing a `description`
- no tool whose description shares every word with a sibling
- no closed set named in prose and left an open string
- no tool missing a description

Nearly a third. That is the most encouraging number in the whole corpus, and it is worth saying plainly: getting this right is normal, not exceptional.

## What they have in common

| | Clean (718) | The rest (1,537) |
|---|---|---|
| Median tools | **12** | 23 |
| Median parameters | **34** | 61 |
| Median schema cost | **2,560 tokens** | 4,032 tokens |
| Median distinctive share | **44%** | 33% |
| Enum coverage | **9.8%** | 7.3% |

Four things fall out of that, and only the first is obvious.

**They are half the size.** 12 tools against 23. That is the [collision-scaling result](/blog/how-many-tools) seen from the other end: staying small is the single most effective thing a server does for its own schema quality.

**They cost 37% less to send.** 2,560 tokens against 4,032, [on every connection](/blog/what-your-tool-list-costs). Not because their descriptions are terser — because there are fewer tools to describe.

**Their descriptions are a third more distinctive.** 44% against 33%. This is the interesting one, because it is not just size: it means the words they spend are doing more work, not that they spend fewer.

**They use more enums.** 9.8% of parameters against 7.3%. A small gap, but it points at the same disposition — an author who describes every parameter is an author who constrains the ones with closed sets.

## Size is not destiny

The obvious objection to all of the above is that these are just small servers, and small servers have less to get wrong.

**46 of the clean servers publish 30 or more tools.** The largest is `frihet/frihet-mcp` at **160 tools** — 534 parameters, every one described, no two tools indistinguishable. At that size the corpus average for colliding tools is 32.4%.

Others worth naming, because they are the proof that this is achievable at scale:

| Server | Tools | Parameters | Schema cost |
|---|---|---|---|
| `frihet/frihet-mcp` | 160 | 534 | 25,268 tok |
| `contact-erkc/sirenic` | 73 | 184 | 19,138 tok |
| `gavin-9000/pulsenetwork` | 68 | 1,193 | 45,225 tok |
| `trendidea/TrendIdea` | 65 | 124 | 8,545 tok |
| `open-ephemeris/openephemeris` | 63 | 308 | 20,774 tok |
| `dsers/mcp-server` | 57 | 305 | 55,303 tok |
| `cod-gb2l/studiomeyer-memory` | 56 | 309 | 15,269 tok |

`gavin-9000/pulsenetwork` describes **1,193 parameters** without missing one. Whatever their process is, it is not "remember to write a description" — at that count it has to be enforced somewhere.

## The small clean ones worth reading

If you want a model to copy, these are the servers in the 8–20 tool range that score perfectly and are cheap with it:

```
naver/search                              12 tools    1,830 tok   53% distinctive
hamid-vakilzadeh/mcpsemanticscholar       12 tools    1,404 tok   53% distinctive
Nekzus/npm-sentinel-mcp                   19 tools    1,661 tok   67% distinctive
cyanheads/pubmed-mcp-server               10 tools    3,297 tok   56% distinctive
entia/entity-verification                 12 tools    2,409 tok   65% distinctive
jordan-s648/PolymarketScan                 8 tools      692 tok   73% distinctive
```

`jordan-s648/PolymarketScan` is the one to look at first: eight tools, 692 tokens of schema — about half the corpus median — and a 73% distinctive share. It is the cheapest well-described server in the corpus.

And note that **`brave`, `googlesheets`, `googlecalendar`, `googledrive` and `gusto` are all clean.** Which is a useful corrective to [our own finding that popular servers score worse on average](/blog/popular-vs-long-tail): the average is dragged down by large generated wrappers, not by everything well-installed.

## Why this is not a scorecard

We built one and threw it away, and the reason is worth stating.

A composite score means weighting four unrelated faults against each other, and there is no defensible exchange rate between "a parameter has no description" and "two tools cannot be told apart". Our first attempt gave 69% of servers a score above 90 and put the very worst at 53 — a scale that flattered everyone and distinguished nobody, because each fault could only ever cost a quarter of the total.

So: four separate counts, and a binary for clean. Either you have zero of a fault or you do not. That is a claim we can defend, and "31.8% have none of them" says more than any index would.

We are also not ranking the bottom. Naming the worst servers in a small community buys a headline and costs goodwill, and every fault in this corpus is one an author can fix in an afternoon once they know it is there. [The checker](/check) tells them privately, which is the better mechanism.

## What this cannot tell you

Clean does not mean good. Every fault here is detectable from a schema sitting still, and a server can pass all four while being slow, wrong, or useless. We never ran a model against any of these, and we never called a tool.

The eligibility floor matters too: 8+ tools and 8+ parameters, chosen so a two-tool server cannot score perfectly by having almost nothing to get wrong. Move that floor and 31.8% moves with it.

And the clean-versus-rest comparison is a correlation. Smaller servers score better, and we cannot separate "small is easier" from "authors who stay small are more careful about everything".

## Measuring your own

[The schema checker](/check) runs the same four checks and tells you which, if any, you have — scored against servers your own size. Runs in your browser, nothing uploaded.

Full method in [the survey](/blog/reading-5000-mcp-schemas); data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
