---
title: What a 10kb tool response actually costs
description: Roughly 2,500 tokens, about a cent, and a chunk of the context window that the rest of the conversation no longer has. The last one is the expensive part.
published: 2026-05-26
topic: Measurement
minutes: 4
---

Your tool returns 10kb of JSON. Orders with line items, addresses, timestamps, a few internal IDs. It is a complete answer and it took 200ms.

Here is what that costs, in three currencies.

## Tokens

Approximate tokens as bytes ÷ 4. It is not exact — JSON with lots of punctuation and long identifiers tokenises worse than prose — but it is close enough to reason with and it does not require a tokeniser in the ingest path.

10kb ≈ 2,500 tokens.

## Money

At $3 per million input tokens, 2,500 tokens is about $0.0075. Less than a cent.

Called 200 times a day, that is $1.50 a day, $45 a month. Real but not alarming — and if this were the whole story, nobody would care.

## Context

This is the one that matters.

Those 2,500 tokens sit in the context window for the rest of the conversation. Call the tool three times and 7,500 tokens are gone before the model has done anything with them. In a long session, that is the difference between a model that remembers what you asked ten turns ago and one that does not.

Worse, most of it is not useful. The model needed order IDs and statuses. It received those, plus every line item, every address field, and a `created_at` on each row. It has to read past all of it to find the part it needed, and it pays for the reading.

## The insight, and why it is phrased that way

MCPulse flags average `response_bytes` over 10,000:

> `list_customers` returns ~14k tokens per call, roughly $0.04 of context each time it runs.

Every insight needs a tool name, a number, and a consequence. "Heavy payload detected" would be a label, not information. The tool name says where to look, the number says how bad, and the consequence says why you should care today rather than eventually.

## Getting it down

**Return fields, not records.** The model asked which orders are pending. It needs IDs, statuses and dates. It does not need line items. If a follow-up tool can fetch detail for one order, the list tool should not carry detail for fifty.

**Cap the result and say you did.** Fifty rows with `"truncated": true, "total": 1200` is more useful than 1,200 rows, and orders of magnitude cheaper. The model can then narrow the filter, which is what a person would do.

**Drop internal fields.** `updated_by_user_id`, `sync_version`, `legacy_ref` — these cost tokens on every row and mean nothing to a model.

**Prefer compact shapes.** An array of objects repeats every key on every row. For fifty rows and ten fields, that is 500 repetitions of your field names. A columnar shape, or shorter keys, cuts it substantially.

**Watch the empty case.** A tool that returns 10kb of wrapper around zero results is paying full price for nothing.

## Where to look first

Sort tools by average response size and multiply by call count. The top row is where your context budget is going.

It is usually one tool — a list endpoint someone wrapped directly from an internal API, returning everything that API returns because nobody had a reason to trim it. Trimming it is an hour's work and typically halves the server's total token cost.

The cost per session card is the same figure from the other end: total bytes divided by sessions, in dollars. It is the number to quote when someone asks what your MCP server costs to run — and unlike the monthly bill, it is a number you can change this afternoon.
