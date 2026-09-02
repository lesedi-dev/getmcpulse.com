---
title: What does your MCP tool list cost per connection?
description: The median public MCP server spends about 1,250 tokens of schema before anyone asks a question. The 90th percentile spends 7,992. One spends 286,000.
published: 2026-09-02
topic: Measurement
minutes: 6
---

Tool schemas are not free and they are not per-call. The whole of `tools/list` — every name, every description, every parameter, every bit of JSON Schema — goes into the context window at the start of every conversation, whether or not a single tool gets used.

That makes it a fixed cost per connection, which is an unusual shape. Most things you can optimise get cheaper when they are used less. This one does not.

We measured it across 4,749 public MCP servers.

## The distribution

| | Schema bytes | ≈ Tokens |
|---|---|---|
| Median server | 5,005 | **1,251** |
| 90th percentile | 31,968 | **7,992** |
| Largest in the corpus | 1,145,575 | **~286,000** |

Tokens are bytes ÷ 4 throughout — close enough to compare servers to each other, not exact enough for an invoice. Dense JSON tokenises a little worse than prose, so if anything these are slightly low.

The gap between the median and the p90 is the story. A factor of six and a half separates a typical server from a merely large one, and three more orders of magnitude separate that from the extreme.

## In money

Tokens are easier to reason about as a bill. At Claude Sonnet 5 input pricing — $2.00 per million tokens, the published rate at the time of writing — for **1,000 sessions**:

| | Tokens per session | 1,000 sessions | Cost |
|---|---|---|---|
| Median server | 1,251 | 1.2M | **$2.50** |
| 90th percentile | 7,992 | 8.2M | **$15.98** |
| Largest | ~286,000 | 286M | **$572.79** |

Redo that arithmetic with your own model's rate; the shape does not change.

$2.50 per thousand conversations is nothing. That is the point of showing the median first — for most servers this is not a cost problem and you should go and fix something else.

$15.98 is still not much in absolute terms. What makes it worth knowing is that **you pay it whether or not any tool is called.** A thousand sessions where the model never once reaches your server still costs $15.98 of schema on a p90 server. There is no other line in your bill with that property.

And $572 for a thousand conversations, before anyone has asked anything, is a different kind of number. That server publishes 2,530 tools.

## The part that is not money

The context window is the scarcer resource, and it is the reason to care at the median too.

286,000 tokens of schema does not fit in a 200K context window at all. At 7,992 tokens you have spent about 4% of a 200K window on a menu. That is affordable. What it competes with is not budget, it is attention: every tool in the list is another candidate the model weighs when deciding what to call, and the survey found that on servers with 61 or more tools, [32.4% of tools carry no word distinguishing them from a sibling](/blog/how-many-tools).

So a large tool list charges you twice. Once in tokens, and once in the model's ability to pick correctly from it. The second cost is the one you notice, and it arrives as "the model called the wrong tool" rather than as a bill.

## Where the bytes actually are

Worth knowing before optimising, because the intuitive answer is wrong.

The median tool has **2 parameters**; the mean is 3.1. Parameters are not where the weight is for a typical server. Neither are names.

It is descriptions, and it is tool count. Schema size scales with the number of tools far more than with the complexity of any one of them — which is the same variable that drives collisions. A 2,530-tool server is expensive for the same reason it is confusing.

The exception is the server with a shared preamble. One in the corpus appends the same 51-word block to all 275 of its tools — 14,025 words of the same sentence, in one `tools/list` response, sent on every connection. That block was added deliberately, to help. And 51 of every 59 words in a description are identical to the tool next to it, so it is paying a large fixed cost to make its tools *harder* to tell apart.

## Three things that reduce it

**Delete the tools nobody calls.** [A dead tool](/blog/dead-tools) costs full schema price on every session and returns nothing, because nobody has ever reached it. This is the only item on this list with no downside at all.

**Cut shared preambles.** If the same sentence appears on every tool, it is being paid for once per tool per session and buying nothing, because a word every tool has cannot distinguish any tool. Move it to the server's own description if the protocol surface allows, or delete it.

**Shorten descriptions, but not below distinctive.** This is where it gets careful. The advice "make descriptions shorter" and the advice "make descriptions distinctive" pull in opposite directions, and distinctiveness wins: a 60-token description that says what this tool does and the others do not is worth more than a 20-token one that could describe three of your tools. Cut the words your other tools also use. Keep the ones they do not.

Notice what is *not* on the list: don't cut parameter descriptions. At a median of two parameters per tool they are a small share of the bytes, and [21.5% of parameters across the corpus already have none](/blog/21-percent-of-parameters), which is the most common fault in the whole survey. Saving forty tokens by removing the one sentence that tells a model what to put in a field is not a trade worth making.

## What this cannot tell you

We measured schemas sitting still. We never observed a session, so nothing here tells you how many connections your server actually gets — which is the other half of any real cost figure. A p90 schema on a server nobody uses costs nothing.

Tokens are estimated at 4 bytes each rather than counted with a tokeniser, and the corpus comes from the [Smithery](https://smithery.ai) registry, so it inherits that registry's coverage.

And the numbers above are input pricing for one model on one date. They will move.

## Measuring your own

[The schema checker](/check) reports your schema in bytes and estimated tokens, against the corpus median and p90, alongside the collision and undescribed-parameter rates that come with it. It runs in your browser and nothing is uploaded.

For what a session costs once traffic is involved — schema plus arguments plus results, per conversation — that is [cost per session](/blog/cost-per-session), and it needs a server that is actually running.

Every figure here is in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
