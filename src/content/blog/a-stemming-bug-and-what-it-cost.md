---
title: A stemming bug, and what it cost us
description: Our counter did exact string matching, so `screens` and `screening` were two words. Every collision figure we published was optimistic. The corrected ones.
published: 2026-09-21
topic: Measurement
minutes: 9
---

In July we published [a survey of 4,749 public MCP servers](/blog/reading-5000-mcp-schemas). The headline was that **one tool in six** carries a description with no word that distinguishes it from a sibling.

It is one tool in four and a half. The counter had a bug, and every collision figure in that post was optimistic.

Here is the bug, the corrected table, and the four other things readers found that we got wrong or never measured.

## The bug

The distinctive-share counter did exact string matching on content words. Two tools on a real server in the corpus:

```
analyze_job_description   "Extract what a job posting actually screens on."
optimize_resume           "Rewrite a resume so it passes ATS screening."
```

`screens` and `screening` are the same word. The counter scored both tools as distinctive **on the one term that actually links them** — and then reported the pair as healthy.

That is not an edge case. It is every plural, every gerund and every past tense in 82,549 descriptions.

## The corrected figures

Stemming can only merge words, never split them, so the direction was predictable: distinctiveness could only fall, collision could only rise. The size was not predictable, and it is large.

| | published | corrected |
|---|---|---|
| Tools with nothing to distinguish them | 17.7% | **22.9%** |
| Median distinctive share | 26% | **20%** |
| Under 10% distinctive | 27.0% | **34.1%** |
| Nothing distinct in the description *or* the name | 20.9% | **26.1%** |

And the result the original post led with — collision rising with server size — is steeper than we said:

| Tools on the server | published | corrected |
|---|---|---|
| 1–3 | 0.5% | **1.2%** |
| 4–7 | 1.6% | **2.3%** |
| 8–15 | 4.4% | **6.2%** |
| 16–30 | 7.6% | **10.8%** |
| 31–60 | 16.6% | **21.9%** |
| **61+** | **32.4%** | **40.8%** |

**The correction grows with server size**, which makes sense once you see why: the more siblings a tool has, the more chances one of them has to have written an inflection of its words. A 61-tool server is now better than two in five.

## What did not move, and why that matters

**The parameter figures did not change at all.** 21.5% of parameters ship with no description, before and after.

That is the check that this was a word-counting bug and nothing broader. Those metrics test whether a field is present. No stemmer can change that, and if they *had* moved we would have had a much bigger problem than a stemmer.

## Four more things, all from readers

The post got more useful mail than anything else we have published. Four of the corrections below came from readers, and two of them contradict each other in a way that turned out to be the most interesting result of the lot.

### 1. 21.5% is a floor, twice over

One reader pointed out that a parameter described as `"query: The query"` passes our check. It does. The description is populated and says nothing the name had not.

**8,195 parameters do this**, on 15.9% of servers, taking the real rate from 21.5% to **24.7%**.

Then a second floor, which was ours to find: we counted top-level parameters only. A tool whose top-level parameters are all described and whose nested object is entirely bare scored clean. An undescribed field at depth four is exactly as invisible to a model as one at depth one.

Walking the whole schema finds 324,382 parameters rather than 257,287, and the substantive rate goes from 24.7% to **30.7%**.

We report all three separately. The published 21.5% stays the published 21.5%.

### 2. The metric penalises focused servers — and fixing that breaks the other one

A reader running a memory server made the obvious objection: every one of his descriptions says "memory", by design. That is his server's name repeated, not a collision, and counting it against every tool penalises him for being focused.

He is right. But stripping frequent nouns globally breaks the *other* signal, because on a focused server **the collision is the domain noun**. Strip `resume` from a job-applications server and you have deleted exactly what makes three of its tools confusable.

A third reader removed the question rather than answering it: frequency is not a dial, it is a distinction the count already makes.

> A noun in nearly **all** of a server's tools names the server.
> A noun in a **subset** names a cluster — and that subset is the candidate collision list.

So there are two readings now, and they are never averaged. **The gap between them is the finding**: 18.4% of servers read clean once the domain word is out and still have two tools that could both be right for one sentence. That is a focused server whose tools all act on one object and never say what they return — a common shape, and averaging the two readings hides it completely.

Honest footnote: the original complaint is right in principle and small in practice. Stripping the domain moves the low-distinctive rate from 34.1% to 33.6%.

### 3. Sharing an object is not enough

Our "these two tools act on the same thing" signal had a false-positive rate we had not measured.

A six-tool ticket server has two tools with identical input shapes that are correctly two tools: one returns flat details for many tickets, the other a bounded evidence bundle with comments and source anchors. Same input, clearly different stated output. We flagged it, and its author was right to dismiss us.

The rule is a conjunction:

```
overlapping inputs + distinguishable outputs   = fine design
overlapping inputs + indistinguishable outputs = the failure
```

Adding that gate removes **21% of our flags as false positives** — 3,235 pairs of 15,404. One in five of the pairs we were flagging was a well-designed pair.

Silence counts as indistinguishable, deliberately. A tool that never says what it returns cannot be told apart from a sibling by its output, and that is the commonest shape of all.

### 4. The thing we could not measure, and said so

We wanted to check whether authors set MCP's `readOnlyHint` / `destructiveHint` annotations, and whether those agree with what their descriptions say. Two authors raised it independently: the annotation is read by the *client* deciding whether to prompt, the description by the *model* deciding whether to call, and nothing requires them to agree.

The corpus carries `annotations` for **none** of its 82,549 tools.

That could mean nobody sets them, or it could mean the registry strips them. Those lead to opposite write-ups, so we booted the four official reference servers locally and diffed: **37 of 37 emit annotations**, with all four hints represented.

The registry strips them, exactly as it strips the top-level `required` array — [which nearly sank the original study](/blog/reading-5000-mcp-schemas). So we publish no figure. "0% of public servers set `destructiveHint`" would have been a fact about Smithery dressed as a fact about MCP authors.

The check runs in [the checker](/check) instead, where you paste your own `tools/list` and the field is actually there.

## One negative result worth having

We also built the thing we expected to find problems with and did not.

Schema depth is a max over the tree, so one field at depth five and forty fields at depth five score identically. We split it: **leaf count** for how much there is to fill in, **decision depth** for how much of it is a branch the model has to choose at.

Public MCP schemas turn out to be shallow and narrow. The median tool has **two** leaves at depth one. Only 6.1% have any `anyOf`/`oneOf` at all, and just **38 tools in the entire corpus** have a branch whose alternatives overlap enough to be a real choice.

Branch ambiguity is a genuine failure mode that public servers almost never commit. We would rather say that than quietly not mention it.

## The ceiling all of this runs into

Here is the part none of the above fixes.

`analyze_job_description` and `score_resume` share **no content word** — after stemming, after every correction here — and their author reports they are confusable in practice. "Check my resume for this job" is a fair sentence for both.

Nothing computed on descriptions alone reaches that. The collision lives between a *request* and a *set of tools*, and our corpus contains no requests.

So we have pinned that pair in our test suite as a deliberate non-flag, and built the thing that can see it: a harness that writes prompts designed to make neighbouring tools plausible, asks a model to choose, and keeps every mistake as a regression case. It is in [the study repo](https://github.com/getmcpulse/mcp-schema-study).

Run across the corpus, it lets every signal above be *ranked* by how well it predicts a real mistake, rather than all of them being reported as equally meaningful. That is the study that would earn the word "misuse". We have not run it yet.

## Everything is reproducible

The corpus, the code and every figure are in [getmcpulse/mcp-schema-study](https://github.com/getmcpulse/mcp-schema-study). The stemmer is 13,160 words of fixture shared with [the checker](/check), so a score there and a figure here are the same measurement rather than two things that resemble each other.

If you found one of the bugs above: thank you, and please keep going.
