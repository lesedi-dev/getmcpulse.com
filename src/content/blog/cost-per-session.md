---
title: Cost per session is the number to quote
description: Not the monthly bill — that measures how popular you are. Cost per session measures how expensive you are, which is the part you control.
published: 2026-04-07
topic: Measurement
minutes: 4
---

Someone evaluating your MCP server eventually asks what it costs to run. The honest answer is not a monthly figure, because that is mostly a statement about how many people use it.

The number that describes your server is cost per session: what one conversation with your tools spends in context.

## How it is computed

Total response bytes across the range, divided by the number of sessions, converted to tokens and then to money.

Tokens are approximated as bytes ÷ 4, at a default of $3 per million input tokens. Both constants live in one service and appear nowhere else — a rate scattered across a codebase is a rate that has three different values within a year.

The approximation is deliberate. Running a real tokeniser over every payload would mean holding results long enough to tokenise them, which breaks the rule that nothing but sizes and hashes leaves the process. Bytes ÷ 4 is close enough to compare tools against each other and to watch a change land, which is what the number is for.

## Why sessions, not calls

Cost per call rewards the wrong thing. Split a heavy tool into two lighter ones and your cost per call halves while the conversation spends exactly the same tokens — plus an extra round trip.

A session is one person doing one piece of work. It absorbs retries, chains and pagination, so it is the honest unit: everything the model had to do to get an answer, counted once.

It is also the unit that catches the failure mode nobody looks for. A tool that is individually cheap but always called four times in a row is expensive, and only a per-session view shows it.

## The counting trap underneath it

Sessions cannot be counted from a bucketed table. A conversation that starts at 23:40 and ends at 00:20 belongs to two days, and summing daily counts reports it twice — so the range total runs permanently high, by an amount nobody can see.

So sessions have their own table, one row per session ever, carrying `total_bytes` on the row. Counting sessions means counting rows whose start falls in the range, and the division uses bytes from the same rows the count came from. Taking the numerator from one place and the denominator from another is how a ratio ends up wrong in exactly the cases that matter.

## Why it goes blank under a tool filter

Filter the overview to one tool and the cost per session card shows a dash.

A session belongs to the server, not to a tool. There is no such thing as "sessions for `search_orders`" — the user had one conversation that happened to touch it. Dividing that tool's bytes by the server's session count would produce a number that looks narrowed and is not.

MCPulse shows zeros almost everywhere rather than dashes, because a quiet server has a complete answer. This is the one case where a dash is right: the figure does not apply, rather than being zero or unknown. The filter panel says so, so the blank is understood rather than reported as a bug.

## Moving it

Cost per session is driven almost entirely by response size, and response size is usually dominated by one tool.

Sort tools by average bytes, multiply by calls, and the top row is where the money is. Trim that tool's payload — drop internal fields, cap the result set, return IDs instead of full records where a follow-up tool exists — and the whole figure moves in a day.

Then quote it. "One session with our server costs about $0.02 of context" is a claim almost no MCP server can make, and the people integrating yours will notice that you know.
