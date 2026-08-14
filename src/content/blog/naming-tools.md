---
title: Naming tools for a reader who cannot see your API
description: The model has your tool name, your description, and nothing else. No source, no docs site, no colleague to ask. The name is doing more work than you think.
published: 2026-04-28
topic: Tool design
minutes: 4
---

When a developer meets an unclear function name they can jump to the definition, read the tests, or ask whoever wrote it. Ambiguity is a small tax.

A model has the name, the description, and the schema. That is the entire universe. Ambiguity is not a tax — it is a coin flip, resolved at runtime, on your users' time.

## Verb first, and use a real one

`orders`, `customer_data`, `invoice_handler` — none of these say what happens when you call them. Does `orders` list, search, or create?

`search_orders`, `get_customer`, `create_invoice`. The verb is the first thing read and it carries the most information.

Use verbs that mean distinct things and use them consistently across the server:

- `get_` — one thing, by identifier
- `list_` — many things, no filter or a trivial one
- `search_` — many things, by criteria
- `create_` / `update_` / `delete_` — writes

Once that vocabulary is consistent, a model can predict what a tool does from its prefix, which is a real reduction in the number of ways it can be wrong.

## Two tools should not describe the same territory

`search_orders` and `list_orders` are the classic pair. The names do not say which handles a filter, so the model picks by coin flip and discovers the answer by getting it wrong.

Either merge them, or make the boundary part of the name and repeat it in both descriptions. Merging is usually right — one tool with an optional filter has one argument shape and no choice to get wrong.

## Namespace when you have to, not by default

`acme_search_orders` costs tokens on every session and reads as noise when there is no collision.

It becomes worth it when a user is likely to have another server offering something similar. If your tool is `search_documents` and half your users also run a Google Drive server, prefixing prevents a genuinely ambiguous choice. Otherwise, skip it.

## Parameter names are where calls actually fail

Tool names get read carefully because the model is choosing. Parameter names get read fast, because by then the decision is made and it is filling in a form.

So parameters need to be unmistakable:

- `customer_ref` → is that an ID, an email, a name? The model guesses.
- `customer_email` → never guessed wrong.
- `date` → for what? Created, shipped, due?
- `created_after` → unambiguous, and the comparison direction is in the name.

The pattern: put the type or the unit in the name when it is not obvious. `limit` is fine. `timeout` is not — `timeout_ms` is.

## Do not name after your internals

`fetch_order_aggregate`, `list_sku_variants`, `get_account_hierarchy`. These names come from your data model, and the model has never seen your data model. It has seen a user say "what did they order last week".

Name after the question a user would ask. If the internal concept genuinely has no user-facing equivalent, that is worth noticing — it may mean the tool is unreachable from any real conversation, which is one of the ways tools end up dead.

## How you find out you got it wrong

The first-call success rate per tool, and the argument hashes behind it.

A tool with a bad rate and many distinct hashes in a short window is a tool the model keeps rephrasing at. That is not a code problem and no test will catch it, because your tests call it with the arguments you had in mind when you named the parameter.
