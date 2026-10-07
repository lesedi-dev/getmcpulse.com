---
title: "OpenTelemetry for MCP servers: what it misses"
description: OpenTelemetry will carry anything you give it. The hard part of MCP observability is deciding what a call meant, and that part is still yours to write.
published: 2026-10-07
topic: Engineering
minutes: 6
---

If you already run OpenTelemetry, the obvious way to observe an MCP server is to add a span around each tool call and ship it to the backend you already pay for. That is a reasonable instinct, and for part of the job it is the right answer.

It helps to be precise about which part.

## What OpenTelemetry is

A data model and a transport. Spans, metrics and logs, a way to propagate context between services, and exporters to more or less every backend. It is deliberately neutral about what your spans mean. That neutrality is its strength, and it is also where the MCP-specific work is left to you.

A span around a tool call will faithfully record that the call started, how long it took, and whatever attributes you put on it. Everything below is about which attributes, and what it takes to get them right.

## Where it is the right tool

**Tracing what your tool does inside.** A tool that queries a database, calls two APIs and writes to a cache is a distributed operation, and that is exactly what tracing exists for. If `search_orders` is slow, a trace will tell you it was the second API call. Nothing MCP-specific will.

**Joining MCP traffic to the rest of your system.** If your server is one service among many, a span that links into your existing traces is worth more than any standalone dashboard.

**Keeping one place to look.** If your team already lives in a tracing backend, a second tool has to earn its place.

For all of that, use OpenTelemetry. None of it is something an MCP analytics product should try to replace.

## What you would have to build

The questions that matter about an MCP server are not about one call in isolation. They are about what a call meant to the model, and a span does not answer them on its own.

**The outcome, split four ways.** The SDK catches what your handler throws and turns it into an `isError` result, so a span at the request layer sees a crash and a deliberate error as the same thing. To separate them you have to wrap each tool callback individually, inside the SDK's own `try` — and then decide separately how to detect [arguments that failed validation](/blog/bad-args-is-a-schema-problem) before your callback ever ran. [It took real work to get right](/blog/crashed-vs-tool-error).

**Empty answers.** A span marks a successful call as successful. Deciding that `[]`, `{}`, `""` or a text part containing an empty array was a failure is a rule you write, apply at the call site, and record as an attribute.

**Retries and first-call success.** These are properties of a *sequence* of calls — the same tool, inside thirty seconds, with different arguments. A span cannot know whether a later one will follow it. You need the calls in a session in order, a way to compare arguments without keeping them, and a pass that runs after the fact. [That is a batch job, not a span attribute](/blog/the-nightly-pass).

**Schema cost and dead tools.** These come from the tool list, not from calls. You would need to emit it at startup and join it against call counts to find [the tools nobody reaches](/blog/dead-tools).

**The client.** The model on the other end is named in the MCP handshake, not in the request. To split anything by client, you have to read it from the session and carry it onto every span — then [keep it as a dimension everywhere](/blog/averages-hide-clients).

None of that is impossible. It is an afternoon for the span and the attributes, and a good deal longer for the outcome wrapping, the sequence analysis, and the dashboard that turns them into something you can act on.

## The privacy default is the other way round

The easiest span to write is the one that records the arguments and the result as attributes, because that is what makes a trace useful for debugging, and it is the first thing anyone adds at 2am.

For an MCP server that is often a problem. Tool arguments are whatever the conversation contained, which in practice means customer names, email addresses and free text people typed. Putting them in span attributes ships them to your tracing backend, and from there into the [first question a security review asks](/blog/passing-a-security-review).

If you build this on OpenTelemetry, decide explicitly what you will not record. MCPulse made the opposite default structural: [there is no field that could hold an argument](/blog/why-we-hash-arguments), and no setting that adds one.

## Use both

The honest answer is that the two do different jobs.

OpenTelemetry tells you what happened inside a call: which dependency was slow, where an exception was thrown, how this call fits into the rest of your system.

MCP analytics tells you what the call meant to the model: whether it was understood, whether it had to be retried, whether the answer was usable, and what it cost the session. That is the part that needs MCP-specific decisions baked in, and it is what MCPulse records — [from inside your process](/blog/not-a-proxy), next to whatever tracing you already run.
