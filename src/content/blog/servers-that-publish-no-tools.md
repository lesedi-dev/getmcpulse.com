---
title: Eight MCP servers publish no tools at all
description: They are listed, installable and reachable, and tools/list comes back empty. This figure was 13 until we deduplicated the corpus — a lesson in counting.
published: 2026-09-23
topic: Measurement
minutes: 4
---

Of 4,757 servers in our corpus that the registry had scanned successfully, **eight return an empty `tools` array.**

Not a failed scrape, not an unreachable host — a successful scan of a server that publishes nothing:

```
dhanyyudi/bmkg-id                      BMKG MCP
metavolve-labs/intelligence-aeternum   iAeternum
stockfilm/stockfilm-mcp                Stockfilm
spacemolt/gameserver                   SpaceMolt
compress-new/compress-tokens           Compress.new
kinescope/kinescope-mcp                Kinescope MCP Server
astranl/astranl-mcp                    AstraNL
hello-3ubk/booboooking                 booboooking
```

All eight are remote HTTP servers. All eight are listed in a public registry, with a display name, ready to install.

## Why it happens

We cannot see inside them, so this is inference from the shape.

**The tools are behind auth.** The most likely explanation for a remote server. The scanner connected without credentials, the server declined to enumerate, and returned an empty list rather than an error. From outside, "you may not see my tools" and "I have no tools" are the same response — which is a small protocol gap worth noticing.

**It was deployed before the tools existed.** A registry entry is cheap and a working server is not. Several of these look like placeholders.

**The tools are registered after a handshake the scanner did not complete.** A server that builds its tool list from a session, or from a config the client supplies, has nothing to report to a scanner that supplies neither.

## What it means if you are building a client

**An empty `tools/list` is not an error, and you have to handle it.** Eight servers in a public registry return one. A client that treats an empty array as a failure will report a broken server; one that treats it as a working server with nothing to offer will show the user an empty menu. Neither is quite right, and the protocol gives you nothing to distinguish "empty because auth" from "empty because empty".

If you are writing a server, that argues for returning an error when you cannot enumerate — an explicit refusal is more useful to a client than a truthful-looking empty list.

## The more interesting finding is about counting

This number was **13** in the published survey. It is 8.

The corpus double-counted servers: the collector revisited entries while paginating, so `tools.jsonl` held 5,123 rows for 4,894 distinct names. One of these eight — `dhanyyudi/bmkg-id` — was collected **four times**. `metavolve-labs` and `stockfilm` twice each. Thirteen rows, eight servers.

We checked the obvious alternative explanation and it is not that: none of the eight published tools in any other row. There was no successful scrape being masked by a failed one. The 13 was simply the same eight servers counted repeatedly.

That error ran through every figure in the survey, and it is worth being explicit about which way it cut:

| | Published | Corrected |
|---|---|---|
| Servers | 4,951 | **4,749** |
| Tools | 87,146 | **82,549** |
| Parameters | 270,487 | **257,287** |
| Popular pool | 465 | **263** |

The rates barely moved — undescribed parameters 21.8% → 21.5%, zero-distinctive tools 17.4% → 17.7% — which is exactly why it went unnoticed for a fortnight. Percentages are robust to a duplicate; counts are not. And the damage concentrated in one pool: the popular pool was overstated by 77%, while the long tail was clean.

Every figure across the survey and these posts has been recomputed, and the deduplication is in `load()` in `03_analyse.py` with the reasoning written down.

## The lesson we would rather have learned earlier

**Assert the invariant you are assuming.** We assumed one row per server because the collector was written to produce one row per server. Nothing checked it. The check is one line:

```python
assert len({r["qualifiedName"] for r in rows}) == len(rows)
```

That would have failed on the first run. Instead the number was published, and it took someone re-deriving figures from the raw corpus to notice that 5,123 rows contained 4,894 names.

If you publish data, the counting assumptions are the ones to test. A wrong rate looks wrong; a wrong count looks fine.

## What this cannot tell you

Whether these eight servers are broken, gated, or unfinished. We only see the response.

And the 4,757 above is servers the registry scanned successfully — separate from the 133 whose detail request failed and the 4 the registry had never scanned. Those are different kinds of absence and we cannot tell a gated server from a dead one in any of the three.

Data, and the corrected analysis, in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
