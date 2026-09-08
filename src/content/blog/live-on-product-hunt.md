---
title: MCPulse is live on Product Hunt
description: Sixteen metrics for MCP servers, two lines to install, and the per-client split that a server-wide average hides. Free for one server.
published: 2026-09-08
topic: Measurement
minutes: 4
---

You publish an MCP server and then you are blind. Not thin-analytics blind — there is nothing. You cannot see how many people installed it, which of your tools ever get called, whether the model understood the descriptions you wrote, or what your responses cost the people paying for context. The directories report none of it, and [neither does the protocol](/blog/what-mcp-servers-cannot-tell-you).

MCPulse is live on Product Hunt today.

<div style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; border: 1px solid rgb(224, 224, 224); border-radius: 12px; padding: 20px; max-width: 500px; background: rgb(255, 255, 255); box-shadow: rgba(0, 0, 0, 0.05) 0px 2px 8px;"><div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;"><img alt="MCPulse" src="https://ph-files.imgix.net/9e5908b8-9f4e-40f3-8b2b-caa0e9fffe9c.png?auto=compress,format&amp;codec=mozjpeg&amp;cs=strip&amp;fit=crop&amp;h=80&amp;w=80" style="width: 64px; height: 64px; border-radius: 8px; object-fit: cover; flex-shrink: 0;"><div style="flex: 1 1 0%; min-width: 0px;"><h3 style="margin: 0px; font-size: 18px; font-weight: 600; color: rgb(26, 26, 26); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">MCPulse</h3><p style="margin: 4px 0px 0px; font-size: 14px; color: rgb(102, 102, 102); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">Analytics for MCP servers</p></div></div><a href="https://www.producthunt.com/products/mcpulse?embed=true&amp;utm_source=embed&amp;utm_medium=post_embed" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 4px; margin-top: 12px; padding: 8px 16px; background: rgb(255, 97, 84); color: rgb(255, 255, 255); text-decoration: none; border-radius: 9999px; font-size: 16px; font-weight: 600; line-height: 1.5;">Check it out on Product Hunt →</a></div>

## What it measures

Sixteen metrics, and the headline one is first-call success: the share of calls where the model got what it asked for on the first attempt, without rewording the arguments and trying again. It is the closest thing there is to [a grade on your tool descriptions](/blog/first-call-success), because a description the model has to guess at produces a retry, and a retry is visible from inside the server even though the guess is not.

The rest are the things that go wrong, counted separately rather than pooled into one failure rate:

- **Bad arguments** — the model could not fill your schema in. [That is a message about the schema](/blog/bad-args-is-a-schema-problem), not about the model.
- **Tool errors and crashes**, which are [not the same event](/blog/crashed-vs-tool-error) and do not have the same fix.
- **Empty answers** — the call succeeded and returned nothing useful, which the protocol has [no way to describe as a failure](/blog/empty-results-are-failures).
- **Latency**, in four buckets, because [percentiles cannot be summed](/blog/percentiles-cannot-be-summed) across days.
- **Cost per session** and response size, which is [the number worth quoting](/blog/cost-per-session) when somebody asks what your server costs to use.
- **Dead tools** — [registered, described, and never once called](/blog/dead-tools), still charging their schema on every connection.

## The metric that needs a client column

One of these does not work as a server-wide number, and it is the important one.

If your first-call rate is 62%, that figure is an average over every model connecting to you. Averages hide exactly the thing you would act on: a description that Claude reads correctly and Cursor does not is invisible in a single percentage, because the good client's traffic pays for the bad one's. You get a number that says something is wrong and nothing that says where.

So every metrics table in MCPulse is keyed by the client as well as the tool. On the sample server every new account is seeded with — constructed, deliberately, to show the shape — one tool reads 76% first-call for `claude-desktop` and 21% for `cursor`, while the server-wide figure for that same tool is a flat 62%. Same tool, same description, same day. The gap is the finding, and a filter is the only way to see it.

That is also why the tool detail page compares clients against each other rather than against the server: a tool at 62% gives you nothing to change, and the same tool at 76% and 21% tells you the description is ambiguous rather than the handler broken.

## Two lines, inside your own server

```ts
import { watch } from "@mcpulse/sdk";

watch(server, { key: process.env.MCPULSE_KEY });
```

It is a package in your process, not a proxy in front of it. [That distinction is the whole design](/blog/not-a-proxy): a directory-listed server cannot change its URL, MCP's authorisation flows bind to the server's origin, and putting a metrics vendor in the request path makes our uptime your uptime. `watch` returns the same server, so nothing downstream changes — and if our API is unreachable the batch is dropped and [your tool call is unaffected](/blog/instrumentation-must-never-break-it).

## It never sees your arguments

Sizes and hashes. The arguments are hashed where they already are, in your process, and the plaintext never crosses a network boundary — so the claim is "we never receive it" rather than "we receive it and discard it", which is [a categorically different sentence](/blog/why-we-hash-arguments) to put in front of a security review.

There is no column for arguments or results in the database. That is the part worth checking when you compare us with anything else in this category: a product that records a tool call can usually record what was in it, and [the questions a review actually asks](/blog/passing-a-security-review) are about what you hold, not what you promise.

## Ten languages

One package per official MCP SDK — TypeScript, Python, Go, Rust, Java, Kotlin, C#, Ruby, Swift and PHP — each wrapping that language's own SDK.

One honest limitation, which the install page states per language rather than hiding: only the TypeScript, Python and Go MCP SDKs expose an interception point ahead of argument validation. The other seven wrap the tool handler, so a call rejected before the handler runs never reaches the package, and bad arguments are not reportable there. A metric silently pinned at zero is worse than one we admit we cannot measure.

## What it costs

Free covers one server, 10,000 calls a month, all sixteen metrics, and API and MCP access — that last one meaning you can connect your own analytics to Claude and ask about your server in the same window you use it. There is a [live demo with no sign-up](https://app.getmcpulse.com/m/demo), which is the real dashboard reading that sample server, not a screenshot of one.

If you write MCP servers, the thing we most want to know today is what you would measure that is not in the sixteen. The [Product Hunt thread](https://www.producthunt.com/products/mcpulse?utm_source=blog&utm_medium=post) is the fastest way to tell us, and we are reading it all day.
