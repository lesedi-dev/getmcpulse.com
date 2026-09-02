---
title: When "valid values" is prose and the schema says string
description: 857 parameters across 4.4% of servers name their valid values in prose and leave the schema an open string. A one-line fix, and only one of the two is enforced.
published: 2026-09-11
topic: Tool design
minutes: 4
---

This is the most actionable finding in the survey, so it gets the shortest post.

Across 4,749 public MCP servers we found **857 parameters** — on **4.4% of servers** — that name their valid values in the description and then declare the schema as a plain string.

```json
"outcome_attribution": {
  "type": "string",
  "description": "Attribution type for the outcomes.\n\nValid values:\n- \"direct\"\n- \"influenced\"\n- \"unattributed\"\n- \"total\""
}
```

The author knew the set. They typed all four values. And `"type": "string"` means the model can send anything.

## Why this is a bug rather than a style

Because a description is advice and a schema is a contract, and only one of them is enforced.

A model reading that parameter gets the four values as *text* — competing for attention with everything else in the description, in a context window that may hold a hundred other tools. It will usually comply. When it does not, it sends `"Direct"` or `"total_outcomes"` or `"influenced_and_direct"`, your server rejects it, and **the model has no way to distinguish "I sent an invalid value" from "this tool is broken."**

That is the real cost. An argument error the model can diagnose leads to a corrected retry. An argument error that looks like a server fault leads to abandoning the tool — which shows up in your data as [bad arguments](/blog/bad-args-is-a-schema-problem) if you are measuring, and as nothing at all if you are not.

With an `enum`, a well-behaved client can constrain generation so the invalid value is never produced. Without one, you are relying on the model reading carefully.

## The real cases

Every one of these is from the corpus.

**A pipe-separated list, which is a set written in the least machine-readable way possible:**

```
commitment    "Optional processed|confirmed|finalized commitment"
```

**Values with units, where the format is as constrained as the set:**

```
outcome_time_range   "Time range for the returned outcome data.
                      Valid values: 1h, 1d, and 1mo."
```

**A set spelled out with explanations — the most careful version, and still unenforced:**

```
method    "The action to perform on a single sub-issue
           Options are:
           - 'add' - add a sub-issue to a parent issue in a
             GitHub repository
           - 'remove' - …"
```

That last one is from a large, well-maintained server. Whoever wrote it was being thorough. The thoroughness went into the wrong field.

## The fix

Move the values into the schema. Keep the prose, because the prose explains *what the values mean* and an enum cannot:

```json
"method": {
  "type": "string",
  "enum": ["add", "remove", "reprioritize"],
  "description": "The action to perform on a single sub-issue. 'add' attaches an existing issue to a parent; 'remove' detaches it; 'reprioritize' moves it within the parent's list."
}
```

Now the set is enforced and the meaning is still documented. Nothing was lost.

Three things worth noting while doing it:

**Do not delete the description.** An enum tells a model *which* values are legal, never which one to pick. `["add", "remove"]` with no prose is a worse parameter than prose with no enum.

**Check the values are exhaustive before you enum them.** An enum is part of your published interface, and a set that grows becomes a breaking change. If the list is "the five statuses we currently support", it may want to stay a string.

**Watch the ones with units.** `1h, 1d, 1mo` is a set *and* a format. Enumerate it if it is genuinely those three; if it is any ISO duration, an enum is wrong and a `pattern` is the right tool.

## How to find yours

Grep your own schema for the phrases that give it away:

```
valid values | allowed values | possible values | accepted values
must be one of | one of the following | options are | options:
```

Then check whether the parameter has an `enum`. If a description contains any of those and the schema does not constrain the field, that is a hit.

Watch for one false positive, because we hit it hard. An *illustration* is not a closed set:

```
line    "Filter by line (e.g. \"1\", \"A\", \"F\")"
```

Our first pass at this measurement matched that shape and reported 108 hits in a 40-server sample — which would have scaled to something dramatic and wrong. Requiring explicit closed-set language *and* the absence of "e.g." / "such as" took that sample from 108 to 9, and all nine were real. A station name is not an enum.

## What this cannot tell you

895 is a floor, not an estimate, and the gap is not small. It only catches authors who wrote the set down. A parameter whose closed set exists only in the server's validation code is invisible to this test, and there is no way to count those from outside — so the true number of unconstrained-but-closed parameters is higher by an unknown factor.

We also never ran a model against these servers, so we cannot say how often an unconstrained string actually produces a rejected call. The mechanism is clear; the frequency is not measured.

The corpus comes from the [Smithery](https://smithery.ai) registry and inherits its coverage.

## Measuring your own

[The schema checker](/check) runs this exact test — closed-set language required, hedged illustrations excluded — and quotes the description of each hit so you can see the values to move. Runs in your browser, nothing uploaded.

The broader enum picture is [here](/blog/enums-in-mcp-schemas), the full survey [here](/blog/reading-5000-mcp-schemas), and the data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
