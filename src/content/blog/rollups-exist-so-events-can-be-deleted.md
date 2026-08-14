---
title: Rollups exist so that events can be deleted
description: Every call is written twice — once as a row you will throw away, once as a counter you keep forever. The second one is what makes the first one disposable.
published: 2026-05-05
topic: Engineering
minutes: 4
---

Every tool call is recorded twice, in the same moment.

Once into `events`, as a row: which tool, when, how long, how it ended, how big, which session, the argument hash. Once into `tool_days`, as a set of counters incremented on a row keyed by MCP, day and tool.

The duplication is the point. One is a log and one is a summary, and they have opposite lifespans.

## The arithmetic that forces it

A server handling 50,000 calls a day produces 1.5 million event rows a month. Ten servers produce 15 million. Querying a 30-day range means scanning millions of rows to answer "how many calls, and how many succeeded".

The same range in `tool_days` is 30 rows per tool. Eight tools, 240 rows, summed. It is not a slightly faster query — it is a different class of query, and it stays that way as the customer grows.

Rollups are also naturally correct across ranges, because everything in them is additive. Sum any set of days and the answer holds.

## Which makes events optional

Once every dashboard read comes from rollups, nothing on the read path depends on `events` surviving. That is what makes deletion possible:

```sql
delete from events where started_at < now() - interval '30 days';
```

Rollups keep working. History stays intact. The largest table in the system stops growing without bound.

If the dashboard read raw events for anything — a single chart, one drill-down list — that delete would take a feature with it, and the retention policy would become a product decision instead of an operational one.

## Why events exist at all

Two reasons, and only two.

**The nightly pass needs them.** Retries, first-call success and tool pairs are computed by walking a session's calls in order. That requires the sequence, which rollups have already aggregated away. Yesterday's events are the input.

**They are the fallback for anything not yet rolled up.** A new metric can be backfilled from whatever events remain. Once it has its own counter, the events stop mattering again.

Both are bounded needs. Neither requires 30 days — the pass needs one — which is why the retention window is a comfortable margin rather than a calculation.

## The upsert has to be blind

Rollup increments run as:

```sql
on conflict (mcp_id, day, tool_name) do update
set calls = tool_days.calls + excluded.calls,
    ok    = tool_days.ok    + excluded.ok
```

Never read-then-write. Under concurrent ingest, two batches that each read 100 and each write 101 lose a call, and it happens exactly when traffic is heaviest — which is when the numbers matter most and when nobody is looking at a race condition.

Adding inside the statement pushes the correctness down to the database, where concurrency is already solved.

## Deletion is the database's job too

Every foreign key cascades. Deleting an MCP removes its keys, events, rollups, sessions and pairs; deleting an account removes everything under it.

There is no cleanup code, and there must not be. A delete written in application code races ingest and misses whatever table was added last — and the table it misses is the one nobody remembers, holding rows that now belong to nothing.

## The order that must not slip

The cleanup job runs at 03:00, an hour after the nightly pass at 02:00. That gap is load-bearing: delete yesterday's events before the pass walks them and retries silently become zero, forever, with no error anywhere.

Which is why cleanup ships disabled. Keep everything until storage is a real cost, then turn it on — deliberately, with the ordering checked, rather than as a default that quietly deletes the input to your headline metric.
