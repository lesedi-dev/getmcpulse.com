---
title: Why the model won't call your tool
description: Six causes, ordered by how often they turn up in a corpus of 4,749 servers. Start with the one that is 17.7% likely, not the one that feels most plausible.
published: 2026-09-26
topic: Tool design
minutes: 7
---

Your tool is registered. It appears in `tools/list`. The model never calls it, or calls a different one instead.

There are six reasons this happens. They are not equally likely, and the instinct — assume the description needs to be better — is right about a third of the time. Here they are in order of how often they turn up across 4,749 public MCP servers.

## 1. Another tool is winning a competition you cannot see

**Most likely.** [17.7% of public tools have a description containing no word that distinguishes them from a sibling.](/blog/why-models-pick-the-wrong-tool) On servers with more than sixty tools it is 32.4%.

The tell is that a *neighbouring* tool gets called instead of yours, consistently. Not randomly — the same substitution every time.

**How to check.** Print your whole tool list and read your tool's description next to the one that keeps getting called. If you can swap the two descriptions and both still read correctly, the model has nothing to choose on.

**The fix.** Lead with the difference, not the category. "Search orders" describes four of your tools; "Search orders by customer, including cancelled ones" describes one. Naming the return shape is the single most distinguishing sentence available and almost nobody writes it.

## 2. The parameters are unfillable

**Second most likely**, and the one people check last. [21.5% of parameters across the corpus have no description at all.](/blog/21-percent-of-parameters)

A model that cannot work out what to put in a required field will avoid the tool rather than guess. This looks identical to a description problem from outside, and it is not.

The clearest version:

```
fetch    id, document_id      (neither described)
```

A model has to pick one and nothing tells it which, or whether they differ. So it picks a different tool.

**How to check.** Cover the parameter *names* and look only at types and descriptions. If you could not supply a value, neither can the model.

**Watch for the internal identifier specifically.** A tool requiring a `warehouse_id` is unreachable from a conversation where nobody has ever seen a warehouse ID. That is not a description problem — it is a tool that needs a lookup step before it, or a name-based alternative.

## 3. The name is doing all the work and losing

When descriptions collide, [the name is what decides — in 89.6% of collision cases](/blog/why-models-pick-the-wrong-tool). So a colliding description plus a generic name is the case where nothing is choosing at all.

`get` leads **15.6%** of all public tool names. If your tool is `get_thing` and a sibling is `fetch_thing`, those are synonyms in English and the model is guessing.

**The fix.** One verb per operation, across the whole server. Never ship two words from the same row: `get`/`fetch`/`read`/`retrieve`, `list`/`getAll`, `search`/`query`/`find`, `delete`/`remove`.

## 4. Your tool list is too long to hold

Schema goes into the context window on every connection. [The median server spends about 1,251 tokens; the 90th percentile spends 7,992.](/blog/what-your-tool-list-costs) The largest in the corpus spends around 216,000 — which does not fit a 200K window at all.

The failure here is not that your tool is badly described. It is that it is the fortieth candidate in a list the model is skimming, and attention is finite.

**How to check.** Count your tools. Under fifteen, this is not your problem. Past thirty, [it is probably your main one](/blog/should-you-split-a-large-mcp-server).

## 5. A closed set was written in prose

The model sends `"Direct"` where you accept `"direct"`, your server rejects it, and from the model's side that reads as a broken tool rather than a fixable mistake — so it stops trying.

[857 parameters in the corpus](/blog/valid-values-open-string) name their valid values in the description and leave the schema as an open string. Moving them into an `enum` is one line.

**The tell for this one is distinctive:** the tool *does* get called, once, and then never again in that session.

## 6. It is actually unreachable

Two rarer causes worth ruling out.

**A duplicate tool name.** [Only 0.19% of servers](/blog/duplicate-tool-names) — nine in the whole corpus — but when it happens, one of the two tools cannot be called at all, and the symptom points somewhere else entirely. Almost always a generated tool list. One assertion in CI catches it forever.

**The tool is not in the response you think it is.** Servers that build their list conditionally can emit something different from what the code appears to register. Read the real `tools/list` output rather than the registration code.

## The order to actually work through

1. Read your whole tool list as one block. Which tool would *you* pick? — catches causes 1 and 3.
2. Cover the parameter names, read only types and descriptions — catches cause 2.
3. Count your tools — catches cause 4.
4. Grep descriptions for `valid values` / `options:` — catches cause 5.
5. Assert unique names in CI — catches cause 6.

That is fifteen minutes and it covers all six.

## What none of this can tell you

Every cause above is a property of your schema, and this is the honest limit: we have never observed a model choosing a tool on any of these servers. The rates say how often each pattern *exists*, not how often it costs you a call.

It is entirely possible your tool is skipped for a reason no schema shows — the client truncates long lists, the model was mid-task, the user phrased something unusually. Distinguishing those from the six above needs data from inside your server: [which tools get called, which get retried, which return empty](/blog/first-call-success). A schema check is what you can do before you have any of that.

## Checking the first five at once

[The schema checker](/check) tests causes 1, 2, 3, 5 and 6 on a paste of your `tools/list`, scored against servers your own size. It names the sibling each colliding tool is hardest to tell apart from — which for cause 1 is usually the whole answer.

Runs in your browser, nothing uploaded.
