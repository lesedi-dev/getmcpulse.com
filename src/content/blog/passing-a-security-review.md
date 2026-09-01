---
title: Five questions a security review asks about your analytics
description: If your MCP server touches customer data, someone will ask what your monitoring vendor receives. These are the five questions, and the answers that end them.
published: 2026-03-31
topic: Privacy
minutes: 4
---

Adding analytics to an MCP server that handles real data means someone will eventually review it. Sometimes a customer's security team, sometimes your own, sometimes a questionnaire before a contract.

The questions are predictable. What matters is whether the answers are architectural or procedural — because "we don't do that" is worth very little next to "we cannot do that".

## 1. What leaves the process?

The complete payload, per call:

```json
{
  "v": 1,
  "type": "call",
  "session_id": "s_7f2a91",
  "tool_name": "search_orders",
  "client_name": "claude-desktop",
  "started_at": "2026-08-09T14:22:31Z",
  "duration_ms": 240,
  "outcome": "ok",
  "response_bytes": 1420,
  "is_empty": false,
  "args_hash": "9c1b4e2f0a11"
}
```

And once at startup, the tool list with a byte count per schema.

Every field is a dimension, a duration, a size or a hash. There is no field that could hold customer data, which is a stronger statement than a promise about how the fields are used.

## 2. Do you receive tool arguments or results?

No, and not as a policy.

`response_bytes` is `JSON.stringify(result).length` — computed in your process, and the string is discarded. `args_hash` is twelve hex characters of SHA-256 over the arguments with keys sorted, computed in your process, and the arguments never cross a network boundary.

This is the question where a proxy-based product has to give a different answer. A proxy sees full bodies by construction; it can promise not to store them, but it has them in memory on its own machines. Running inside your process means the plaintext never leaves it.

## 3. Can it be turned on?

No. There is no `captureArguments` flag, at any tier.

This matters more than it sounds. If the capability exists in the code, the accurate answer becomes "we do not store arguments unless configured to" — and a reviewer's next question is who can change that configuration, and how it is audited. Not having the code path removes the question entirely.

## 4. What happens if you are unavailable?

Nothing, to you. The SDK is not in the request path. It records into an in-memory buffer and returns; a separate flush sends batches every 30 calls or 5 seconds.

If the API is unreachable the batch is dropped. No retry queue, no backoff, no growth — the buffer is capped at 1,000 and sheds oldest first, so an outage on our side cannot become a memory problem on yours.

Your MCP server keeps serving. You lose metrics for the duration, which is the correct thing to lose.

## 5. What is the blast radius if the package misbehaves?

Every entry point is wrapped in a `try/catch` that swallows. Instrumentation failures are dropped; your call is untouched.

At attach time, if the server internals are not the shape expected, nothing is patched — `watch()` hands back your server exactly as it arrived, running without analytics. Degrading to no data is always preferable to degrading someone's production server.

The dependency surface is zero: no runtime dependencies at all, so there is no transitive tree to audit and nothing to advisory-scan beyond the package itself.

## The one thing to check yourself

The ingest key is a secret. Anyone holding it can write data into your MCP — not read yours, but pollute it. Keep it in the environment, out of the repository, and out of anything shipped to a client.

Only a SHA-256 hash and the first twelve characters are stored on our side, which is why the full key is shown exactly once at creation. If it leaks, revoke it and mint another; that is a thirty-second operation and it is why keys are named at creation, so you can tell which one to revoke.
