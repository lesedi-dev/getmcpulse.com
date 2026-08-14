---
title: What gets computed at 2am, and why it cannot be done sooner
description: Three of the sixteen metrics need to see what came after a call. That is not knowable when the call arrives, so it happens overnight — and the dashboard says so.
published: 2026-05-12
topic: Engineering
minutes: 4
---

Most metrics are counted the moment a payload lands. A call arrives, four upserts run, and the number is current.

Three cannot work that way, because they are not properties of a call. They are properties of what happened next.

## The three

**Retries.** Whether a call was retried depends on whether the same tool was called again, within 30 seconds, with different arguments. At the moment the first call arrives, that second call has not happened yet.

**First-call success.** Defined as `ok`, not empty, and no retry within 30 seconds. It inherits the same dependency — the third condition points forwards.

**Tool pairs.** Which tools get called alongside each other, in sequence. You need the sequence, which means you need it to be finished.

You could hold each call in memory for 30 seconds and then decide. That means state in the ingest path, a timer per call, and a correctness problem at every restart. Ingest has to be a write that returns immediately; the moment it holds state, it stops being able to fail safely.

## What the pass does

At 02:00 UTC, `pg_cron` runs the pass over yesterday, per MCP:

1. Load yesterday's events grouped by session, ordered by `started_at`.
2. Walk each session in order.
3. For each call, look ahead 30 seconds for the same `tool_name`. Different `args_hash` → a retry. Same hash → pagination or polling, not a retry.
4. Mark first-call success where the outcome is `ok`, `is_empty` is false, and no retry followed.
5. Update `tool_days.retries` and `tool_days.first_call_ok`.
6. From consecutive calls in a session, increment `tool_pairs` for each ordered pair.

The results land in the same rollup rows everything else lives in, so a range query does not care which metrics were computed live and which overnight.

02:00 UTC is chosen because the day being processed is complete everywhere. Running at local midnight would process a day that is still in progress for half the world.

## Why the dashboard admits it

Every surface showing these three labels them *as of yesterday*.

The temptation is to hide it. It is a small caveat, it complicates the interface, and most people would not notice. But a first-call rate that silently excludes today is a number that disagrees with the call count sitting next to it, and someone will eventually spot the disagreement and stop trusting both.

Nobody minds a label. Everyone minds finding out a number meant something other than what it said.

## The one place a dash survives

MCPulse shows zeros rather than dashes almost everywhere. A server with no calls has a complete answer — nothing happened — and a new MCP covered in dashes reads as broken rather than idle.

The exception is exactly here: calls exist, and the nightly pass has not reached them yet. A zero would claim every one of those calls failed on first attempt, which is a different statement and a false one. So that single case shows a dash, and it resolves itself by morning.

That is the whole rule. Zero when the answer is genuinely zero. A dash only when the number is genuinely unknown.

## Why events survive long enough

The pass needs raw events for yesterday, in order, with argument hashes. Rollups cannot produce it — they have already aggregated away the sequence.

Which sets the constraint on retention: the cleanup job that deletes old events must run *after* the nightly pass, never before. It is scheduled an hour later for that reason, and it stays disabled until storage is a genuine cost, because the cheapest possible bug is deleting the data your headline metric is computed from.
