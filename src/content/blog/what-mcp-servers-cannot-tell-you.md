---
title: What MCP servers cannot tell you
description: You ship a server, it gets listed, people install it. From that moment on you are working blind — and the directories report almost none of what you need.
published: 2026-08-11
topic: Measurement
minutes: 6
---

You built an MCP server. You registered eight tools, wrote careful descriptions for each one, tested them against Claude Desktop until they behaved, and published. It got listed. People installed it.

Now answer these:

- How many people used it last week?
- Which of your eight tools did they actually reach?
- When the model called `search_orders`, did it get something useful on the first try?
- How many tokens does your server cost a user across a typical session?
- Is there a tool in there that nobody has ever called?

You cannot answer any of them. Not approximately, not with effort. The information does not leave the process, and nothing in the protocol makes it leave.

## What the directories give you

Install counts, sometimes. A star rating if the directory has one. Neither is a measurement of your server; they are measurements of your listing. An install is a decision made before anyone used the thing, based on your README. A star is a decision made by the small fraction of users who felt strongly enough to click.

Between those two events sits every fact that would actually let you improve the server, and none of it is recorded.

## Why your normal instincts fail here

If this were an HTTP API you would already have the answers. Logs, a status code per request, latency in the access log, a dashboard someone set up in an afternoon. The habits transfer badly to MCP for three reasons.

**A tool call is not a request you can read from outside.** Over stdio there is no HTTP layer to instrument. Over streamable HTTP there is one, but every call is a POST to the same endpoint with a JSON-RPC body — your access log is one row repeated, with no tool name in it.

**Everything looks like a 200.** The MCP SDK catches what your handler throws and converts it into a result with `isError: true`. From outside the request handler, a crash, a deliberate error return, and a set of arguments that failed validation are the same shape. Your logs, if you have them, say the call completed.

**Success is not the same as usefulness.** A tool that returns `[]` has succeeded by every definition the protocol has. The model got nothing it could use, tried something else, and the user watched it flounder. Nothing anywhere recorded a problem.

That third one is the killer. The failures that damage your server the most are the ones that report success.

## The questions worth answering

Once you can see inside the call, a specific set of questions turns out to matter — and they are not the ones a web dashboard would show you.

**Did the model get it right the first time?** Not "did the call succeed" — did the model ask once, get something usable, and move on? When it has to call the same tool three times with reworded arguments, your description is the thing that failed, not your code.

**What is your server costing in context?** Every tool schema is sent to the model on every session, whether it is used or not. Every result is tokens the user pays for. A tool returning 14kb of JSON is spending roughly 3,500 tokens of someone's context window each time it runs.

**Which tools are dead?** Registered, described, shipped, and never once called. They are pure cost: schema tokens on every session, in exchange for nothing.

**What ran alongside what?** Models chain tools. Knowing that `search_orders` is almost always followed by `get_customer` tells you those two should probably be one tool, or that the first should return more.

## What MCPulse does about it

It is an npm package you install inside your own server — not a proxy. Your URL does not change, which matters because a directory-listed server cannot change its URL and OAuth breaks the moment traffic is redirected. The package sits beside your traffic rather than in it, so if we go down, your server keeps serving.

It records four things per call: which tool, how long, how it ended, and how big the answer was. Every call ends as exactly one of `ok`, `bad_args`, `tool_error`, or `crashed` — the distinction the SDK erases, recovered by wrapping your tool callbacks as well as the request.

**Never the arguments, and never the results.** What leaves your process is a twelve-character hash of the arguments with keys sorted, which is enough to tell whether two calls were the same and not enough for anything else. There is no setting that changes this, because a guarantee you can switch off is not a guarantee.

Two lines, after your tools are registered:

```ts
import { watch } from "@mcpulse/sdk";

watch(server, { key: process.env.MCPULSE_KEY });
```

`watch` returns the same server, so nothing downstream changes.

## The thing you will find first

Everyone finds the same thing within a day: one tool with a first-call success rate far below the rest.

It is almost never broken. It works perfectly when you call it. The description is ambiguous, or one parameter is named something the model reads differently than you meant, and so the model guesses, gets an error, rewords, guesses again. Three calls where one would do. The user experiences it as "this server is slow and a bit stupid".

You cannot fix that with tests, because your tests call the tool correctly by construction. You can only fix it by watching what happens when something that is not you decides what to send.
