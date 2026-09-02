---
title: Tool descriptions or parameter descriptions?
description: One failure scales sixty-three times with server size. The other is flat at every size. So fixing either does nothing for the other — they are separate jobs.
published: 2026-09-08
topic: Tool design
minutes: 5
---

There are two ways a schema fails a model, and they get discussed as one problem. They are not one problem, and the corpus makes that unusually clear.

Across 4,749 public MCP servers:

- **21.5% of parameters have no description** — 55,383 of 257,287.
- **17.6% of tools have no word distinguishing them from a sibling** — a description built entirely from words its neighbours also use.

Similar-sized numbers. Completely different behaviour.

## One scales, one does not

Split the corpus by how many tools a server publishes:

| Tools on the server | Servers | Undescribed parameters | Colliding tools |
|---|---|---|---|
| 1–3 | 1,193 | 15.2% | **0.5%** |
| 4–7 | 1,257 | 22.4% | **1.6%** |
| 8–15 | 1,013 | 21.9% | **4.4%** |
| 16–30 | 738 | 24.8% | **7.6%** |
| 31–60 | 350 | 21.4% | **16.6%** |
| 61+ | 198 | 20.1% | **32.4%** |

Read the last column down: 0.5 to 31.3, monotonic, a factor of sixty-three.

Now read the middle one: 14.8, then between 20 and 25 forever. No trend. The largest servers in the corpus are *marginally better* at parameter descriptions than the 16–30 bucket.

**So these are not two symptoms of one cause.** Collisions are a property of how many tools you have. Undescribed parameters are a habit that a two-tool server has about as much as a two-hundred-tool one.

## Why that matters practically

Because the fixes do not transfer, and the intuitive plans are wrong in both directions.

**Splitting a large server does nothing for your parameters.** It is the standard advice when a model keeps picking wrong, and it works — the collision column says so. Take a 70-tool server to three 23-tool servers and you move from 32.4% territory to 7.6% territory. Your undescribed parameters do not move at all, because they were never about size.

**Rewriting descriptions does nothing for your collisions past a certain size.** This is the one that wastes more time. On a 60-tool server, careful editing of individual descriptions is treating a symptom: at that size you have tools that genuinely overlap in what they *do*, and no prose separates two tools that do nearly the same thing. The structural fix is structural.

**And they fail at different moments.** A collision fails at *selection* — the model picks the wrong tool and you see a call you did not expect. A missing parameter description fails at *invocation* — the right tool, called with a value the model guessed. The second one shows up in your data as [bad arguments](/blog/bad-args-is-a-schema-problem) or as an empty result, not as a wrong tool.

## So which matters more?

The honest answer is: it depends on your size, and we can be specific about where the crossover is.

**Under about fifteen tools, parameters are your problem.** Collisions sit at 4.4% or below — a handful of tools, if any. Meanwhile a fifth of your parameters are probably undescribed. Fix the parameters.

**Past about thirty, collisions are your problem.** 16.6%, then 32.4%. Your parameter rate is the same 20-odd percent it always was, but the collision rate has grown past it and keeps growing.

**In between, do the parameters first anyway** — because it is cheaper. Describing a parameter is a one-line edit with no design consequences. Restructuring a tool list is a breaking change for everyone who has already installed your server.

There is also an asymmetry in what the two say about you. Only **0.4% of tools** have no description at all, against 21.5% of parameters — [a fifty-four times gap](/blog/21-percent-of-parameters). Nobody forgets to describe the tool. Almost everybody forgets the arguments. If you have not looked, the prior is strongly that you have this one.

## What this cannot tell you

Neither number is a measure of harm. We never ran a model against any of these servers, so we cannot rank these two failures by how often they actually cost a call — only by how often they are present and how they behave as a server grows.

It is entirely possible that collisions are mostly harmless because tool *names* carry the choice — [we found 89.6% of colliding tools still have a distinctive name](/blog/why-models-pick-the-wrong-tool) — while undescribed parameters cost something every time. Or the reverse. Establishing that needs a model in the loop, and it is the most useful thing the follow-up study could produce.

Parameter counts are top-level `inputSchema.properties`. The corpus comes from the [Smithery](https://smithery.ai) registry and inherits its coverage.

## Measuring your own

[The schema checker](/check) reports both, side by side, each scored against servers your own size rather than the corpus average — which for this question is the only comparison that means anything, since one of the two numbers depends entirely on size.

Runs in your browser, nothing uploaded. Data in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study).
