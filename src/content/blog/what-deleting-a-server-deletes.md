---
title: What deleting a server in MCPulse actually deletes
description: Everything recorded about it, in one statement, with no undo. What goes, what stays, how long call rows live on each plan, and why the cleanup is the database's job.
published: 2026-10-07
topic: Privacy
minutes: 4
---

"Delete" in most products means "hide". A flag flips, a row stops appearing, and the data waits on a disk until somebody remembers to purge it. When you are asked what happens to your data at the end of a contract, that difference is the whole answer.

Here is what it means in MCPulse.

## Deleting a server

Deleting a server from the dashboard comes down to one statement in the database:

```sql
delete from mcps where id = $1;
```

Every table that refers to a server does so with a foreign key set to cascade, so that one statement also removes:

- its **ingest keys**, which stop working immediately
- its **call log** — every individual call row still held
- its **hourly counters**, which are the history behind every chart
- its **sessions**
- its **tool pairs**
- its **registered tools**, as reported at startup

There is no soft delete and no undo, so there is nothing to restore from afterwards.

## Deleting an account

Deleting an account is the same shape, one level up. One statement removes the account, and the cascade removes every server in it — and from each server, everything above — along with the team's memberships, pending invitations and notification preferences.

Only the account's owner can do it. Every other destructive action stops at admin, but those remove one thing; this removes everything, for everyone on the team, at once.

One thing is deliberately left: **your sign-in.** Identity lives in the auth provider, and a person may belong to another team's account too. Deleting an account removes the account, not your ability to log in to a different one.

## Why the database does it, not our code

There is no cleanup code that walks the tables and deletes rows one by one, and there must not be.

A delete written in application code races ingest — calls can still be arriving while it runs — and it misses whatever table was added most recently, because whoever added that table did not remember to update the cleanup. That table ends up holding rows that belong to nothing, about a server that no longer exists. [Cascading foreign keys](/blog/rollups-exist-so-events-can-be-deleted) make it the database's job, where it is enforced by the schema rather than by somebody's memory.

## What expires on its own

You do not have to delete anything for the call log to shrink. Individual call rows are kept for a window that depends on the plan:

| Plan | Call rows kept |
|---|---|
| Free | 7 days |
| Pro | 90 days |
| Scale | 365 days |

After that they are deleted. The hourly counters are not, because they are what the charts are drawn from — and they are deliberately coarse. A counter row is one tool, one client, one hour, and a set of totals. It holds no session, no timing of individual calls, and no argument hash.

That is also why downgrading hides history rather than destroying it: the plan decides how far back the date picker reaches, and the counters are still there if you upgrade later.

## What there was never anything to delete

The most useful property of a deletion policy is having less to delete. Arguments, results, tool descriptions and schemas [never leave your process](/blog/what-mcpulse-receives) in the first place. There is no copy of them on our side to expire, export, or forget about.

So the honest summary for a security questionnaire is short. What is held is sizes, timings, outcomes and short hashes. Call rows expire on a fixed window. Deleting a server or an account removes everything about it, at once, enforced by the database. And the sensitive parts were never received.
