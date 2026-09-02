---
title: Why models pick the wrong MCP tool
description: 17.6% of tools across 4,749 servers have no word setting them apart from a sibling. But 89.6% still have a distinctive name, which shrinks the claim and sharpens it.
published: 2026-09-03
topic: Tool design
minutes: 7
---

A model picks a tool by reading `tools/list`. That is the whole input: names, descriptions, parameter schemas. No documentation, no repository, no sense of what you meant.

So when it calls the wrong one, the first question is whether it had anything to go on. We can answer that from outside the server, and we did — across 4,749 public MCP servers and 82,549 tools.

## The measurement

For every tool, take the content words in its description and count how many appear in **no other tool's description on the same server**. That share is what a model has to discriminate on. Call it the distinctive share.

Across 82,097 tools on multi-tool servers:

| Distinctive share | Tools |
|---|---|
| Exactly 0% | **17.6%** |
| 10% or less | 27.6% |
| 20% or less | 43.0% |
| 30% or less | 56.0% |
| 50% or less | 80.5% |
| Median tool | **25%** |

The median tool spends three-quarters of its description on words its siblings also use. And one tool in six spends *all* of it.

## Zero does not mean badly written

This is the part that surprised us, and it is the reason the finding is about schemas rather than about authors.

Four tools from one widely-installed Gmail server:

```
Gmail_DeleteDraftEmail   "Delete a draft email using the Gmail API."
Gmail_SendDraftEmail     "Send a draft email using the Gmail API."
Gmail_ListLabels         "List all the labels in the user's mailbox."
Gmail_SearchThreads      "Search for threads in the user's mailbox."
```

Every one is clear, correct English. Every one is also built entirely from words the other tools use — *delete*, *draft*, *email*, *gmail*, *api*, *list*, *search*, *threads*, *mailbox* all recur across the set. The description tells you what the tool does. It does not tell you what this tool does **and the others do not**, and the second thing is what a choice requires.

The sharpest case in the corpus needs no server-specific vocabulary at all. Two tools, one server, 1.00 similarity by content words:

```
tool_markdown_to_html    "Convert Markdown to HTML."
tool_html_to_markdown    "Convert HTML to Markdown."
```

Those do opposite things. Both descriptions are perfect. As bags of words they are identical — *convert*, *markdown*, *html* — so word order is carrying the entire distinction, and word order is a thin thing to bet a tool call on.

Or, with no symmetry to excuse it:

```
ror_search               "Search organizations."
search_organizations     "Search organizations."
```

Same server. Same sentence. Two tools.

## The obvious objection, tested

Here is where we have to shrink our own claim, because the first thing anyone says is: *the name disambiguates it.* `tool_html_to_markdown` is a fairly clear name. Does the collision actually matter?

So we measured it. Of the 14,437 tools with a zero-distinctive description, we checked whether the **name** still contains a word unique on that server.

**89.6% do.** 12,932 of them.

Which means for nearly nine in ten of these tools, the model is not without information — it is relying entirely on the name, with the description contributing nothing to the choice. That is a weaker claim than "the model has nothing to go on", and it is the true one.

**1,505 tools — 10.2% of the zero-distinctive set, 1.8% of the corpus — have nothing unique in the name or the description.** Those are the ones where a model genuinely cannot distinguish the tool by reading. On a corpus of 82,549 tools, that is still fifteen hundred tools that are unpickable on their text.

We think the honest framing is this: a colliding description does not usually make a tool unpickable, it makes the tool's **name** load-bearing. That is fine when the name is good and a silent failure mode when it is not — and nothing warns you which case you are in.

## Where it concentrates

Collision is a function of size, sharply. By tool count:

| Tools on the server | Zero-distinctive |
|---|---|
| 1–3 | 0.5% |
| 4–7 | 1.6% |
| 8–15 | 4.4% |
| 16–30 | 7.6% |
| 31–60 | 16.6% |
| 61+ | **32.4%** |

A factor of sixty-three. [The size question gets its own post](/blog/how-many-tools), but the summary is that past about thirty tools this becomes the dominant risk on your server, and past sixty you should assume it is happening.

22.8% of all servers have at least one zero-distinctive tool.

## What to do about it

**Read your tool list as one block.** Not tool by tool — that is how it got this way. Print the whole `tools/list` response and ask what a reader with only that block would use to choose. Every word that appears twice is a word doing no work.

**Spend the first sentence on the difference, not the category.** "Delete a draft email using the Gmail API" leads with the category. "Permanently removes an unsent draft; will not touch a sent message" leads with what makes it *this* tool.

**Treat a shared preamble as a cost.** If the same sentence is on every tool, it cannot distinguish any tool, and it is being paid for once per tool per session. [That has its own post too](/blog/shared-tool-preambles) — one server in the corpus repeats 112 identical words across 193 tools.

**Do not lean on the name by accident.** If your descriptions collide, the name is what is choosing. Make that a decision rather than a discovery.

## What this cannot tell you

We never ran a model against any of these servers. Not one tool selection was observed.

So "a model has nothing in the description to discriminate on" is a fact about a schema, and "a model therefore picks wrong N% of the time" is a fact about traffic that we do not have. The 89.6% finding above is exactly why that distinction matters: the naive version of this result overstates the problem by roughly nine times.

Which of these signals actually predicts a mistake — and by how much — needs a model in the loop against generated requests. That is the follow-up study, and it is the post that gets to use the word *misuse*.

The corpus comes from the [Smithery](https://smithery.ai) registry and inherits its coverage; neither of its pools is a random sample.

## Measuring your own

[The schema checker](/check) runs this test on your server: your zero-distinctive tools, your median distinctive share, the sibling each flagged tool is hardest to tell apart from, and your own descriptions printed with every shared word marked so you can see which words are load-bearing. Scored against servers your size, not the corpus average.

Runs in your browser, nothing uploaded. Every figure is in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
