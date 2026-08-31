---
title: Sessions cross midnight, and other counter traps
description: Bucketed counters are how a dashboard stays fast. But some things are not buckets, and summing them by day quietly double-counts every one that spans two.
published: 2026-06-02
topic: Engineering
minutes: 4
---

The pattern is straightforward. Every call increments a row in a bucketed counter table; the dashboard reads those counters and never touches the raw call log. Ranges become a `sum` over a handful of rows instead of a scan over millions.

It works because most quantities belong to a moment. A call happened at a time, on a day, and it counts once.

A session does not belong to a moment. It has a duration, and durations cross boundaries.

## The double count

A user opens Claude at 23:40 and works until 00:20. One session.

If sessions are counted daily, that session appears in Tuesday's row and Wednesday's row. Query Tuesday: one session. Query Wednesday: one session. Query "Tuesday to Wednesday": two sessions.

There was one. The number is wrong by exactly the count of sessions that span midnight — which is not a rounding error at small volumes, and is invisible at large ones because nothing looks obviously broken. It just runs high, forever.

## The fix is to stop pretending it is daily

Sessions get their own table, keyed by MCP and session ID, with a start and a last-seen:

```sql
create table sessions (
  mcp_id uuid references mcps(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  session_id text,
  started_at timestamptz,
  last_seen timestamptz,
  client_name text,
  call_count int default 0,
  total_bytes bigint default 0,
  primary key (mcp_id, session_id)
);
```

One row per session, ever. Counting sessions in a range means counting rows whose `started_at` falls inside it — correct at any range, including ranges that contain midnight, which is all of them.

`last_seen` extends as calls arrive. `call_count` and `total_bytes` accumulate on the same row.

## Cost per session has the same shape

Cost per session is total bytes divided by session count. Both halves have to come from the same place or the ratio is nonsense.

Since the session row already carries `total_bytes`, the division happens over the same set of rows the count came from. Taking bytes from a bucketed counter and sessions from the session table would give a ratio whose numerator and denominator disagree about what a day is — and the disagreement would only appear on ranges containing a boundary-crossing session, which is the worst kind of bug to have.

## The other trap: a dimension the table does not have

For a while the client split lived in its own table, counting calls per client with no tool column beside them. So filtering the overview to one tool could not narrow it, and there were two options with only one of them honest: return the unfiltered figure, or return nothing.

Returning nothing was the right call, and it was also a signal that the table was wrong. The information existed — the same calls were being counted twice, once by tool and once by client, in two rows that could never be re-joined. The fix was not a better blank. It was one table keyed by both, so *which tool, for which client* is a row rather than a join that cannot be written.

**Sessions keep the blank, because for them it is not a missing column.** A session belongs to your server, not to a tool: scoping "sessions" to `search_orders` is not a harder query, it is a meaningless one. So under a tool filter the session figures come back `null` and the page says why.

That distinction is worth holding onto. A number that cannot be narrowed *yet* is a schema problem and should be fixed. A number that cannot be narrowed *at all* is a fact about the thing being counted, and the honest answer is a blank with a sentence next to it. A server-wide figure sitting inside a filtered view reads as though it had been narrowed, and a reader who trusts it draws a conclusion about one tool from data about all of them.

## The rule this all comes down to

Before adding a column to a bucketed counter, ask what happens to it at the boundary.

If the thing being counted happened at an instant, a bucket is right. If it has a duration, or belongs to something with a duration, it needs its own table keyed by identity — and the count comes from rows, not from sums.

Getting this wrong produces numbers that are plausible, stable, and quietly inflated. Those are far more expensive than numbers that are obviously broken, because nobody goes looking for them.
