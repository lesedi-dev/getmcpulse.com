---
title: Almost nobody duplicates MCP tool names
description: 9 servers out of 4,749 ship a duplicate tool name — 0.19%, and only 16 duplicated entries in the whole corpus. If this is on your review checklist, take it off.
published: 2026-09-09
topic: Tool design
minutes: 4
---

This is a negative result, and it is worth publishing for exactly that reason: it saves you a check.

Across 4,749 public MCP servers and 82,549 tools, **9 servers ship a duplicate tool name.** That is 0.19%. In total there are **16 duplicated entries** in the entire corpus.

## Who does it

| Server | Tools | Duplicated |
|---|---|---|
| `srotzin-adqm/hiveagent` | 1,515 | `procurement_evaluate_bids`, `logistics_track`, `energy_dashboard` |
| `emblemai/emblem-mcp` | 133 | `getPolyMarketEvents`, `getPolyMarketEventsByTag`, `getPolyMarketTags` |
| `mario-andreschak/mcp-abap-abap-adt` | 128 | `createTestInclude` |
| `binalyze/air-mcp` | 117 | `get_repository_by_id` |
| `GigaChatTester/lichess-mcp` | 90 | `create_challenge`, `send_message` |
| `tech-xc0i/nomad-stays` | 73 | `getStaysByAmenities` |
| `mirajmahmudul57/agentdevx` | 58 | `acme-mailer.send_email` |
| `thecrazygm/entropy-rip` | 47 | `financial_whales_watch` (×3) |
| `ken0329ichi/oss-gems` | 7 | `ossgems.gems.list` |

Notice the tool counts. Eight of the nine are large servers — 47 tools and up, one at 1,515. Only one has fewer than forty.

That is the shape of a generation bug, not an authoring mistake. Nobody hand-writes 1,515 tools and accidentally types the same name twice; a loop over an API spec with a naming collision does exactly this. The one small case, `oss-gems` with 7 tools and a dotted name, looks like a namespacing scheme applied twice.

## Why it barely happens

Because the tooling makes it hard. `registerTool` on the official SDKs is a keyed operation — register the same name twice and the second one replaces or rejects, depending on the SDK. You have to be assembling the tool list dynamically to get a duplicate past that, which is why the servers that manage it are the ones building tools in a loop.

And when it does happen, the failure is not subtle in the way schema problems usually are. One of the two tools is unreachable. Whichever the client's map keeps, the other cannot be called at all — so it reads as a dead tool with a working implementation, and the symptom points somewhere else entirely.

## What this means for your checklist

**Take it off.** If you are reviewing an MCP schema and checking for duplicate names, you are spending attention on a 0.19% event.

Spend it on these instead, from the same corpus:

| Check | Rate |
|---|---|
| Duplicate tool names | **0.19%** |
| Tools with no description | 0.4% |
| [Tools with nothing distinguishing them from a sibling](/blog/why-models-pick-the-wrong-tool) | **17.6%** |
| [Parameters with no description](/blog/21-percent-of-parameters) | **21.5%** |

Two of those are a hundred times more likely than the thing people worry about. The undescribed-parameter rate alone is 113 times the duplicate-name rate.

**Unless you generate your tool list.** Then it is worth one assertion, because you are in the population where it actually occurs, and it is a single line:

```ts
const names = new Set<string>();
for (const tool of tools) {
  if (names.has(tool.name)) throw new Error(`duplicate tool: ${tool.name}`);
  names.add(tool.name);
}
```

That is the whole check. It costs nothing to run at startup and it converts an unreachable tool into a failed boot, which is the right trade.

## What this cannot tell you

The registry we drew from stores a `tools/list` response, and if a server's own response already collapsed a duplicate before it was stored, we would not see it. So 0.19% is a floor on what servers *emit*, not necessarily on what authors *write* — the SDK may be quietly fixing some of these before they reach anyone.

That caveat cuts in a reassuring direction, though. It means the observable rate is low *and* the tooling is catching some of what would otherwise be low.

We also cannot see which of the two duplicates a client ends up calling, because that is a property of the client's map and not of the schema.

## Measuring your own

[The schema checker](/check) reports duplicate names if you have any, alongside the things that are a hundred times more likely. It runs in your browser and nothing is uploaded.

The full survey is [here](/blog/reading-5000-mcp-schemas), and the data is in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
