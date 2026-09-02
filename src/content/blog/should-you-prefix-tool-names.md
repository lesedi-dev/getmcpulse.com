---
title: Should you prefix MCP tool names with the server name?
description: 10.6% of servers do. They collide less, not more — 14.6% zero-distinctive against 18.5% — and the cost is bytes rather than clarity.
published: 2026-09-18
topic: Tool design
minutes: 5
---

`Gmail_SendEmail` or `send_email`? The argument against prefixing is that the prefix is on every tool, so it cannot distinguish any of them — you are paying for a word that does no work.

That argument is correct about the mechanism and wrong about the outcome. We measured it.

## Who prefixes

Across 4,749 public servers, **10.6% put the server's own name at the front of more than 80% of their tools** — 487 of the 4,593 with enough tools to tell.

So it is a minority practice, and a clearly deliberate one when it happens: nobody prefixes 80% of their tools by accident.

## Prefixed servers collide less

Comparing servers with at least four tools:

| | Servers | Tools | Zero-distinctive | Nothing unique in name **or** description |
|---|---|---|---|---|
| Prefixed | 373 | 6,542 | **14.6%** | **0.23%** |
| Not prefixed | 3,052 | 68,829 | 18.5% | **2.08%** |

Prefixed servers are better on both, and the second column is the striking one: **0.23% against 2.08%**, a factor of nine.

That last measure is the one that matters most. It counts tools where the description has nothing distinctive *and* the name has nothing distinctive either — the tools a model genuinely cannot tell apart by reading. Prefixed servers have almost none.

## Why the intuition was wrong

Because a prefix *adds* a shared token without *removing* the unique ones.

`gmail_send_email` splits into `gmail`, `send`, `email`. The `gmail` is shared with all 40 sibling tools and contributes nothing. But `send` and `email` are exactly as distinctive as they would have been in `send_email`. You have not diluted the name — you have appended to it.

Compare that to [a shared description preamble](/blog/shared-tool-preambles), which genuinely does dilute: distinctiveness is measured as a *share* of a description's words, so adding 112 identical words to every description drops the share fivefold. A name is not scored as a share, so a prefix costs it nothing.

**And there is almost certainly a selection effect on top.** Somebody who systematically prefixes 80% of their tool names is someone who thought about naming. The 14.6%-versus-18.5% gap is probably mostly that, not the prefix itself. We cannot separate the two from this data, and we are not going to pretend the prefix caused it.

## What it does cost

Bytes, and only bytes.

A 7-character prefix on 40 tools is 280 characters of `tools/list` — about 70 tokens, [sent on every connection](/blog/what-your-tool-list-costs). Against a median server's ~1,250 tokens that is around 5%, for nothing the model can use.

On a large server it compounds: 318 tools × a 9-character prefix is roughly 700 tokens per connection of pure repetition.

So the trade is real but small, and it is the opposite shape to what people fear: you are buying namespacing with tokens, not with clarity.

## When to do it

**Prefix if your tools will sit beside other servers' tools.** This is the real reason, and it has nothing to do with distinctiveness. A client connected to six servers shows the model one flat list, and `search` from your server next to `search` from someone else's is a genuine collision that no amount of good description fixes — because the model cannot see which server a tool came from in the name. `acme_search` is unambiguous in a way `search` is not.

That is also why the practice concentrates where it does: servers built for multi-server setups prefix, single-purpose servers do not.

**Do not prefix if the tool count is large.** Past a few hundred tools the token cost stops being rounding, and a client loading one large server is unlikely to be loading five others alongside it.

**Never prefix twice.** One server in the corpus ships `ossgems.gems.list` — namespaced by a scheme that was then namespaced again. That is [also one of the nine servers with a duplicate tool name](/blog/duplicate-tool-names), which is not a coincidence.

## What this cannot tell you

We cannot separate the prefix from the author. Prefixing correlates with lower collision rates, and the most likely explanation is that deliberate namers are deliberate about everything else too. Nothing here says prefixing *causes* the improvement.

Our detection is a string match: a server counts as prefixing when over 80% of its tool names begin with the first six characters of its own name. That misses servers whose prefix is a product name unrelated to the registry slug, so 10.6% is a floor.

And we never ran a model, so the multi-server-collision argument above — the actual reason to prefix — is reasoning, not measurement. Measuring it needs two servers connected at once, which this corpus cannot see.

## Measuring your own

[The schema checker](/check) scores the tools of one server against each other, which is the single-server case. The cross-server collision that motivates prefixing is not something a schema check can see — it depends on what else the client has loaded.

Data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
