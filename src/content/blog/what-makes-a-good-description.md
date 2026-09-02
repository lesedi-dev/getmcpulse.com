---
title: What makes a good MCP tool description?
description: Length is not the answer. Across 75,914 tools the correlation between description length and distinctiveness is +0.034 — statistically nothing.
published: 2026-09-16
topic: Tool design
minutes: 6
---

Advice about tool descriptions usually reduces to "write more". We can test that, because we have 82,549 of them.

**It is wrong.** The correlation between how long a description is and how much of it distinguishes the tool from its siblings is **+0.034** across 75,914 tools. That is not a weak relationship, it is the absence of one.

## The measurement

For each tool, its **distinctive share** is the fraction of its content words appearing in no other tool's description on the same server. That is what a model can actually use to choose.

Grouped by how many content words the description contains:

| Content words | Tools | Median distinctive share |
|---|---|---|
| 4–7 | 12,920 | **20%** |
| 8–15 | 20,882 | **27%** |
| 16–30 | 22,774 | **25%** |
| 31–60 | 14,071 | **25%** |
| 61+ | 5,267 | **30%** |

Flat, between 20% and 30% everywhere. The very shortest descriptions are slightly worse and the very longest slightly better, and in between there is no signal at all. Tripling your word count from 15 to 45 buys you nothing measurable.

Which makes sense once stated: a longer description adds distinctive words *and* shared words in roughly the same proportion. You cannot out-write a collision by volume.

## What zero looks like

The worst descriptions in the corpus are not bad writing. They are good writing about the wrong thing:

```
todoist_get_personal_labels   "Get all personal labels from Todoist"
todoist_delete_task           "Delete one or more tasks from Todoist"
create_dashboard              "Create a new dashboard in Metabase"
```

Each is accurate, grammatical and appropriately brief. Each is also built entirely from words its siblings use — *get*, *delete*, *create*, *task*, *label*, *dashboard*, and the product name on every single tool. The description restates the tool name in a sentence.

That is the actual failure mode, and it is not laziness. It is answering "what does this tool do?" when the model's question is "which of these tools do I want?"

## What 100% looks like

The tools whose every content word is unique on their server:

```
get_usage          "Return API usage history. Dates in YYYY-MM-DD format."

get_session        "Get one session's full detail, including its action log."

autosearch_verify_doi
                   "Verify a DOI via Crossref. Returns validity, title,
                    authors, year, journal."

betterpost_get_usage
                   "Demo generations remaining, or paid credit balance
                    + recent spend."
```

Look at what those have in common, because it is not length — three of the four are under fifteen words.

**They name specifics.** `YYYY-MM-DD`. `Crossref`. `action log`. `paid credit balance`. Specifics are distinctive by construction: no sibling tool needs the word *Crossref*.

**They say what comes back.** "Returns validity, title, authors, year, journal" — the return shape is the single most distinguishing thing about a read-only tool, and almost nobody writes it. Two tools that both "search articles" are indistinguishable; one that returns DOIs and one that returns full text are not.

**They do not restate the name.** `get_session` does not say "gets a session". It says *including its action log* — the part you could not have guessed.

## Four things that actually work

**Name the return shape.** What fields, what units, what happens when there is nothing. This is the highest-value sentence you can add and the rarest in the corpus.

**Include one specific.** A format, an upstream service, a limit, an identifier type. One concrete noun is worth a sentence of category description, and it is automatically unique.

**Say what the neighbouring tool is for.** "Use `search_threads` for cross-message queries" costs eight words and separates two tools at once — and it is information the reader cannot get by reading either tool alone.

**Delete the words your other tools use.** Read the whole list at once and strike every word that appears twice. What survives is your actual description; if nothing survives, that is the finding.

And the thing not to do: **do not pad.** The 61+ word bucket is only 5 points more distinctive than the 8–15 bucket, and every one of those words is [paid for on every connection](/blog/what-your-tool-list-costs). A 15-word description at 27% distinctive is a better trade than a 60-word one at 25%.

## What this cannot tell you

Distinctiveness is not quality. A description could be 100% distinctive and wrong, or misleading, or describe a tool that does not do what it says — none of which we can see.

And we never ran a model, so "distinctive" is a property of the text, not a measured improvement in tool selection. It is plausible that a model reading `create_dashboard` picks correctly every time from the name alone; [89.6% of zero-distinctive tools do still have a unique word in the name](/blog/why-models-pick-the-wrong-tool).

The +0.034 correlation is on tools with at least five content words, on servers with at least four tools. Both floors are there because the measure is undefined or trivial below them.

## Measuring your own

[The schema checker](/check) prints each of your descriptions with every word your other tools also use marked. The unmarked words are your real description — which is a faster read than any advice in this post.

Runs in your browser, nothing uploaded. Data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
