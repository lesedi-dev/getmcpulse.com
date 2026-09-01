---
title: Writing tool descriptions for a reader who gets one pass
description: The model reads your description once, alongside forty others, and decides immediately. Everything that makes documentation good makes a tool description worse.
published: 2026-05-19
topic: Tool design
minutes: 5
---

A tool description is not documentation. Documentation is read by someone with a problem, who can scroll, re-read, and check an example. A tool description is read once, in a list of forty, by a reader deciding in a single pass which one to call and what to put in it.

That difference changes everything about how it should be written.

## What the description has to do

Three things, in order:

1. **Make the choice obvious.** When should this tool be picked over its neighbours?
2. **Make the arguments constructible.** From a conversation, can the caller build a valid call?
3. **Set expectations for the result.** What comes back, and what does an empty answer mean?

Anything that does not serve one of those is costing tokens on every session for nothing.

## The failure that shows up in the data

Two tools claiming overlapping ground is the single most common cause of a bad first-call rate.

```
search_orders   — "Search for orders"
list_orders     — "List orders"
```

Nothing distinguishes them. The model picks one, gets a result shaped wrong for what it needed, and calls the other. Two round trips, every time, forever.

Naming the boundary in both fixes it:

```
search_orders — Find orders matching a customer, status, or date range.
                Use when you have a filter. For a single order by ID, use get_order.

get_order     — Fetch one order by its ID, with full line items.
                Use when you already have an order ID.
```

Cross-referencing feels redundant when you write it. It is the most valuable sentence in the description, because it is the only place the model learns that the other tool exists as an alternative.

## Constraints belong in prose

The schema is a filter the caller is subject to. The description is the text the caller reads. Anything the caller must know to succeed goes in the description, even when the schema already enforces it.

- "Dates are ISO format, YYYY-MM-DD."
- "Range cannot exceed 90 days."
- "Status is one of: pending, shipped, delivered, cancelled."
- "Returns at most 50 orders. Narrow the filter if `truncated` is true."

Each of those turns a `bad_args` into a correct first call. They are worth their tokens; a paragraph explaining your rate limits is not.

## Say what empty means

This one sentence prevents an entire class of retry:

> Returns an empty array when no orders match.

Without it, an empty result is ambiguous — no data, or wrong query? The model resolves the ambiguity by trying again with looser arguments, usually twice. With it, the model reports "no matching orders" and moves on, which is the correct behaviour and one round trip instead of three.

## Write for the argument the model actually has

A description that requires an internal ID is unreachable from a conversation where nobody has ever seen one. Before requiring a field, ask where in a plausible exchange that value comes from — and if the answer is "another tool returns it", say so:

> `warehouse_id` comes from `list_warehouses`.

## Length

Two to four sentences for the tool. One short clause per non-obvious parameter, and nothing at all for the obvious ones — `customer_email` does not need "the customer's email address" underneath it.

Long descriptions do not merely cost tokens. They dilute the sentence that decides the choice, which is usually the first one. If the model has to read to the fourth line to learn when to use this tool, the first three lines are working against you.

## Checking your work

You cannot grade a description by reading it, because you know what you meant. First-call success is the grade — per tool, over real traffic.

Change one description, wait a day, look again. It is the only feedback loop that exists between the words you wrote and what a model does with them, and it is unambiguous in a way that no amount of re-reading your own prose will ever be.
