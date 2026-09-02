---
title: How to test your MCP server's tool schemas
description: A twenty-minute pass — dump the real response, run four checks, fix the two faults that account for most of the corpus, then put one assertion in CI.
published: 2026-09-25
topic: Tool design
minutes: 6
---

You can test a tool schema without running a model against it. Not everything — but the two faults that show up on most public servers are both statically detectable, and finding them takes about twenty minutes.

Here is the pass, in order.

## 1. Get the real response

Not the code that builds it. The JSON your server actually emits:

```
npx @modelcontextprotocol/inspector
```

or call the method directly over stdio:

```
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

Do this against the running server, with the same registration code paths a client would hit. Servers that build their tool list conditionally — on config, on credentials, on a feature flag — can emit something different from what you expect, and [nine servers in the public corpus ship a duplicate tool name entirely because their list is generated](/blog/duplicate-tool-names).

Save it to a file. Everything below reads that file.

## 2. Run the four checks

**Undescribed parameters.** Walk every `inputSchema.properties` — including nested objects and array `items` — and list the ones with no `description`. This is the most common fault in the corpus at **21.5% of parameters**, and it is flat at every server size, so being small does not protect you.

**Colliding descriptions.** For each tool, take the content words in its description and count how many appear in no other tool's description. Any tool at zero has nothing in its prose to distinguish it. **17.7%** of public tools are at zero.

**Prose enums.** Grep your descriptions for `valid values`, `options:`, `must be one of`, or a pipe-separated list. For each hit, check whether the parameter actually has an `enum`. [857 parameters in the corpus](/blog/valid-values-open-string) name their set and leave the schema open.

**Size.** Byte length of the whole response, divided by four. Compare against [the corpus median of about 1,251 tokens and p90 of 7,992](/blog/what-your-tool-list-costs).

[The schema checker](/check) does all four on a paste, in your browser, and scores each against servers your own size — which matters, because collision rates run from 0.5% on a three-tool server to 32.4% past sixty and a corpus average tells a small server nothing.

## 3. Read it once as a block

The checks above are mechanical. This part is not, and it finds things they cannot.

Print the whole tool list and answer three questions a model has to answer:

- Given a plausible user request, which tool would I pick? If two are defensible, that is an ambiguity in the schema, not in the request.
- For each parameter, could I supply a value with only the type and the description? If not, the description is missing something.
- What comes back? Almost no descriptions say, and [the return shape is the most distinguishing thing about a read-only tool](/blog/what-makes-a-good-description).

## 4. Fix in this order

Cheapest and most common first:

1. **Add the missing parameter descriptions.** One clause each: what the field is for, what a valid value looks like. No design consequences, and it is the corpus's most likely fault.
2. **Convert the prose enums.** A one-line change per parameter, and it turns a hint the model may ignore into a constraint it cannot break.
3. **Rewrite colliding descriptions** to lead with the difference rather than the category. Name the return shape; include one specific.
4. **Only then consider structure.** [Past about thirty tools, rewording stops being the fix](/blog/should-you-split-a-large-mcp-server) — but do not restructure before you have done the first three, because they are cheap and reversible and it is not.

## 5. Put one assertion in CI

The checks above are a point-in-time pass. What keeps them true is a test, and the two worth automating are the ones a human will never catch again:

```ts
const tools = await server.listTools();

// A duplicated name silently makes one tool unreachable.
const names = new Set<string>();
for (const t of tools) {
  if (names.has(t.name)) throw new Error(`duplicate tool: ${t.name}`);
  names.add(t.name);
}

// Every parameter, at every depth, must be described.
for (const t of tools) {
  for (const [path, schema] of walk(t.inputSchema)) {
    if (!schema.description?.trim()) {
      throw new Error(`${t.name}: ${path} has no description`);
    }
  }
}
```

The first is a line and catches the generation bug. The second is the one that actually pays: undescribed parameters arrive one PR at a time, and a test is the only thing that notices.

If a total ban is too strict for your codebase, assert a ceiling instead — fail the build above 5% undescribed. That still beats the corpus by four times and it will not block a merge on a legitimately self-evident field.

## What this pass cannot tell you

It reads a schema sitting still. It cannot tell you whether a model actually picks the wrong tool, whether an undescribed parameter actually causes a bad call, or whether your descriptions read well to the specific model your users run.

It also cannot see correctness. A tool that returns confident nonsense passes every check here.

For any of that you need traffic — [which tools get retried, which return empty, what a session actually costs](/blog/first-call-success). A schema check is the half you can do before you have users.
