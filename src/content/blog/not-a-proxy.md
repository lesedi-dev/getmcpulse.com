---
title: Why the SDK runs inside your server instead of in front of it
description: A proxy is the easier product to build and the wrong one to ship. Directory-listed servers cannot change their URL, and OAuth breaks the moment traffic is redirected.
published: 2026-06-16
topic: Engineering
minutes: 5
---

The obvious way to build analytics for MCP servers is a proxy. Point your traffic at us, we forward it, we see everything. No SDK, no versions, no integration work, and it supports every language on day one.

We did not build that, and the reasons are worth stating because they are the same reasons a proxy would be a bad thing to accept.

## A listed server cannot change its URL

MCP servers get discovered through directories and client configs. Once your URL is published, it is in registries you do not control and in config files on machines you cannot reach.

A proxy requires that URL to change. Every existing user keeps hitting the old address until they individually update — which most never will. You would be trading your installed base for a dashboard.

## OAuth does not survive the redirect

This is the hard blocker. MCP authorisation flows bind to the server's origin: discovery documents, redirect URIs, audience claims, token validation. Put a different host in the middle and the flow breaks — sometimes visibly, sometimes as a token that validates against the wrong audience, which is worse.

You would be asking customers to weaken the part of their setup that protects their users, in exchange for metrics.

## Their uptime becomes your uptime

A proxy is in the request path. If it is slow, the customer's server is slow. If it is down, the customer's server is down.

That is an unreasonable thing to ask of an analytics product. Nobody should accept a hard dependency on a monitoring vendor for their production traffic — the failure mode is that the tool watching for problems becomes the problem.

The SDK sits beside the traffic instead of in it. It records, buffers in memory, and returns. If our API is unreachable, the batch is dropped and your tool call is unaffected. Your server does not know or care whether we are up.

## We would have to hold everything

A proxy sees full request and response bodies by construction. Every argument, every result, every customer record that passes through.

You can promise not to store it. You cannot promise not to have it — it is in memory on our machines by definition, and that fact alone changes what a security review concludes.

Running inside the process means the arguments never leave. The SDK hashes them where they already are and the plaintext never crosses a network boundary. "We never receive it" is a categorically different claim from "we receive it and discard it".

## What it costs us

The honest downside: one package per language. Today that is TypeScript, because that is what most MCP servers are written in. Python is real work rather than a config change.

There is also more surface for things to go wrong, because the SDK runs inside someone else's process. Which is why the three rules are absolute — never throw, never block, never store customer data — and why, if the server internals are not the shape expected, `watch()` hands your server back untouched and runs without analytics rather than risk breaking it.

Those are real costs. They are worth paying, because a proxy would ask every customer to change their URL, weaken their auth, and take a production dependency on a metrics vendor — and the only party that benefits from that arrangement is the metrics vendor.

## What you actually do

```ts
import { watch } from "@mcpulse/sdk";

watch(server, { key: process.env.MCPULSE_KEY });
```

Your URL does not change. Your OAuth does not change. Your transport does not change. `watch` returns the same server, so nothing downstream changes either.
