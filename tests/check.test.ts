/**
 * Tests for the schema checker's analysis.
 *
 * ── Why this file exists when nothing else here is tested ─────────────────
 * The rest of this site is documents. A wrong word renders as a wrong word and
 * a reader can see it. `src/lib/check.ts` is the one part that computes a number
 * an author will act on — they will go and rewrite tool descriptions because of
 * a percentage this file produced — and a number cannot be proofread. It either
 * matches the study it claims to match or it quietly does not.
 *
 * Three things in particular are only checkable by running them:
 *
 *   - the **corpus method**, reimplemented from the post. If the definition
 *     drifts, the comparison against 4,951 servers becomes a comparison against
 *     nothing, and the page will keep printing it with a straight face.
 *   - the **two parameter counts**. Top level feeds the benchmark, every depth
 *     feeds the fix list, and merging them is the mistake that reads as a
 *     finding about a schema when it is a finding about nesting.
 *   - the **bounded sibling search**. It is an optimisation with a budget, so
 *     the only proof it still finds the right answer is a case where the answer
 *     is known — and the only proof it stays bounded is a clock.
 *
 * Run with `npm test`. No framework: `esbuild` bundles, node runs, a non-zero
 * exit fails. Adding a test runner to a static site would be more configuration
 * than this needs.
 */

import { analyse, parseToolsList, highlightSegments, CheckError } from "../src/lib/check";
import { STUDY, bucketFor } from "../src/lib/study";

let failures = 0;
let checks = 0;

function eq(label: string, got: unknown, want: unknown) {
  checks++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failures++;
    console.log(`FAIL  ${label}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
  } else {
    console.log(`pass  ${label}`);
  }
}

function throws(label: string, run: () => unknown) {
  checks++;
  try {
    run();
    failures++;
    console.log(`FAIL  ${label} — did not throw`);
  } catch (error) {
    if (!(error instanceof CheckError)) {
      failures++;
      console.log(`FAIL  ${label} — threw ${(error as Error).name}, not CheckError`);
    } else {
      console.log(`pass  ${label}`);
    }
  }
}

const group = (name: string) => console.log(`\n── ${name} ${"─".repeat(Math.max(0, 58 - name.length))}`);

/* ── Input ────────────────────────────────────────────────────────────────── */
group("the shapes people actually paste");

const one = `{"name":"a","description":"x"}`;
eq("bare array", parseToolsList(`[${one}]`).length, 1);
eq("{ tools: [...] }", parseToolsList(`{"tools":[${one}]}`).length, 1);
eq("JSON-RPC envelope", parseToolsList(`{"jsonrpc":"2.0","id":1,"result":{"tools":[${one}]}}`).length, 1);

group("bad input fails with something a reader can act on");
throws("empty paste", () => parseToolsList("   "));
throws("malformed JSON", () => parseToolsList("{nope"));
throws("no tools anywhere", () => parseToolsList(`{"a":1}`));
throws("empty tools array", () => parseToolsList("[]"));
throws("array of things with no name", () => parseToolsList(`[{"x":1}]`));

/* ── The corpus method ────────────────────────────────────────────────────── */
group("the study's Gmail finding reproduces");

/**
 * Four real-shaped tools where `get`, `send`, `delete`, `draft` and `message`
 * each appear on more than one tool, so no tool owns a single word. The study
 * reports this exact shape: clear English, zero distinctive.
 */
const gmail = parseToolsList(
  JSON.stringify([
    { name: "get_draft", description: "Get a draft email using the Gmail API." },
    { name: "send_draft", description: "Send a draft email using the Gmail API." },
    { name: "get_message", description: "Get a message using the Gmail API." },
    { name: "send_message", description: "Send a message using the Gmail API." },
  ]),
);
const g = analyse(gmail);
eq("all four are zero-distinctive", g.distinctive.zero.length, 4);
eq("zero rate is 100%", g.distinctive.zero_rate, 1);
eq("median distinctive share is 0", g.distinctive.median_share, 0);

group("distinctive share is a share of the tool's own words");
const pair = analyse(
  parseToolsList(
    JSON.stringify([
      { name: "a", description: "search flights by airport" },
      { name: "b", description: "search hotels by city" },
    ]),
  ),
);
// a's content words are {search, flights, airport}; two are unique to it.
eq("2 of 3 words distinctive", Math.round(pair.per_tool[0].distinctive_share * 100), 67);
eq("nothing flagged at 67%", pair.distinctive.zero.length, 0);

group("domain verbs are content words, not stop words");
// If `list`/`get` were stripped as filler, these two would score as distinct on
// the nouns alone and the collision they actually have would vanish.
const verbs = analyse(
  parseToolsList(
    JSON.stringify([
      { name: "a", description: "List the items." },
      { name: "b", description: "List the records." },
    ]),
  ),
);
eq("'list' counts as shared", verbs.per_tool[0].distinctive_words, ["items"]);

group("a lone tool is reported, and cannot be judged");
const solo = analyse(parseToolsList(`[{"name":"a","description":"search flights between airports"}]`));
eq("share is 1 with no siblings", solo.distinctive.median_share, 1);
eq("no sibling attributed", solo.per_tool[0].nearest, undefined);

/* ── Parameters ───────────────────────────────────────────────────────────── */
group("parameters: described, blank, and enumerated");
const params = analyse(
  parseToolsList(
    JSON.stringify([
      {
        name: "t",
        description: "d",
        inputSchema: {
          type: "object",
          properties: {
            described: { type: "string", description: "has one" },
            missing: { type: "string" },
            blank: { type: "string", description: "   " },
            enumerated: { type: "string", enum: ["a", "b"], description: "closed" },
          },
        },
      },
    ]),
  ),
);
eq("total", params.params.total, 4);
eq("a whitespace-only description does not count", params.params.undescribed, 2);
eq("enum counted", params.params.with_enum, 1);

group("two counts, kept apart — the benchmark and the fix list");
const nested = analyse(
  parseToolsList(
    JSON.stringify([
      {
        name: "a",
        description: "x",
        inputSchema: {
          type: "object",
          properties: {
            filter: {
              type: "object",
              description: "outer",
              properties: {
                from: { type: "string" },
                deep: { type: "object", properties: { x: { type: "string" } } },
              },
            },
            tags: { type: "array", description: "list", items: { type: "object", properties: { label: { type: "string" } } } },
            page: { type: "integer", description: "page" },
          },
        },
      },
    ]),
  ),
);
// The study's denominator is top level: 270,487 params over 87,146 tools.
eq("top level only, for the corpus comparison", nested.params.total, 3);
eq("top level undescribed", nested.params.undescribed, 0);
eq("every depth, for the fix list", nested.params.deep_total, 7);
eq("every depth undescribed", nested.params.deep_undescribed, 4);
eq("paths name the route in", nested.per_tool[0].undescribed_deep, [
  "filter.from",
  "filter.deep",
  "filter.deep.x",
  "tags[].label",
]);

group("all three spellings of the schema field are read");
for (const key of ["inputSchema", "input_schema", "parameters"]) {
  eq(
    key,
    analyse(parseToolsList(JSON.stringify([{ name: "a", description: "b", [key]: { properties: { p: { type: "string" } } } }])))
      .params.total,
    1,
  );
}

group("a closed set in prose, but not an illustration");
const prose = analyse(
  parseToolsList(
    JSON.stringify([
      {
        name: "t",
        description: "d",
        inputSchema: {
          type: "object",
          properties: {
            listed: { type: "string", description: 'Attribution type. Valid values: "direct", "influenced".' },
            piped: { type: "string", description: "Optional processed|confirmed|finalized commitment" },
            // The study's own first pass over-counted 12x by matching this shape.
            illustrated: { type: "string", description: 'Filter by line (e.g. "1", "A", "F")' },
            hedged: { type: "string", description: 'Valid values such as "a", "b"' },
            already: { type: "string", enum: ["a"], description: 'Valid values: "a".' },
          },
        },
      },
    ]),
  ),
);
eq("only the two real ones", prose.prose_enums.map((p) => p.param), ["listed", "piped"]);

/* ── Sibling attribution ──────────────────────────────────────────────────── */
group("nearest sibling: correct, and only where it is useful");
for (const tool of g.per_tool) {
  eq(`${tool.name} names a sibling`, typeof tool.nearest?.name, "string");
  eq(`${tool.name} does not name itself`, tool.nearest?.name !== tool.name, true);
}
eq("get_draft's nearest is send_draft (80% overlap)", g.per_tool[0].nearest, {
  name: "send_draft",
  overlap: 0.8,
});
eq("a distinctive tool gets none — noise suppressed", pair.per_tool.map((t) => t.nearest), [undefined, undefined]);

group("identical descriptions take the O(1) path");
const twins = analyse(
  parseToolsList(JSON.stringify(Array.from({ length: 300 }, (_, i) => ({ name: `t${i}`, description: "Manage the resource using the API." })))),
);
eq("overlap is exactly 1", twins.per_tool[0].nearest?.overlap, 1);
eq("and it is a different tool", twins.per_tool[0].nearest?.name, "t1");

/* ── Size ─────────────────────────────────────────────────────────────────── */
group("size is the schema, not the formatting");
const compact = `[{"name":"a","description":"b"}]`;
eq(
  "pretty-printing does not change the score",
  analyse(parseToolsList(compact)).cost.bytes,
  analyse(parseToolsList(JSON.stringify(JSON.parse(compact), null, 4))).cost.bytes,
);
eq("tokens are bytes / 4, as the study reports", analyse(parseToolsList(compact)).cost.tokens, Math.round(analyse(parseToolsList(compact)).cost.bytes / 4));

/* ── Buckets ──────────────────────────────────────────────────────────────── */
group("size buckets match the study's table");
eq("1 tool", bucketFor(1).label, "1–3 tools");
eq("7 tools", bucketFor(7).label, "4–7 tools");
eq("30 tools", bucketFor(30).label, "16–30 tools");
eq("61 tools", bucketFor(61).label, "61+ tools");
eq("2,530 tools", bucketFor(2530).label, "61+ tools");
// 0.324, not the 0.313 originally published. The corpus double-counted
// servers in the popular pool — 5,123 collected rows for 4,894 distinct
// names — so every bucket was weighted by how often a server happened to be
// collected. Deduplicating moved this figure and this assertion is what
// caught it: the value is pinned here precisely so a corpus change cannot
// pass silently into the checker's benchmarks.
eq("the 61+ bucket collision rate is the study's", STUDY.buckets[5].zero, 0.324);

/* ── Highlighting ─────────────────────────────────────────────────────────── */
group("highlight segments");
const segments = highlightSegments("Delete a draft email using the Gmail API.", ["delete"]);
eq("every character survives", segments.map((s) => s.text).join(""), "Delete a draft email using the Gmail API.");
eq("the distinctive word is unmarked", segments.find((s) => s.text.includes("Delete"))?.shared, false);
eq("a shared word is marked", segments.some((s) => s.text.includes("draft") && s.shared), true);
eq("stop words are never marked", segments.some((s) => s.text.trim() === "using" && s.shared), false);
eq("markup is returned as text to be escaped by the caller", highlightSegments("<img onerror=x>", []).map((s) => s.text).join(""), "<img onerror=x>");
eq("no description yields no segments", highlightSegments("", []), []);

/* ── Robustness ───────────────────────────────────────────────────────────── */
group("odd but legal input does not throw");
eq("a tool with no description", analyse(parseToolsList(`[{"name":"a"},{"name":"b","description":"hi"}]`)).tools_undescribed, ["a"]);
eq("duplicate names are reported", analyse(parseToolsList(`[{"name":"a","description":"x"},{"name":"a","description":"y"}]`)).duplicate_names, ["a"]);
eq("a tool with no schema", analyse(parseToolsList(`[{"name":"a","description":"x"}]`)).params.total, 0);
eq("null inside properties", analyse(parseToolsList(`[{"name":"a","description":"x","inputSchema":{"properties":{"p":null}}}]`)).params.total, 1);

group("a cyclic schema terminates (only reachable off the page)");
const cyclic: Record<string, unknown> = { type: "object", properties: { name: { type: "string" } } };
(cyclic.properties as Record<string, unknown>).self = cyclic;
const cycled = analyse([{ name: "c", description: "cycle", inputSchema: cyclic }]);
eq("walk terminated", cycled.params.deep_total > 0 && cycled.params.deep_total < 100, true);
eq("size still measured", cycled.cost.bytes > 0, true);

/* ── Speed ────────────────────────────────────────────────────────────────── */
group("bounded, on the servers that need it most");

/**
 * The naive all-pairs sibling search takes ~2.5s at 2,530 tools and ~9.6s at
 * 5,000 — on the main thread, in a page with no spinner. And it degrades where
 * it matters: a tool is only flagged when it has nothing distinctive, so the
 * servers that flag every tool are the big ones, where the study measured 31.3%
 * collisions against 0.5% on the smallest.
 *
 * The budget is generous enough that this should never be close. It is asserted
 * rather than printed so a future change that reintroduces the quadratic path
 * fails the suite instead of quietly costing a reader six seconds.
 */
const BUDGET_MS = 750;

for (const [label, tools] of [
  ["2,530 identical (the corpus maximum)", Array.from({ length: 2530 }, (_, i) => ({ name: `t${i}`, description: "Manage the resource using the Gmail API for the user's mailbox." }))],
  ["5,000 identical", Array.from({ length: 5000 }, (_, i) => ({ name: `t${i}`, description: "Manage the resource using the API." }))],
  // No two word-sets identical, every tool flagged: the shape with no shortcut.
  ["3,000 varied, all flagged", Array.from({ length: 3000 }, (_, i) => ({ name: `t${i}`, description: `Manage the shared resource surface for item ${"abcdefgh"[i % 8]}${i % 97} here.` }))],
] as const) {
  const started = Date.now();
  const report = analyse(tools as never);
  const took = Date.now() - started;
  checks++;
  const ok = took < BUDGET_MS;
  if (!ok) failures++;
  console.log(
    `${ok ? "pass" : "FAIL"}  ${label}: ${took}ms (budget ${BUDGET_MS}ms), ${report.per_tool.filter((t) => t.nearest).length} siblings found`,
  );
}

/* ── Result ───────────────────────────────────────────────────────────────── */
console.log(
  failures
    ? `\n${failures} of ${checks} checks FAILED`
    : `\nall ${checks} checks passed`,
);
process.exit(failures ? 1 : 0);
