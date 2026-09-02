---
title: The Smithery registry strips required from stored schemas
description: Zero of 82,549 stored tools carry a top-level required array. 2,064 nested objects still carry theirs, which narrows the cause considerably.
published: 2026-10-02
topic: Engineering
minutes: 5
draft: true
---

If you are analysing MCP tool schemas from the [Smithery](https://smithery.ai) registry, one field is not there, and it does not announce itself: the top-level `required` array on `inputSchema`.

**Zero of the 82,549 stored tools in our corpus carry one.** Not a low number — none.

## How we found it

We were building a survey of public tool schemas and had collected 1,377 tools when a sanity check failed. Not one of them marked a parameter required.

Real MCP servers do this constantly. Either the corpus was extraordinary or something in the pipeline was dropping the field, and there is no way to tell which from the data alone.

So we booted the four official reference servers locally — `filesystem`, `memory`, `everything` and `sequential-thinking`, which need no credentials and no network — took their real `tools/list` over stdio, and diffed field by field against what the registry stored.

| Field | Real servers | Registry |
|---|---|---|
| `properties` | 9 of 9 | 9 of 9 |
| per-parameter `description` | 9 of 9 | 9 of 9 |
| tool `description` | present | present |
| `enum` | present | present |
| **top-level `required`** | **27 of 37 tools** | **0** |

Everything survives except `required`.

## The part that narrows the cause

The interesting detail is not that the field is missing. It is *where* it is missing.

Across all 82,549 stored tools:

- **0** have a non-empty top-level `required` array.
- **2,064** nested objects — a `filter` object inside `properties`, say — carry their own `required` array intact.

So nested schemas pass through untouched. Only the outermost object loses the field.

That is not general schema loss and it is not a validator rejecting an unknown key, both of which would take the nested arrays too. It looks like something reconstructs the top-level object — reading `type` and `properties` and writing a fresh object from them — while passing anything below it through by reference.

We cannot see the code, so that is inference. But it is a narrow enough shape to be worth handing over: **whatever normalises `inputSchema`, the top-level `required` is not in the list of keys it copies.**

## Why it matters

**For anyone analysing registry data.** You cannot measure anything about required-versus-optional parameters, and nothing tells you that. A study of "how many MCP parameters are optional" built on this data would report a confident, wrong answer — and it is an obvious question to ask, so somebody will.

We dropped the measurement from our own survey for exactly that reason. Not because the number would have been unflattering, but because it would have been the registry's number rather than the servers'.

**For anything consuming the registry as schema.** A client that trusted a stored schema would treat every parameter as optional. In practice clients connect to servers directly, so the blast radius is analysis rather than runtime — but it is worth knowing before assuming otherwise.

**It also interacts with a real finding.** [21.5% of parameters across the corpus have no description.](/blog/21-percent-of-parameters) A *required* parameter with no description is strictly worse than an optional one — the model must supply it and has nothing to go on. We cannot separate those two populations, and that is the most useful cut of that finding we cannot make.

## What we are not claiming

We have not seen Smithery's ingestion code. "Something reconstructs the top-level object" is the shape the data implies, not a diagnosis.

We also cannot rule out that the servers in the registry genuinely emit no top-level `required` — except that the four reference servers demonstrably do, 27 of 37 tools' worth, and they are the least exotic MCP servers in existence. A corpus of 82,549 tools with exactly zero is not a property of servers.

Our sample for the diff is four servers and 37 tools. That is small, deliberately: they are the ones that boot with no credentials, which is [why the container approach does not scale to a corpus](/blog/reading-5000-mcp-schemas) and why we used the registry in the first place.

## If you are reproducing this

The check is cheap. Take any stored `tools/list`, and:

```js
const stored = tools.filter(t => (t.inputSchema?.required ?? []).length > 0);
console.log(stored.length);   // 0, across 82,549 tools

const nested = tools.flatMap(t =>
  Object.values(t.inputSchema?.properties ?? {})
        .filter(p => (p?.required ?? []).length > 0));
console.log(nested.length);   // 2,064
```

The asymmetry between those two numbers is the whole finding.

Our collector, the raw corpus and the reference-server diff are all in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study) — `ground_truth.json` is the diff, `scripts/02_validate_ground_truth.py` produces it.

## For the record

We think Smithery is a good thing and this is a small bug in a useful service. The registry is what made a 4,749-server survey possible at all; booting containers would have given us a few hundred servers selected for needing no secrets, which is a different and much worse corpus.

We reported this to them before publishing.
