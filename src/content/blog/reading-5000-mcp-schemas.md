---
title: We read the schemas of 4,951 public MCP servers
description: Not what models do with your tools — what they are handed first. 87,146 tools, 270,487 parameters, one tool in six with nothing to tell it from its neighbour.
published: 2026-08-31
topic: Tool design
minutes: 8
---

If you have built an MCP server, you have probably watched a model call the wrong tool, fill in a parameter you did not expect, or retry the same call three times before giving up. Your server was fine. The model just did not understand it.

We wanted to know how often the *schema* is the reason. So we pulled the tool definitions from 4,951 public MCP servers — 87,146 tools and 270,487 parameters — and read them the way a model has to: as a wall of JSON, with no documentation, no repository, and no idea what the author meant.

The short version: **one tool in six carries a description containing no word that distinguishes it from a sibling tool on the same server.** On servers with more than sixty tools, it is nearly one in three.

## What this is, and what it is not

This post is about what models are *given*. It is not about what they do with it.

We did not run a model against these servers. We never observed a tool selection, an argument, or a retry, so nothing here can tell you how often models actually get it wrong. Every number below is a property of a schema sitting still.

We are drawing that line hard because it is the line the interesting claim sits on. "A model has nothing to discriminate on" is a fact about a schema. "A model therefore picks wrong 30% of the time" is a fact about traffic, and we do not have it.

## How we did it

We took the tool schemas from the [Smithery](https://smithery.ai) registry, which stores the `tools/list` response for every server it has scanned — `inputSchema` included. That is byte-for-byte the JSON a model receives.

The obvious alternative was to boot each server in a container and call `tools/list` ourselves. We did not, and the reason is the finding underneath the method: a large share of public MCP servers will not start without real credentials. The set that boots cleanly on a machine with no API keys is not a random subset of anything, and we would have ended up with a few hundred servers selected for needing no secrets.

The registry's pagination caps at 500 results, so the corpus is two populations:

| Pool | Servers | What it is |
|---|---|---|
| Popular | 465 | The most-installed servers. Page one opens in the tens of thousands of installs. |
| Long tail | 4,486 | A union of a few hundred search terms — whatever else the registry will show us. |

Neither is a random sample. They are two *different* biases, which is the point of having both, and every figure below is reported for the combined set unless the two disagree.

Of 5,123 servers in the frame, 154 detail requests failed, 5 had never been scanned, and 13 published no tools at all. That leaves **4,951 servers** with schemas.

## The check that nearly ended the study

Before any of this counts for anything, one question has to be answered: does the registry hand back the schema the server actually serves?

We had reason to think it might not. Across the first 1,377 tools we collected, **not one** carried a top-level `required` array. Real MCP servers mark parameters required constantly. Either the corpus was extraordinary or something in the pipeline was dropping the field.

So we booted the four official reference servers locally — they need no credentials and no network — took their real `tools/list` over stdio, and diffed field by field.

| Field | Real server | Registry |
|---|---|---|
| `properties` | 9 | 9 |
| per-parameter `description` | 9 of 9 | 9 of 9 |
| tool `description` | present | present |
| `enum` | present | present |
| **top-level `required`** | **27 of 37 tools** | **0** |

Everything survives except `required`, which is stripped.

So this study measures nothing about required-versus-optional parameters. Not because the number would be unflattering — because it would be the registry's number rather than the servers'. If you are doing your own analysis on registry data, that field is not there, and it does not announce itself.

## 1. One parameter in five has no description at all

**59,038 of 270,487 parameters — 21.8% — ship with no `description`.** They appear on 33.7% of servers.

A parameter with no description is a parameter the model guesses at. It has the name, it has the type, and that is the entire brief. Sometimes the name carries it: `query` on a search tool is not mysterious. Often it does not — we found plenty of bare `id`, `type`, `mode` and `filter` parameters with nothing to say which of several plausible things they meant.

The striking part is the contrast with tool descriptions. Only **0.4%** of tools have no description. Authors describe the tool and forget the arguments — which is understandable, because the tool is the thing you are thinking about when you write it, and the arguments are the thing the model has to fill in.

Popular servers are slightly worse here than the long tail (28.2% against 20.8%), which is not what we expected and is discussed below.

## 2. One tool in six has nothing to tell it apart from its neighbour

This is the finding we would lead with.

For every tool, we took the content words in its description and asked how many appear in **no other tool's description on the same server**. Call it the tool's distinctive share.

- The median tool's description is **26% distinctive**. Three-quarters of the words it spends are words its siblings also use.
- **26.7% of tools are under 10% distinctive.**
- **17.4% of tools are exactly zero** — not one content word in the description is unique to that tool. **23.1% of servers have at least one.**

Zero does not mean the description is bad. Here are four from one widely-installed Gmail server:

```
Gmail_DeleteDraftEmail   "Delete a draft email using the Gmail API."
Gmail_SendDraftEmail     "Send a draft email using the Gmail API."
Gmail_ListLabels         "List all the labels in the user's mailbox."
Gmail_SearchThreads      "Search for threads in the user's mailbox."
```

Every one of those is clear, correct English. Every one is also built entirely from words the other tools use — *delete*, *draft*, *email*, *gmail*, *api*, *list*, *search*, *threads*, *mailbox* all recur across the set. The description tells you what the tool does. It does not tell you what this tool does **and the others do not**, and that second thing is the one a model needs when it is choosing.

The pattern that produces the most extreme cases is shared boilerplate. One server appends the same 51-word context block to all 275 of its tools:

```
3land_createCollection   "Create a new NFT collection on 3.Land marketplace.
                          SAP MCP context: Protocol 3land; operation class
                          write. Use for 3.Land NFT collection, minting,
                          listing, cancellation, and purchase flows…"

3land_buyNFT             "Purchase an NFT from a 3.Land listing.
                          SAP MCP context: Protocol 3land; operation class
                          write. Use for 3.Land NFT collection, minting,
                          listing, cancellation, and purchase flows…"
```

Creating a collection and buying one are not the same operation, and the opening sentence says so. It is also 8 words out of 59 — the other 51 are identical across both, and across all 275. That block was added deliberately, to help.

## 3. It gets worse the more tools you ship, and sharply

Splitting the corpus by how many tools a server publishes:

| Tools on the server | Servers | Parameters | No description | Zero-distinctive tools |
|---|---|---|---|---|
| 1–3 | 1,256 | 7,640 | 14.8% | **0.5%** |
| 4–7 | 1,292 | 19,410 | 22.4% | **1.6%** |
| 8–15 | 1,044 | 34,165 | 21.9% | **4.3%** |
| 16–30 | 767 | 52,716 | 24.8% | **7.7%** |
| 31–60 | 377 | 49,433 | 22.2% | **16.3%** |
| 61+ | 215 | 107,123 | 20.5% | **31.3%** |

Description collision rises monotonically and by a factor of sixty, from 0.5% on the smallest servers to 31.3% on the largest. Some of that is arithmetic — more tools means more chances for two to collide — but it is also the point at which authors start generating descriptions from a template, and a template is a machine for producing tools that read alike.

This is also what explains the popular-versus-long-tail gap in finding 1. Popular servers are simply bigger: a mean of 27.1 tools against 16.6.

**And notice the column that does not move.** Missing parameter descriptions sit between 20% and 25% at every size above the smallest bucket. It is not a scale problem; it is a habit, and a two-tool server has it about as much as a two-hundred-tool one. The two failures are independent, which means shipping fewer tools will not fix your undescribed parameters and writing better descriptions will not fix your collisions.

## 4. The median tool list costs about 1,250 tokens before anyone asks a question

Tool schemas are sent on every connection, whether or not a single tool gets called.

- Median server: **4,991 bytes**, roughly **1,250 tokens**.
- 90th percentile: **32,636 bytes**, roughly **8,200 tokens**.
- The largest in the corpus: **1,145,575 bytes** — on the order of 280,000 tokens of schema, from one server, before the conversation starts.

Median tools per server is 7 and the mean is 17.6, which tells you the distribution's shape on its own. One server publishes 2,530 tools.

## 5. Some parameters name their valid values and then do not enforce them

8.0% of all parameters carry an `enum`. The interesting question is how many *should*, and that is mostly unanswerable from a schema — you cannot tell from the outside that `status` accepts exactly three values.

What you *can* find is the case where the author wrote the values down in prose and left the schema as an open string:

```
delayed_option        "Controls per-user delivery timing.
                       Options: `\"timezone\"`, `\"last-active\"`."

outcome_attribution   "Attribution type for the outcomes.
                       Valid values: `\"direct\"`, `\"influenced\"`,
                       `\"unattributed\"`, `\"total\"`."

commitment            "Optional processed|confirmed|finalized commitment"
```

**895 parameters**, on **4.6% of servers**. That is 0.5% of all string parameters, and it is a floor rather than an estimate: it only catches authors who documented the set. A parameter whose closed set was never written down anywhere is invisible to this test.

It is a small number and we are reporting it small. Our first version of this measurement said 108 hits in a 40-server sample, which would have scaled to something far more dramatic — and it was wrong. It was matching text like `Filter by line (e.g. "1", "A", "F")`, which is an illustration, not a closed set. A station name is not an enum. Requiring explicit closed-set language *and* the absence of `e.g.`/`such as` took that sample from 108 to 9, and all nine were real.

One signal we expected to find and did not: **duplicate tool names within a server, on 0.2% of servers.** Effectively nobody does this. If it is on your review checklist, take it off.

## What we could not see

This is static analysis, and we never observed a single real request to any of these servers.

That means we missed everything that only shows up under traffic. The tool that works in isolation but gets called in the wrong order. The parameter that is fine until someone phrases a request unusually. The retry loop that only triggers on a specific error path. The description that reads perfectly to one model and ambiguously to another.

We also cannot tell you the thing you most want to know, which is how much of this matters. A zero-distinctive description might cost nothing when the tool name is unambiguous, and might cost a great deal when it is not. Distinguishing those needs a model in the loop, and then it needs real users, because production traffic is stranger than anything we would think to write.

Our guess is that real-world misuse is worse than what a schema can predict, in both directions: some of what we flagged is harmless, and some servers we scored as clean fail constantly for reasons no schema shows.

Three narrower caveats. We inherit Smithery's coverage and its scan freshness. Neither pool is a random sample. And `required` is not measured at all, for the reason above.

## If you maintain a server

Three things, ordered by how common the problem is in the data. None of them changes your server's behaviour — they are all changes to the text a model reads.

1. **Describe every parameter.** This is the most common gap by a distance: 21.8% of parameters, on a third of servers, and it does not get better at any size. If you do one thing, do this one.

2. **Make each description say what the others do not.** Not "is it clear" — *is it clear which of my tools this is*. Read your tool list as one block and ask what a reader with only that block would use to choose. If you have a shared preamble on every tool, it is buying you less than it costs; the distinguishing sentence should not be a seventh of the text.

3. **If you have more than about thirty tools, audit for collisions specifically.** Above that size, roughly one tool in six has no distinguishing word, rising to one in three past sixty. Splitting a large server, or collapsing near-identical tools into one with a mode parameter, does more than rewording.

## What we are building

We ran this because we are building [MCPulse](https://getmcpulse.com) — an SDK that runs inside your MCP server and reports what actually happens: which tools get retried, which return empty, where argument errors cluster, and how much your schemas cost per session.

Everything in this post came from outside the server, which is exactly its limit. A schema can tell you a model has nothing to choose on. Only traffic can tell you whether it chose wrong.

The follow-up is the model-in-the-loop pass: the same corpus, with a model actually selecting tools against generated requests, so the static signals here can be ranked by how well they predict a real mistake. That is the post that gets to use the word *misuse*.

The data and the analysis scripts are at [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study). Every figure above is in `analysis.json`, with the real servers, tools and parameters behind each one in `examples.json`, so you can check any number against the thing it came from. The collector rebuilds the whole corpus from a public API in about twenty minutes if you want to check that too. If we got something wrong, please tell us.
