---
title: Telling a crash from an error return is harder than it looks
description: "The MCP SDK catches whatever your handler throws and turns it into isError: true. From outside the request handler, a bug and a deliberate error are the same object."
published: 2026-07-07
topic: Engineering
minutes: 5
---

MCPulse records exactly one outcome per call:

| | |
|---|---|
| `ok` | Ran and returned a result. |
| `bad_args` | Arguments failed schema validation — your handler never ran. |
| `tool_error` | Ran and returned `isError: true`. |
| `crashed` | Threw. |

The distinction between the last two is the one that took real work, and it is the one that matters most in practice. `tool_error` is your code working: a condition you anticipated, reported deliberately. `crashed` is your code failing. They belong in different columns and they demand different responses.

The protocol does not distinguish them.

## What the SDK does

`McpServer` wraps tool execution in a `try/catch`. When your handler throws, it catches the exception and returns a normal result with `isError: true` and the message as text.

That is correct behaviour — a thrown exception should not take down the connection. But it means that by the time the response leaves the request handler, these two are the same object:

```ts
// You reported a condition.
return { content: [{ type: "text", text: "Order not found" }], isError: true };

// You had a bug.
throw new TypeError("Cannot read properties of undefined (reading 'id')");
```

Same shape. Same `isError: true`. Anything instrumenting at the request boundary sees one category where there are two.

## Why guessing from the message does not work

The obvious workaround is to inspect the error text. It fails immediately.

A deliberate `"Order not found"` and a thrown `new Error("Order not found")` produce identical text. Some runtimes include a stack, some do not. A `TypeError` from a genuine bug can carry a message that reads exactly like a business rule. You would be building a heuristic on top of a string that your users control, and it would be wrong in both directions — misreporting real crashes as handled errors, and handled errors as crashes.

An analytics product that quietly guesses is worse than one that does not answer. If the crash count is unreliable, nobody can act on it.

## Wrapping the callback, not the request

The fix is to be inside the `try`, not outside it.

The SDK stores tool callbacks in a registry. MCPulse replaces each one with a wrapper that calls the original inside its own `try/catch`. When your handler throws, the wrapper sees the exception *before* `McpServer` catches it, records `crashed`, and rethrows — so the SDK's own handling proceeds exactly as it would have.

From there:

- The wrapper caught an exception → `crashed`
- The handler returned normally with `isError: true` → `tool_error`
- Argument validation rejected the call before the handler ran → `bad_args`
- Anything else → `ok`

Correlating that back to the outgoing response uses `AsyncLocalStorage`: the request handler opens a context, the callback wrapper writes the outcome into it, and the response records what is there. No global mutable state, and concurrent calls cannot cross-contaminate.

`bad_args` comes from a different place again — validation runs before your callback, so the wrapper never fires. That case is detected at the request layer, which is the one point where the failure is visible and unambiguous.

## Not breaking the thing being measured

All of this is patching a live object inside someone else's server, so the rules are strict.

The wrapper rethrows. It never swallows, never transforms, never delays. If the instrumentation itself throws while recording, that exception is caught and dropped — your tool's behaviour must be bit-identical whether or not MCPulse is installed.

And if the internals are not the shape we expect, because the SDK changed, nothing is patched. `watch()` hands back your server untouched and it runs without analytics. A monitoring package that breaks a server on a minor version bump has done far more damage than the metrics were worth.

## What the split is worth

Once separated, the two numbers say different things.

A steady low `tool_error` rate is healthy. It means your tools report conditions properly instead of returning empty results and hoping.

Any `crashed` rate is a bug list. Sorted by tool, it is the shortest path to the ones your tests missed — the ones that only happen when something that is not you decides what to send.

Combined into one "error rate", they cancel each other out, and the number tells you nothing you can act on.
