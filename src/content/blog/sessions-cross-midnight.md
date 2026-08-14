---
title: Sessions cross midnight, and other rollup traps
description: Daily rollups are how a dashboard stays fast. But some things are not daily, and summing them by day quietly double-counts every one that spans two.
published: 2026-06-02
topic: Engineering
minutes: 4
---

The rollup pattern is straightforward. Every event increments a row in a per-day table; the dashboard reads the rollups and never touches raw events. Ranges become a `sum` over a handful of rows instead of a scan over millions.

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

Since the session row already carries `total_bytes`, the division happens over the same set of rows the count came from. Taking bytes from a daily rollup and sessions from the session table would give a ratio whose numerator and denominator disagree about what a day is — and the disagreement would only appear on ranges containing a boundary-crossing session, which is the worst kind of bug to have.

## The other trap: things with no daily dimension

`server_days.clients` is a JSONB object counting calls per client name. It has no tool column, and it cannot get one — a client connects to your server, not to a tool.

So when someone filters the overview to one tool, that number cannot be filtered. There are two options and only one of them is honest: return the unfiltered figure, or return nothing.

MCPulse returns `null`, and the page says why. A server-wide number sitting inside a filtered view reads as though it had been narrowed, and a reader who trusts it draws a conclusion about one tool from data about all of them. A blank with an explanation is understood; a wrong number is acted on.

Sessions have the same limitation for the same reason, and get the same treatment.

## The rule this all comes down to

Before adding a column to a daily rollup, ask what happens to it at midnight.

If the thing being counted happened at an instant, a daily row is right. If it has a duration, or belongs to something with a duration, it needs its own table keyed by identity — and the count comes from rows, not from sums.

Getting this wrong produces numbers that are plausible, stable, and quietly inflated. Those are far more expensive than numbers that are obviously broken, because nobody goes looking for them.
