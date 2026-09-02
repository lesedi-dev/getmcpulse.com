---
title: Should you split a large MCP server?
description: A decision framework with the corpus data as the input. Under fifteen tools the answer is no. Past sixty it is probably yes, and rewording will not save you.
published: 2026-09-30
topic: Tool design
minutes: 6
---

"Split the server" is the standard advice when a model keeps picking the wrong tool. It is sometimes right and frequently premature, and the corpus is specific enough to say which.

The variable that matters is your tool count, because one failure mode scales with it and the other does not.

## The number that decides it

Across 4,749 public MCP servers, the share of tools with no word distinguishing them from a sibling:

| Tools on the server | Servers | Colliding tools |
|---|---|---|
| 1–3 | 1,193 | **0.5%** |
| 4–7 | 1,257 | **1.6%** |
| 8–15 | 1,013 | **4.4%** |
| 16–30 | 738 | **7.6%** |
| 31–60 | 350 | **16.6%** |
| 61+ | 198 | **32.4%** |

A factor of sixty-five, monotonic. Note where it accelerates: 7.6% to 16.6% between the fourth and fifth buckets, then doubling again.

Now the other main fault, [undescribed parameters](/blog/21-percent-of-parameters), by the same buckets: 15.2%, 22.4%, 21.9%, 24.8%, 21.4%, 20.1%.

Flat. **Splitting a server does nothing for that one**, because it was never about size.

## The framework

**Under 15 tools — no.** Collisions sit at 4.4% or below, which on a ten-tool server is fewer than one tool. If a model is picking wrong here, the cause is an individual description or [an unfillable parameter](/blog/why-the-model-wont-call-your-tool), and splitting would cost you a breaking change to fix something structure is not causing.

**15 to 30 — no, but fix the descriptions.** 7.6%. Real, and cheaper to fix by rewriting two descriptions than by restructuring. This is the band where "split it" is most often premature advice.

**31 to 60 — maybe, and reword first.** 16.6%. Do the cheap thing first: rewrite the colliding descriptions to lead with the difference, and see whether the problem was prose. If two tools still collide after a genuine attempt, they collide because they *do* nearly the same thing, and no prose fixes that.

**Past 60 — probably yes.** 32.4%. At that size rewording is treating a symptom. You have enough tools that some genuinely overlap in function, and the structural problem needs a structural answer.

## Three alternatives, cheaper than splitting

Splitting is a breaking change for everyone who has already installed your server. Try these first.

**Collapse near-identical tools into one with a mode parameter.** If `list_open_orders`, `list_shipped_orders` and `list_cancelled_orders` collide, they are one tool with a `status` enum. Three colliding tools become one distinctive tool, your schema shrinks, and the model gets a constrained choice instead of an ambiguous one. This is the highest-value move available and it is not a split.

**Delete the dead ones.** [A tool nobody calls](/blog/dead-tools) still costs schema tokens on every session and still competes for attention. Every deletion reduces your tool count and your collision surface at once, with no downside at all.

**Cut the shared preamble.** If the same sentence is on every tool, it distinguishes nothing while inflating every description — [one server repeats 112 identical words across 193 tools](/blog/shared-tool-preambles), which is 81% of every description. Removing it can move your distinctive share substantially without touching a single tool.

Do all three before splitting. It is common for a 70-tool server to become a 45-tool server this way, which moves you a whole bucket.

## If you do split

**Split on what a user asks for, not on your internal architecture.** Two servers named after your service boundaries will still have overlapping tools, because the overlap follows the vocabulary, not the code. Split so that each server's tools share as few *words* as possible.

**Expect the client to flatten them anyway.** A client connected to three of your servers shows the model one list. You have reduced each server's internal collisions and not necessarily the model's actual choice set — which is [the real argument for prefixing tool names](/blog/should-you-prefix-tool-names).

**Consider the discovery pattern instead.** The largest server in the corpus — 2,530 tools — ships a tool called `discover_tools` alongside four general entry points. That is a third option: keep one server, put a small set of general tools in front of a large specific set. It is roughly what the protocol's own tool-search work does.

## What this cannot tell you

The thresholds above are collision rates, not error rates. We never ran a model against any of these servers, so nothing here says a 61+ tool server actually picks wrong a third of the time — only that a third of its tools have nothing in their prose to distinguish them.

And [89.6% of colliding tools still have a distinctive *name*](/blog/why-models-pick-the-wrong-tool), which means most collisions make the name load-bearing rather than making the tool unpickable. That materially weakens the case for splitting on collision data alone, and it is the honest caveat on this entire post.

The number that would settle it — how much a collision costs in real tool selection — needs a model in the loop, and that study has not been run.

## Measuring where you sit

[The schema checker](/check) reports your collision rate against the bucket your tool count actually falls in, which is the comparison this decision needs — a corpus average tells a twelve-tool server nothing. It also names the sibling each colliding tool is hardest to tell apart from, which is the list you would work through before deciding to split.

Runs in your browser, nothing uploaded. Data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
