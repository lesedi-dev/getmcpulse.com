---
title: First-call success is the only number that grades your descriptions
description: Uptime grades your infrastructure. Error rate grades your code. First-call success is the only metric that grades the thing you actually wrote for the model — the words.
published: 2026-08-04
topic: Measurement
minutes: 5
---

Here is a tool that is working perfectly and failing badly.

```
14:22:31  search_orders   ok   240ms   1.4kb
14:22:34  search_orders   ok   190ms   0.9kb
14:22:38  search_orders   ok   310ms   2.1kb
```

Three calls, three successes, no errors, good latency. Every dashboard you have ever used would show this as green.

What actually happened: the model asked, got something not quite right, reworded, asked again, still not right, reworded again. Seven seconds and three round trips to answer one question. The user watched the assistant stall and concluded your server is slow.

Nothing in that log is a failure. The failure is the shape.

## The definition

First-call success is the share of attempts where the model asked once and could move on. Concretely, a call counts as a first-call success when all three hold:

- `outcome` is `ok`
- `is_empty` is false — it returned something, not an empty array
- no retry of the same tool followed within 30 seconds

Miss any one and it does not count. A successful call that returned `[]` is not a success from the model's side, and neither is a successful call the model immediately did over.

## Why the third condition needs care

"The same tool called twice in a session" is not a retry on its own. Pagination looks exactly like that. So does polling. If you count those, every well-behaved paginating tool grades as broken.

The distinguishing fact is the arguments:

- **Different arguments** within 30 seconds → the model reworded and tried again. That is a retry.
- **Same arguments** within 30 seconds → the same request repeated. Pagination, polling, a client re-issue. Not a retry.

This is why MCPulse hashes arguments. Not to inspect them — a twelve-character SHA-256 prefix over the arguments with keys sorted is not reversible and is not meant to be. It answers exactly one question: were these two calls the same? Sorting the keys matters, or `{a:1,b:2}` and `{b:2,a:1}` hash differently and every retry looks like a rewording.

Thirty seconds is a judgement call. It is long enough to cover a model thinking and a slow tool returning, short enough that a user's next unrelated question does not land inside the window.

## Reading it

Below about 70%, agents are visibly struggling and users can feel it. But the number in isolation is less useful than the number per tool, because it is almost never your server that is at fault — it is one tool.

A typical first look:

| Tool | Calls | First-call |
|---|---|---|
| `get_customer` | 1,204 | 94% |
| `list_products` | 890 | 91% |
| `search_orders` | 2,110 | 58% |

`search_orders` is not broken. It works when you call it. It has a parameter the model keeps guessing wrong, or a description that admits two readings, and the model is resolving that ambiguity by trial and error at runtime — three times per question, on your users' time and token budget.

## Why your tests cannot find this

Your tests call your tools correctly. You wrote both sides. The arguments in your test file are the arguments you had in mind when you wrote the schema, so of course they validate, and of course the result is what you expected.

The model did not read your mind. It read your description, in a context window alongside forty other tools, and made a decision in one shot. First-call success is the grade on that decision — the only feedback loop that exists between the words you wrote and what a model does with them.

## What actually moves it

Once you know which tool is failing, the fixes are mundane and they work:

**Name the parameter for what the model has.** `customer_ref` is ambiguous — is that an ID, an email, a name? `customer_email` never gets guessed wrong.

**Say what happens when nothing matches.** "Returns an empty array when no orders match" stops the model treating an empty result as a failure and retrying with looser arguments.

**Put the constraint in the description, not just the schema.** "Date range cannot exceed 90 days" in prose gets respected. A `maxLength` in JSON Schema gets discovered by failing.

**Split tools that do two things.** A tool that searches *or* fetches by ID has two argument shapes, and the model has to pick. Two tools have one each.

None of these are clever. The hard part was never the fix — it was knowing which of your eight tools to spend the afternoon on. That is the entire value of the number.

## Its one honest limitation

Retries and first-call success are computed by a nightly pass, not on ingest. Working out whether a call was retried means looking at what came *after* it, ordered, within a session — which you cannot know at the moment the call arrives.

So it is labelled *as of yesterday*, everywhere it appears. That is not a hedge. A number that quietly includes a partial day is worse than one that tells you where it stops.
