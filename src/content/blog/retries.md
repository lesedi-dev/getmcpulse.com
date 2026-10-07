---
title: "Retries: when the model calls the same tool twice"
description: Same tool, within thirty seconds, with different arguments. Each part of that definition exists to throw out something that looks like a retry and is not one.
published: 2026-10-07
topic: Measurement
minutes: 5
---

A retry is the cheapest signal you will ever get that a model did not understand your tool. It is also easy to count wrongly, and a wrong retry count is worse than none, because it sends you to rewrite descriptions that were fine.

MCPulse counts a call as retried when the **same tool** is called again **within 30 seconds**, in the same session, with **different arguments**. Each of those three conditions is there to remove a false positive.

## Same tool

A model that calls `search_orders` and then `get_order` has not retried anything. It drilled down. That is [a tool pair](/blog/tool-pairs), and it is a design note about your result shape rather than a sign of confusion.

Only the same tool twice counts. When the model reaches for a different tool after a bad result, that shows up somewhere else — in empty answers, or in the pairs.

## Within thirty seconds

Long enough to cover a model reading a result, thinking, and calling again, with a slow tool on either side. Short enough that the user's next, unrelated question does not land inside the window and get counted as a second attempt at the first.

It is a judgement call, and it is stated rather than tuned per server so that a retry rate means the same thing on every dashboard.

## With different arguments

This is the condition that does the most work.

**Same arguments** inside thirty seconds is a repeat, not a retry: pagination, polling, a client re-issuing a request it lost. A well-behaved paginating tool calls itself four times in ten seconds, and counting those as retries would grade it as broken.

**Different arguments** means the model looked at what came back, decided it was wrong, and changed what it asked for. That is a rewording, and a rewording is the model telling you it guessed.

Comparing arguments without keeping them is why every call carries `args_hash`: twelve characters of a SHA-256 over the arguments in canonical form, keys sorted. It answers "were these the same?" and nothing else. [The full reasoning is here](/blog/why-we-hash-arguments). Sorting is what makes it work — without it, `{a:1,b:2}` and `{b:2,a:1}` hash differently, and every repeat is misread as a rewording.

## Why it is counted overnight

Whether a call was retried depends on what came *after* it, which cannot be known when the call arrives. So retries are computed by [the nightly pass](/blog/the-nightly-pass), at 02:00 UTC, walking each session's calls in order.

It reads thirty seconds past the end of the day it is processing. A call at 23:59:50 can be retried at 00:00:05, and if the pass stopped at midnight, the last call of every day would be judged with its follow-up missing.

The figure is labelled as of yesterday everywhere it appears, because it is.

## The common shapes

**A `bad_args`, then a successful call.** The model could not fill in your schema, read the validation error, and corrected itself. That counts as a retry, and it is the most fixable kind: the error message told the model what your schema should have told it up front. [Read the parameter descriptions](/blog/bad-args-is-a-schema-problem).

**An empty answer, then a broader query.** The model got `[]`, assumed it had asked too narrowly, and loosened the filters. Often the empty answer was correct, and the description never said that nothing matching was a possible result. One sentence fixes it.

**Two or three `ok` calls in a row with different arguments.** Every call succeeded, and the model still did not get what it wanted. This is the one no other metric catches — [it looks perfectly green in every log](/blog/first-call-success). Usually a parameter whose meaning is ambiguous: `customer_ref` that might be an ID, an email or a name.

## Reading the number

Retries feed straight into first-call success, which is the headline metric: a call that is followed by a retry is not a first-call success, no matter how it ended.

The useful view is per tool, and per client. A server-wide retry rate tells you something is being guessed at somewhere. The same rate on one tool, in [one client](/blog/averages-hide-clients), tells you where to spend the afternoon. When a tool's first-call success drops below 70%, MCPulse states it as an average — "agents retried `search_orders` 2.4 times before getting a usable answer" — because a count of extra attempts is easier to feel than a percentage.

## What it cannot see

A model that gives up rather than retrying leaves no trace here. It calls once, gets something unusable, and answers the user without your tool. That shows up as an empty answer at best, and as nothing at worst.

And a retry that crosses sessions — the user starts a new conversation and asks again — is not counted, because it is not visible as a retry from inside the server. Both of those make the retry rate a floor, not an estimate.
