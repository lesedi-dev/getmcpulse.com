---
title: How to read a tools/list response
description: The JSON your MCP server returns is the entire brief a model gets. Here is how to read it the way a model has to, field by field.
published: 2026-09-24
topic: Tool design
minutes: 6
---

When a client connects to your MCP server, it calls `tools/list` once. What comes back is everything a model will ever know about your tools — no documentation, no README, no repository.

Most authors have never read their own response. It is worth doing once, because it looks very different from the code that produced it.

## Getting it

The quickest way is the official inspector:

```
npx @modelcontextprotocol/inspector
```

Point it at your server, open the Tools tab, and it will show you the parsed list. To see the raw JSON — which is what you actually want — most clients will log it, or you can call the method directly over stdio:

```
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

Pipe that into your server on stdin and read what comes back on stdout.

## The shape

```json
{
  "tools": [
    {
      "name": "search_orders",
      "description": "Find orders by customer, status or date range.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "customer_id": {
            "type": "string",
            "description": "Internal customer ID, e.g. cus_8f21a."
          },
          "status": {
            "type": "string",
            "enum": ["open", "shipped", "cancelled"]
          }
        },
        "required": ["customer_id"]
      }
    }
  ]
}
```

Four things per tool, and each one does a different job.

**`name`** is the identifier and, more importantly, the fallback. When a description fails to distinguish a tool, the name is what the model chooses on — [in 89.6% of collision cases it is carrying the decision](/blog/why-models-pick-the-wrong-tool).

**`description`** is the only free prose you get. Its job is not to explain the tool; it is to distinguish this tool from the others in the same list.

**`inputSchema.properties`** is one entry per parameter. Each can carry a `type`, a `description`, an `enum`, a `default`, and more — and [across 4,749 public servers, 21.5% carry no description at all](/blog/21-percent-of-parameters).

**`required`** says which parameters must be present. Worth knowing that some registries strip this field when they store a response, so what a directory shows you is not always what your server sends.

## Reading it the way a model does

Three habits change what you notice.

**Read the whole array at once, not tool by tool.** You wrote the tools one at a time; the model receives them as a single block and has to choose between them. Print all of it and ask: if I only had this, which tool would I pick for "find last week's cancelled orders"? If two are plausible, that is a real ambiguity, not a hypothetical one.

**Read the parameters without the names.** Cover the keys and look only at the types and descriptions. `{"type": "string"}` twice is what the model has for two different fields. If you cannot tell which is which, neither can it.

**Count what it costs.** Take the byte length of the whole response and divide by four for a rough token count. [The median public server is about 1,251 tokens](/blog/what-your-tool-list-costs), sent on every single connection whether a tool is called or not.

## Five things to look for

Working down by how often they occur in the corpus:

| Look for | How common |
|---|---|
| A parameter with `type` and no `description` | **21.5%** of all parameters |
| A tool whose description shares every word with a sibling | **17.7%** of tools |
| A description that names its valid values in prose while the schema says `string` | 857 parameters |
| A tool that has never been called and is still in the list | most servers have one |
| A duplicate tool name | 0.19% of servers — ignore this one |

The last row is there deliberately. Duplicate names are the thing people check for and [they almost never happen](/blog/duplicate-tool-names). The first two are a hundred times more likely and get checked far less.

## The one that is hardest to see

A tool that reads perfectly on its own and is indistinguishable in context:

```
tool_markdown_to_html    "Convert Markdown to HTML."
tool_html_to_markdown    "Convert HTML to Markdown."
```

Two real tools from one real server. Both descriptions are correct and minimal. As bags of content words they are identical, so word order is carrying the entire distinction — and you will never notice reading them one at a time.

## Doing it automatically

[Paste your response into the schema checker](/check) and it runs the five checks above, scored against 4,749 public servers and against servers your own size. It prints each flagged description with the words your other tools also use marked, which is the fastest way to see a collision you would otherwise read straight past.

It runs in your browser and nothing is uploaded, so an unreleased server is fine.

Once your server is running and taking real traffic, the questions change — which tools get called, which get retried, which return nothing. That is [what a schema cannot show you](/blog/what-mcp-servers-cannot-tell-you).
