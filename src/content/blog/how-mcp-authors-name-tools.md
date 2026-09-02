---
title: How MCP authors name tools — get, list, search
description: Only 33.4% of 82,549 tool names start with a common verb. get alone is 15.6%, and 12,892 tools begin with it — which is where the collisions live.
published: 2026-09-17
topic: Tool design
minutes: 5
---

The tool name is doing more work than most authors realise. When [a description collides with a sibling's — 17.7% of the time — the name is what actually distinguishes the tool](/blog/why-models-pick-the-wrong-tool), in 89.6% of those cases.

So it is worth knowing what everyone is naming things. We counted the first token of all 82,549 tool names across 4,749 public servers.

## The leading words

| First token | Tools | Share |
|---|---|---|
| `get` | **12,892** | **15.6%** |
| `list` | 4,591 | 5.6% |
| `create` | 2,192 | 2.7% |
| `search` | 2,174 | 2.6% |
| `update` | 1,434 | 1.7% |
| `delete` | 1,201 | 1.5% |

And the total: **only 33.4% of tool names start with a common verb at all.** Two-thirds begin with something else — a noun, a product name, a namespace.

`get` is four times more common than any other verb and nearly three times `list`. One tool in six on the entire public corpus begins with those three letters.

## Where that hurts

A shared first token is a word that cannot distinguish anything. If 318 tools on one server begin with `get` — which is [exactly the case on the 2,530-tool server](/blog/the-2530-tool-server) — then `get` is doing no work on any of them, and whatever separates them is in the rest of the name.

That is fine when the rest of the name is specific. It stops being fine when the verb was carrying the meaning:

```
get_user      vs   fetch_user
list_orders   vs   search_orders
```

The first pair is a genuine problem — *get* and *fetch* mean the same thing in English and nothing in the names says which one to use. The second pair is fine: *list* returns everything, *search* takes a query, and those are different operations that a model can tell apart.

**So the rule is not "avoid `get`".** It is that a verb has to name a distinct operation, not a synonym of a neighbour's.

## The verbs that fight each other

Four pairs worth checking, because each is two words for one idea:

| | | |
|---|---|---|
| `get` / `fetch` / `read` / `retrieve` | four words | one operation |
| `list` / `getAll` / `index` | three words | one operation |
| `search` / `query` / `find` / `lookup` | four words | one operation |
| `delete` / `remove` / `destroy` | three words | one operation |

If two of your tools use two words from the same row and do different things, the difference is invisible from the name. `search_orders` and `query_orders` on the same server is a coin flip.

Pick one word per operation and use it everywhere. Which one barely matters — what matters is that the second word is not also in your list meaning the same thing.

## The two-thirds that are not verbs

The more interesting finding is what the other 66.6% start with. Look at the tail of the frequency table:

```
openfinance   1,062 tools
mf            1,052 tools
```

Those are not verbs, they are namespaces — one server's prefix appearing on every one of its tools. That pattern is common enough to show up in the corpus-wide top ten, which tells you how many authors are namespacing rather than verbing.

It also means a large minority of names are structured `<domain>_<verb>_<noun>` rather than `<verb>_<noun>`, and that changes what the first token buys you: nothing, on that server. Whether that costs anything is [its own question, and the answer is mildly surprising](/blog/should-you-prefix-tool-names).

## What to do

**Use a verb, and use the same one for the same operation.** Two-thirds of the corpus does not lead with a verb, which is a missed chance: a verb-first name tells a model what kind of thing this is before it reads the noun.

**Never ship two synonyms.** `get` and `fetch` on one server is the cheapest avoidable ambiguity there is, and grepping your own tool list for the four rows above takes a minute.

**Make the noun carry the specificity.** `get` is 15.6% of the corpus and will never distinguish anything. `get_invoice_pdf` distinguishes itself on `invoice_pdf`, and that is where the effort belongs.

**Check the name is load-bearing before you rely on it.** If your descriptions collide, the name is choosing — so a name built from `get` plus a shared noun leaves nothing choosing at all. That is the 10.4% case: [1,505 tools in the corpus have nothing unique in the name *or* the description](/blog/why-models-pick-the-wrong-tool).

## What this cannot tell you

We split names on `_`, `.`, `-` and camelCase boundaries and took the first token. That mislabels a few — a tool called `getting_started` counts as `getting`, and a namespace that happens to be a verb counts as a verb.

More importantly, we never ran a model, so nothing here measures whether `get` versus `fetch` actually causes a wrong call. The mechanism is arithmetic — a shared token distinguishes nothing — but the cost is not measured.

## Measuring your own

[The schema checker](/check) reports which of your tools have nothing to tell them apart, and names the sibling each one collides with — which is the fastest way to find a synonym pair you did not know you had.

Data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
