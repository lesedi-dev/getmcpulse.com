---
title: bad_args is a message about your schema, not about the model
description: When arguments fail validation, the instinct is that the model got it wrong. Usually the schema asked for something the model had no way to know.
published: 2026-06-30
topic: Tool design
minutes: 5
---

`bad_args` means the arguments failed schema validation and your handler never ran. The model asked for something, the shape was wrong, nothing executed.

The natural reading is that the model made a mistake. Occasionally true. Far more often, the schema demanded something the conversation never contained, and the model did the only thing available to it: guessed.

## Where it comes from

Four causes account for nearly all of it.

**A required field that is not conversational.** Your schema requires `warehouse_id`. The user said "check stock on the blue shirts". There is no warehouse ID anywhere in that exchange, and no tool that returns one. The model must either invent a value or omit a required field. Both fail.

**A format stated in the schema and nowhere the model reads carefully.** You want `"2026-08-01"`. The user said "last week". `format: "date"` is a hint, not an instruction, and it competes with everything else in the context. Say it in the description — "ISO date, YYYY-MM-DD" — and it stops happening.

**An enum the description does not mention.** `status` accepts `pending | shipped | delivered | cancelled`. The user said "unfulfilled". The model maps that to `"unfulfilled"`, which is not in the enum. The values need to be visible in the description, not only in the schema.

**A type that is nearly right.** `limit` expects a number; the model sends `"50"`. `tags` expects an array; the model sends a comma-separated string. These are the cheapest to fix and often the most frequent — coerce them and the failure disappears.

## The rate is the diagnostic

Every tool has some `bad_args`. Models are probabilistic and occasionally produce nonsense.

What is not normal is one tool well above the others. That is a specific defect in a specific schema, and it is nearly always one field.

Because `bad_args` is recorded per tool per day alongside every other outcome, the comparison is direct. If `search_orders` rejects 18% of calls and everything else rejects 2%, you do not have a model problem. You have one parameter that nobody can supply correctly.

## Fixing it

**Make optional anything the conversation cannot supply.** If a required field is not derivable from what a user would plausibly say, either drop the requirement and pick a sensible default, or provide a tool that returns the value so there is a path to it.

**Accept what the model actually sends.** If it keeps sending `"50"` for a number, accept a string and coerce. Being strict here buys nothing — you are not defending against an attacker, you are rejecting a caller whose only crime is being probabilistic.

**Move constraints into the description.** The description is the part the model reads closely. The schema is a filter it is applying rather than reading. Anything a caller must know belongs in prose.

**Prefer enums to free strings.** Constrained choice is easier to satisfy than open text, and it turns a class of silent mismatches into an explicit option list.

**Take date parsing seriously.** People speak in relative time. Accepting `"last week"` and resolving it server-side eliminates a whole category of failures, and the model will use it correctly the first time.

## The one it is worth checking twice

A high `bad_args` rate paired with a high retry rate on the same tool is a strong signal: the model is rejected, rewords, tries again, sometimes succeeds. Every one of those sequences is two or three round trips where one should have done, and the user feels all of it.

Fix the schema and both numbers move together — which is the clearest confirmation you will get that the schema was the problem all along.
