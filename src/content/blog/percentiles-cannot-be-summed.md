---
title: Percentiles cannot be summed, so we bucket latency instead
description: You cannot average two days of p95 and get the week's p95. Four counters can be added across any range and still tell you the truth.
published: 2026-06-09
topic: Engineering
minutes: 4
---

A counter table exists so that a range query does not have to touch millions of raw call rows. It works because the quantities in it are additive: calls, errors, bytes. Sum the buckets in the range and the answer is correct.

Latency percentiles are not additive, and storing a p95 per bucket quietly breaks every range longer than one.

## Why the average of two p95s is not a p95

Monday: 1,000 calls, p95 = 800ms.
Tuesday: 10 calls, p95 = 4,000ms.

The average of those two numbers is 2,400ms. The true p95 across both days is close to 800ms, because Tuesday contributed ten calls to a population of 1,010.

Weighting by call count improves it but does not fix it. A percentile is a position in a distribution, and you cannot recover a position in a merged distribution from two positions in the parts. The information needed is gone the moment you stored a single number.

The failure is not a rounding error. A range that includes one quiet day with a few slow calls will report a latency your users never experienced.

## Four counters

So `tool_hours` stores buckets instead:

```sql
ms_under_100   int default 0,
ms_under_500   int default 0,
ms_under_2000  int default 0,
ms_over_2000   int default 0
```

Every call increments exactly one. These are counts, so they add across any number of hours, any set of tools, any client, any range — the same way calls and errors do.

From the summed counters, a p95 is recovered by walking the buckets to find the one the 95th percentile falls in. The result is an approximation bounded by the bucket edges, and that is the trade: exactness for the ability to aggregate correctly.

It is a good trade. A p95 stated as "between 500ms and 2s" is honest and actionable. A p95 stated as 2,400ms when it was really 800ms is precise and wrong.

## Why those four edges

The boundaries are chosen to match how a call feels rather than to be evenly spaced.

- **Under 100ms** — instant. The model moves straight on.
- **Under 500ms** — quick. Nobody notices.
- **Under 2s** — noticeable. The conversation has a pause in it.
- **Over 2s** — the user is waiting, and if the model chains two of these the assistant looks stuck.

The one that earns its place is the last. `ms_over_2000 / calls > 0.1` is the slow-tool insight — *"14% of `search_orders` calls take over 2 seconds"* — and that is a sentence someone can act on today.

Even distribution would have been prettier and less useful. The gap between 100ms and 500ms does not change anyone's experience; the gap between 1.5s and 3s changes it completely.

## The general rule

When designing a counter table, the question for every column is: *can this be added?*

Counts add. Sums add. Sums of squares add, which is how you get a standard deviation later if you want one. Percentiles, averages, medians, ratios and rates do not — and a ratio stored as a ratio is an average waiting to be taken incorrectly.

So store `ok` and `calls` rather than a success rate. Store `response_bytes` and `calls` rather than a mean size. Divide at read time, after summing, when you have the whole range in front of you.

Everything else follows from that: the numbers stay correct at every range, and nobody has to remember which columns are safe to add.
