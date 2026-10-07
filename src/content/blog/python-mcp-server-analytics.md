---
title: Adding analytics to a Python MCP server
description: pip install, one import, one wrap. What it attaches to in mcp 2.x and 1.x, what it records, and the one option worth setting in your test suite.
published: 2026-10-07
topic: Engineering
minutes: 4
---

If your MCP server is written against the official Python SDK, adding analytics is one install and two lines.

```bash
pip install mcpulse-sdk
```

```python
import os

from mcp.server.mcpserver import MCPServer
from mcpulse import watch

mcp = MCPServer("my-server")

# … your @mcp.tool() definitions …

watch(mcp, key=os.environ["MCPULSE_KEY"])
```

`watch()` instruments the server in place and hands the same object back, so it drops in around a server you already have without moving anything. The key comes from creating a server in the [dashboard](https://app.getmcpulse.com); it is shown once, so put it straight into your environment.

## Why the package and the import have different names

The distribution is `mcpulse-sdk` and the import is `mcpulse`. `mcpulse` on PyPI belongs to an unrelated project, and PyPI has no scopes to fall back on the way npm does, so the package mirrors the npm name, `@mcpulse/sdk`, instead.

It has no runtime dependencies. `mcp` is your dependency, not ours, and nothing else comes into your tree.

## What it attaches to

**On `mcp` 2.0 and later**, it attaches through `Server.middleware`, the SDK's supported extension point. Nothing private is touched.

**On `mcp` 1.x**, there is no middleware chain, so it falls back to wrapping the dispatcher's handler map.

In both cases it then wraps your own tool callbacks too. That second wrap is what makes the outcome column trustworthy: the MCP server converts a thrown exception and a failed argument validation into the same `isError` result before anything outside can see them, so the only place to tell [a crash from a deliberate error](/blog/crashed-vs-tool-error) is inside the callback, before the SDK catches it.

Python is one of the SDKs where all four outcomes are visible, `bad_args` included. In some languages the host SDK validates arguments before any extension point runs, so a rejected call never reaches the package — Python is not one of them.

## What it records

Per call: the tool name, the client name from the handshake, how long it took, which of `ok`, `bad_args`, `tool_error` or `crashed` it ended as, the byte size of the result, whether the result was empty, and a twelve-character hash of the arguments.

At startup: each tool's name and the byte size of its schema, which is [what makes dead tools and schema cost visible](/blog/dead-tools) before any traffic arrives.

Never the arguments, never the results, and no option to turn that on. The full list is [field by field here](/blog/what-mcpulse-receives).

## It stays off your event loop

Recording writes into an in-memory buffer and returns. Batches are sent from a background thread, never from your event loop, so an async server does not wait on us between a tool call and its response.

If our API is unreachable, the batch is dropped. There is no retry queue to grow, and the buffer is capped, so an outage on our side [costs you data and never memory](/blog/instrumentation-must-never-break-it).

## Three options worth knowing

| Option | Default | Use it for |
|---|---|---|
| `enabled` | `True` | `False` makes `watch()` a no-op — set it in tests and CI |
| `debug` | `False` | Logs what is sent, and why a send failed, to stderr |
| `endpoint` | the hosted API | Pointing at a local API while developing |

`enabled=False` is the one to set first. Your test suite calls your tools on purpose and with correct arguments, and those calls are not the traffic you want graded.

`debug` writes to **stderr**, never stdout. A stdio MCP server speaks JSON-RPC over stdout, and a single stray print there corrupts the stream and disconnects the client with an error that points nowhere near the cause.

An empty key also turns it off, so a server started without its key configured is silent rather than a source of failed sends on every flush.

## What to look at first

Restart the server and the tool list arrives straight away. The per-call numbers fill in as traffic does, and [first-call success](/blog/first-call-success) appears the morning after, because it is computed overnight.

[This is the order to read the rest in](/blog/mcp-server-analytics-first-week).
