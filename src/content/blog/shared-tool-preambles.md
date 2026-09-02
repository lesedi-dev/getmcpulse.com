---
title: Your shared tool preamble costs more than it buys
description: One server repeats the same 112 words at the start of all 193 of its tool descriptions. It was added to help. It is why its tools cannot be told apart.
published: 2026-09-04
topic: Tool design
minutes: 6
---

There is a pattern that shows up on large MCP servers, and it is always well-intentioned.

You notice the model needs context — a convention it keeps getting wrong, a warning about ordering, a note about which ID to use. So you add it to the tool description. And because it applies to every tool, you add it to every tool.

Across 4,749 public servers we found **35 servers where at least fifteen words are identical at the start or end of every single tool description.** Here is what happens at the extreme.

## 193 tools, 112 identical words

`krtr/krtr` publishes 193 tools. The mean description is 139 words. **The first 112 words are byte-identical on all 193 of them.**

```
If you haven't called `initiate_krtr` yet this session, CALL IT FIRST —
it primes you with KRTR's directive context (anti-hallucination, four
loops, your role, meta-tools, name addressing, rendering style). KRTR
data is authoritative — do NOT enrich from training or public
profiles; if a tool hasn't …
```

…and so on, for 112 words, before any tool says what it does.

What is left is the part that distinguishes one tool from another:

```
initiate_krtr     "REQUIRED FIRST STEP in every new KRTR session —
                   call BEFORE any other tool. Primes you with your
                   role, the playbook, meta-tools…"

get_first_moves   "Your top 3 next moves for your live state + role.
                   Call after initiate_krtr (not priming; not a full
                   list)."
```

Those two sentences are good. They are specific, they are different from each other, and they are 27 words out of 139.

**81% of every description on that server is the same 112 words.**

## Why this is worse than doing nothing

Three separate costs, and the third is the one that makes it backwards.

**It is paid per tool, per session.** 112 words × 193 tools is 21,616 words of identical text in one `tools/list` response, sent on every connection whether or not a tool is called. [Schema is a fixed cost per connection](/blog/what-your-tool-list-costs) — this is the largest avoidable instance of it we found.

**It dilutes the part that works.** The model reads 139 words per tool and 112 of them are shared. The distinguishing sentence is not missing, it is buried at a ratio of roughly one to five.

**And it is measured against you.** This is the mechanism, not a metaphor. A word that appears on every tool appears in *no tool uniquely*, so a preamble contributes exactly zero to distinguishing your tools — while making the denominator five times larger. A server with 20-word descriptions and 8 distinctive words is 40% distinctive. Add a 112-word preamble to all of them and it is 6%.

You have not added context to your tools. You have diluted the context that was already there, and paid for the privilege on every connection.

## The mid-size version

The extreme case is easy to dismiss. The common one is not.

`swonkie/swonkie-mcp` has 27 tools, mean description 75 words, **42 of them shared** — 56%. And the shared part is genuinely useful information about pagination and encrypted identifiers:

```
swonkie_profiles_list      "Lists connected social profiles for the
                            workspace (Public API GET /v2/profiles).
                            Supports pagination (skip, take ≤20)…"

swonkie_competitors_list   "Lists monitored competitor profiles
                            (GET /v2/competitors). Same pagination and
                            filters as swonkie_profiles_list…"
```

The second one is doing the right thing — it *references* the first rather than repeating it. That is the fix, applied inconsistently.

## What to do instead

**Put shared context where it is stated once.** The server's own description, or the top-level instructions if your transport carries them. Repeating it per tool is the only version that multiplies.

**Reference rather than repeat.** "Same pagination as `x`" is four words that do the work of forty, and it makes the relationship between the tools explicit — which is information the repeated version destroys.

**If it must be on the tool, put it last.** A preamble is read first and dilutes first. A postamble at least lets the distinguishing sentence lead.

**Measure the ratio, not the length.** Long descriptions are not the problem. A 200-word description with 150 distinctive words is excellent. A 139-word description with 27 is the thing to fix, and the two look identical from a word count.

## What this cannot tell you

We never ran a model against these servers, so we cannot say what a preamble costs in wrong calls. It is possible that a model reads the 112 words, internalises the convention, and picks correctly anyway — in which case the cost is only tokens.

What we can say is that the preamble contributes nothing to *distinguishing* the tools, because that is arithmetic rather than inference: a word on every tool is unique to none. Whether the convention it conveys is worth 21,616 repeated words is a judgement we cannot make from outside.

Our detection also only catches identical prefixes and suffixes. A shared block in the middle of a description, or one with a tool name interpolated into it, is invisible to this test — so 35 servers is a floor.

## Measuring your own

[The schema checker](/check) prints each flagged description with every word your other tools also use marked, which makes a preamble immediately obvious — the shared block lights up end to end and the distinguishing sentence is whatever is left unmarked.

Runs in your browser, nothing uploaded. The full survey is [here](/blog/reading-5000-mcp-schemas), and the data is in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
