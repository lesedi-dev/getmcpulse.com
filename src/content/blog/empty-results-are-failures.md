---
title: Empty results are failures the protocol calls success
description: An empty array is a 200. The model got nothing it could use, the user got a shrug, and no error was recorded anywhere. These are the failures nobody reports.
published: 2026-07-28
topic: Measurement
minutes: 5
---

A tool returns this:

```json
{ "content": [{ "type": "text", "text": "[]" }] }
```

No error. `isError` is absent. The call took 40ms. Your logs, if you keep any, record a success.

The model asked for something and received nothing. It cannot tell whether that means "there are genuinely no orders" or "you asked the wrong way". So it guesses — usually by trying again with looser arguments, sometimes by apologising to the user and stopping.

Either way, that call failed. Nothing recorded it.

## Why this class of failure hides so well

Every error-tracking habit you have is built around something raising a hand. An exception has a stack trace. A 500 shows up in the error rate. A rejected argument produces a validation message you can grep.

An empty result raises nothing. It travels the entire success path — your handler ran, returned, serialised, and delivered. There is no signal in the system at any layer, because from the protocol's point of view nothing went wrong. It did not.

The gap is between "the call completed" and "the model can proceed", and only the second one matters to the person waiting.

## What counts as empty

MCPulse marks `is_empty` when a call succeeded and returned nothing usable:

- an empty array
- an empty object
- an empty string, or whitespace only
- an array whose single text item parses to an empty array — which is the common one, because MCP results are text content, and a tool returning JSON returns `"[]"` as a string inside a content block

That last case is the reason this needs a real check rather than a length test. `{ "content": [{ "type": "text", "text": "[]" }] }` is not an empty response. It is 45 bytes of response containing nothing.

The flag is recorded next to the outcome, so `ok` and `is_empty: true` are distinguishable from `ok` alone. That distinction is the whole point: they are the same status and different events.

## The two kinds, and telling them apart

Not every empty result is a problem. Sometimes there really are no matching orders, and saying so is the correct answer.

The rate is what separates them. One tool returning empty 2% of the time is a tool honestly reporting an occasionally empty world. The same tool at 40% is telling you something else — that the model is asking in a way that does not match your data.

MCPulse flags above 5%, and phrases it with the number and the consequence:

> 312 calls to `get_invoice` returned empty with no error.

Three hundred and twelve times, someone's assistant went quiet and the user got nothing. You would not have found that in a log, because there is no log line to find.

Cross-referencing with retries usually settles it. Empty results that are consistently followed by a retry inside 30 seconds are the model telling you it did not accept that answer.

## The fix is almost always in the description

When a tool empties out at a high rate, the cause is nearly always a mismatch between how the model phrases a query and how your data is stored.

- The model passes a customer's name; you match on ID.
- The model passes `"last week"`; you expect ISO dates.
- The model passes a partial string; you match exactly.
- The model omits a filter you require, so your `where` clause excludes everything.

The code is right in all four. The description did not say enough for the model to construct a query that could match anything.

Two things help more than anything else. First, say in the description what a successful-but-empty result means: "Returns an empty array when no orders match the filter." That single sentence stops the model reading emptiness as its own mistake and retrying three times.

Second, when you can, return a result that explains itself. `{ "orders": [], "matched": 0, "filter_applied": "status=pending" }` gives the model something to reason about. It costs a few dozen bytes and turns a dead end into information.

## What to do on Monday

Sort your tools by empty rate. Take the worst one. Read its description as though you had never seen your own data — then read the last twenty empty calls' argument hashes and see how many were distinct.

Lots of distinct hashes means the model kept trying different phrasings and none of them matched. That is a description problem, and you can fix it this afternoon.
