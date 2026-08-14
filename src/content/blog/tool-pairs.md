---
title: Which tools get called together, and what that tells you
description: Models chain tools. When two of yours are always called in sequence, that pattern is usually a design note you have not read yet.
published: 2026-04-14
topic: Measurement
minutes: 4
---

A model rarely calls one tool and stops. It calls one, reads the result, and calls another. Over enough sessions, the pairs that recur are a map of how your server is actually used — as opposed to how you imagined it would be.

MCPulse records ordered pairs of consecutive calls within a session, per day:

```sql
create table tool_pairs (
  mcp_id uuid references mcps(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  day date,
  from_tool text,
  to_tool text,
  count int default 0,
  primary key (mcp_id, day, from_tool, to_tool)
);
```

Ordered, because direction is information. `search_orders` → `get_order` is a drill-down. The reverse would be something else entirely.

## The four patterns worth recognising

**A → B, almost always.** If 90% of `search_orders` calls are followed by `get_order`, your search result is missing something `get_order` supplies. The model has to make a second round trip to finish the job every single time.

Either add the missing fields to the search result, or accept the pattern deliberately — sometimes the second call is genuinely cheaper than fattening every row of the first. The point is to decide rather than to discover it a year later.

**A → A.** The same tool twice in a row is usually a retry, and the retry metric already covers it. When it is *not* a retry — same arguments, so pagination — a high count means your page size is too small for the way models use the tool. A model paging four times to answer one question has spent four times the context.

**A → B → A.** A round trip out and back. Often the middle tool supplies an argument the first one required, which is the signature of a required field that is not conversational: the model has to go and fetch an ID before it can do what was asked.

That is worth fixing at the source — either derive the value server-side, or make the field optional with a sensible default.

**Pairs you did not expect.** These are the interesting ones. Two tools you thought were unrelated, consistently called together, usually means users are doing a workflow you did not design for. That is a feature request arriving as data, and one tool that does the combined job would collapse two calls into one.

## Why it sits last on the page

Tool pairs is the final panel on the overview, below the tool table, and it is the one panel that can be absent entirely.

Both of those are deliberate. It reads as a footnote to the tool table — you look at it after you know which tools matter, not before. And a new server, or one whose sessions are single calls, genuinely has no pairs. Rather than showing an empty box, the panel does not render, and because it is last, nothing below it moves when it is missing.

## Where it comes from

The nightly pass, alongside retries. It needs consecutive calls in order within a session, which is a property of a sequence rather than of any single call — so like the other two sequence metrics, it is labelled *as of yesterday*.

## What not to read into it

Correlation over sessions, not causation within one. Two tools appearing together often may both be triggered by the same kind of question rather than one leading to the other.

And direction can be an artefact of ordering when calls land in the same second. It is a design hint, not a proof — the value is in noticing a pattern worth investigating, not in the exact count.
