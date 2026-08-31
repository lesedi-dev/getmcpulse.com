---
title: Counters exist so that calls can be deleted
description: Every call is written twice — once as a row you will throw away, once as a counter you keep forever. The second one is what makes the first one disposable.
published: 2026-05-05
topic: Engineering
minutes: 5
---

Every tool call is recorded twice, in the same moment.

Once into `calls`, as a row: which tool, when, how long, how it ended, how big, which session, the argument hash. Once into `tool_hours`, as a set of counters incremented on a row keyed by MCP, hour, tool and client.

The duplication is the point. One is a log and one is a summary, and they have opposite lifespans.

## The arithmetic that forces it

A server handling 50,000 calls a day produces 1.5 million rows in `calls` a month. Ten servers produce 15 million. Querying a 30-day range means scanning millions of rows to answer "how many calls, and how many succeeded".

The same range in `tool_hours` is 720 rows per tool per client. Eight tools, three clients, summed in Postgres on the way out. It is not a slightly faster query — it is a different class of query, and it stays that way as the customer grows.

Counters are also naturally correct across ranges, because everything in them is additive. Sum any set of hours and the answer holds.

## An hour, not a day

The first version of this table was keyed by the day, and that was a mistake with an obvious symptom: "what has my server done today" could not be answered at all. A one-day window drew a single point, and a single point is not a line.

An hour is not a slice of a day — a day is twenty-four hours summed, and the reverse does not work. Storing the finest grain anything is ever asked at, and rolling up on read, is the ordinary shape for this. It removed a table rather than adding one: a separate per-day total became a sum over these rows.

The cost is rows. Twenty tools, five clients and a call in every hour of thirty days is 72,000 rows a month for one server — which is still nothing, and only reached by a server that never sleeps. Every read groups in Postgres, so the row count is the database's problem rather than the API's.

## Keyed by the client, too

There used to be a second table counting the same calls grouped by client and forgetting which tool, while this one counted by tool and forgot who called.

Both were written from the same calls, so the information existed. It was simply stored in two rows that could never be re-joined — and the sharpest question this product has, *how is `search_orders` doing for Cursor only*, could not be asked at all.

One table, keyed by both. A client filter and a tool filter now compose, because they narrow the same rows.

## Which makes the call log optional

Once every dashboard read comes from counters, nothing on the read path depends on `calls` surviving. That is what makes deletion possible:

```sql
delete from calls where started_at < now() - interval '30 days';
```

The counters keep working. History stays intact. The largest table in the system stops growing without bound.

There is one deliberate exception, and it is the exception the rule was written for: the live call feed reads `calls`, because a counter has no rows to point at. Nothing built on a total can answer "did the call I just made land". So retention costs that page its tail, and costs no other page anything — which is exactly the trade a retention window should be.

## Why the log exists at all

Three reasons, and only three.

**The nightly pass needs it.** Retries, first-call success and tool pairs are computed by walking a session's calls in order. That requires the sequence, which counters have already aggregated away. Yesterday's rows are the input.

**The feed needs it.** See above.

**It is the fallback for anything not yet counted.** A new metric can be backfilled from whatever rows remain. Once it has its own counter, they stop mattering again.

All three are bounded needs. The pass needs one day, which is why the retention window is a plan decision rather than a calculation.

## The upsert has to be blind

Increments run as:

```sql
on conflict (mcp_id, hour, tool_name, client_name) do update
set calls = tool_hours.calls + excluded.calls,
    ok    = tool_hours.ok    + excluded.ok
```

Never read-then-write. Under concurrent ingest, two batches that each read 100 and each write 101 lose a call, and it happens exactly when traffic is heaviest — which is when the numbers matter most and when nobody is looking at a race condition.

Adding inside the statement pushes the correctness down to the database, where concurrency is already solved.

## Deletion is the database's job too

Every foreign key cascades. Deleting an MCP removes its keys, its calls, its counters, its sessions and its pairs; deleting an account removes everything under it.

There is no cleanup code, and there must not be. A delete written in application code races ingest and misses whatever table was added last — and the table it misses is the one nobody remembers, holding rows that now belong to nothing.

## The order that must not slip

The cleanup job runs at 03:00, an hour after the nightly pass at 02:00. That gap is load-bearing: delete yesterday's calls before the pass walks them and retries silently become zero, forever, with no error anywhere.

Which is why cleanup ships disabled. Keep everything until storage is a real cost, then turn it on — deliberately, with the ordering checked, rather than as a default that quietly deletes the input to your headline metric.
