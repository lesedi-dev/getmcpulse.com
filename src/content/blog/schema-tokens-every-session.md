---
title: Your tool schemas are billed on every session, used or not
description: Descriptions and JSON Schema go into the context window at the start of every conversation. Twelve tools can cost 3,000 tokens before anyone asks a question.
published: 2026-07-21
topic: Tool design
minutes: 5
---

When a client connects to your MCP server it calls `tools/list`. Every tool you registered comes back — name, description, and the full JSON Schema for its arguments — and all of it goes into the model's context window.

That happens before the user has typed anything. It happens on every session. It happens for tools nobody will call.

This is the cost of your server that nobody measures, and for most servers it is the largest one.

## Doing the arithmetic

Take a plausible tool:

```json
{
  "name": "search_orders",
  "description": "Search orders by customer, status, or date range. Returns up to 50 matching orders with their line items.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "customer_email": { "type": "string", "description": "Customer's email address" },
      "status": { "type": "string", "enum": ["pending", "shipped", "delivered", "cancelled"] },
      "from": { "type": "string", "format": "date" },
      "to": { "type": "string", "format": "date" }
    }
  }
}
```

Serialised, that is about 480 bytes — roughly 120 tokens.

Twelve tools of that size is around 1,400 tokens per session. Verbose descriptions and nested schemas push it much higher; servers in the 4,000–6,000 token range are common, and it is not hard to find worse.

At $3 per million input tokens the money is trivial. That is not the cost that matters.

## The cost that matters is attention

The real price is paid in the context window. Every token of schema is a token not available for the conversation, and — more importantly — one more thing the model has to read past to find the tool it needs.

This is the effect people underestimate. A model choosing between four sharply described tools picks well. The same model choosing between eighteen, several of which overlap, picks worse. You will see it in your first-call success rate long before you see it on a bill.

So the question for every tool is not "does this work" but "does this earn its place in every conversation".

## Which is why dead tools are worse than they sound

MCPulse records schema size from the startup payload — `JSON.stringify(schema).length` per tool, sent once when your server boots. Combined with call counts, that produces a specific and slightly uncomfortable number:

> `export_report` has never been called, but costs 480 tokens of schema every session.

A tool with no calls is not neutral. It is a fixed tax on every conversation, paid in the scarcest resource the model has, in exchange for nothing at all.

## Trimming without losing accuracy

**Cut tools before cutting words.** Removing one unused tool saves more than tightening the prose in five.

**Descriptions are for disambiguation, not documentation.** The model needs to know when to pick this tool over its neighbours. It does not need your changelog, your rate limits, or a worked example — those cost tokens on every session to serve a case that arises rarely.

**Enums are cheap and worth it.** Four values in an `enum` cost a handful of tokens and remove an entire class of `bad_args`. This is one of the few places where more schema pays for itself.

**Do not describe self-evident parameters.** `"customer_email": { "type": "string", "description": "Customer's email address" }` — the name already said it. Delete the description and lose nothing.

**Watch for duplication across tools.** Five tools that each explain your pagination convention are paying for that explanation five times per session.

## The measurement that settles arguments

Sort your tools by schema bytes, then look at calls next to them. The tools at the top of the first list and the bottom of the second are your answer.

You are not looking for a small saving spread across everything. You are looking for the two tools costing 800 tokens a session between them and getting called once a week — because deleting those is free, and it makes every remaining tool easier for the model to choose correctly.
