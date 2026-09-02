---
title: The MCP server that ships 2,530 tools
description: 866KB of schema, about 216,000 tokens on every connection, and every single tool carries a description. 34.3% of its parameters do not.
published: 2026-09-15
topic: Measurement
minutes: 5
---

The largest server in our corpus of 4,749 public MCP servers publishes **2,530 tools**. The median publishes 7.

It is worth a whole post because it is not simply the biggest instance of a normal thing. At that size the failures change character, and several of them are the opposite of what you would guess.

## The numbers

`pipeworx/gateway`. Everything below is measured from its `tools/list` response.

| | |
|---|---|
| Tools | **2,530** |
| Schema size | 866,091 bytes |
| ≈ Tokens on every connection | **~216,000** |
| Parameters | 5,971 |
| Median parameters per tool | 2 |
| Most on any one tool | 15 |
| Tools with no description | **0** |
| Parameters with no description | **34.3%** |

The next largest servers are 1,515, 1,279, 1,278 and 1,052 tools, so this is not a lone outlier — there is a whole population up here.

## What it does well, and it is not what you expect

**Every one of its 2,530 tools has a description.** Not one is missing. Corpus-wide, 0.4% of tools lack one, so at this scale that is a real achievement and it is clearly deliberate — you do not get 2,530 for 2,530 by hand.

The descriptions are also short. Mean length is 92 characters, about fifteen words. On a server this size that is the right instinct: 2,530 verbose descriptions would not fit in any context window.

**And its parameter count is disciplined.** A median of 2 and a maximum of 15, against a corpus median of 2 and a maximum of 136. Whoever built this resisted the temptation to expose every upstream field.

## What it does badly

**34.3% of its parameters have no description** — against 21.5% corpus-wide. So the server that described all 2,530 tools described only two-thirds of its arguments. That is [the corpus's most common asymmetry](/blog/21-percent-of-parameters) at an unusual scale: the tool descriptions were generated, and the parameter descriptions were not.

**Its tools collide.** This is the server where we found the corpus's cleanest collision:

```
ror_search               "Search organizations."
search_organizations     "Search organizations."
```

Two tools. Same server. Same sentence. Both correct. And at fifteen words per description across 2,530 tools drawn from overlapping domains, that is close to unavoidable — [servers with 61+ tools average 32.4% zero-distinctive](/blog/how-many-tools), and 2,530 is forty times past that threshold.

The name prefixes tell the same story. **318 of its tools begin with `get`**, 116 with `search`, 88 with `list`. Whatever distinguishes `get`-tool 41 from `get`-tool 290 is in the remainder of the name, because the description is fifteen words long.

## The 216,000 tokens

That is the number that changes what kind of thing this is.

**It does not fit a 200K context window.** The tool list alone exceeds it. Any client with a 200K window cannot load this server at all — not "loads it inefficiently", cannot load it.

On a 1M-token model it fits and costs about **$0.43 per connection** at Claude Sonnet 5 input pricing ($2.00/1M, the published rate at time of writing). A thousand sessions is **$432**, before anyone asks a question and whether or not a single tool is called.

## The tool that gives the game away

Among its 2,530 tools is one called **`discover_tools`**.

A server large enough to need a tool for finding its own tools has answered the design question itself. That is not a criticism of the author — it is a reasonable adaptation, and it is roughly what the protocol's own tool-search proposals do. But it means the tool list has stopped being a menu and become a database, and a menu is what `tools/list` is.

`ask_pipeworx`, `resolve_entity` and `compare_entities` sit alongside it — a small set of general entry points in front of a very large set of specific ones. If you are heading past a few hundred tools, that shape is probably where you end up, and it is worth choosing rather than arriving at.

## What this cannot tell you

One server is one server. Nothing here says whether 2,530 tools works in practice, because we never ran a model against it — and it is entirely possible that `discover_tools` plus four general entry points makes the other 2,525 perfectly usable.

What we can say is what it costs to send, what fraction of its parameters a model must guess at, and that two of its tools are described identically. Whether that adds up to a bad server needs traffic, and traffic is the thing static analysis does not have.

Bytes are the `tools/list` payload with `outputSchema` excluded; tokens are bytes ÷ 4.

## Measuring your own

[The schema checker](/check) handles a list this size — it scores 5,000 tools in well under a second, and it runs in your browser so nothing is uploaded. If you are anywhere near this scale it will tell you which of your tools cannot be told apart, and from which sibling.

Data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
