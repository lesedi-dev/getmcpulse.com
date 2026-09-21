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

import {
  analyse,
  parseToolsList,
  highlightSegments,
  nameWords,
  commonPrefix,
  paramState,
  nameTokens,
  CheckError,
  INPUT_OVERLAP_DISTINCTIVE,
  outputTerms,
  outputsDistinguishable,
  canonicalVerb,
} from "../src/lib/check";
import { stem } from "../src/lib/stem";
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

/** Two shares computed the same way can differ in the sixteenth decimal. */
const round3 = (value: number) => Math.round(value * 1000) / 1000;

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
// `items` stemmed: `distinctive_words` is what `highlightSegments` looks words
// up by, so it is in stem space like everything else that is counted.
eq("'list' counts as shared", verbs.per_tool[0].distinctive_words, ["item"]);

group("a lone tool is reported, and cannot be judged");
const solo = analyse(parseToolsList(`[{"name":"a","description":"search flights between airports"}]`));
eq("share is 1 with no siblings", solo.distinctive.median_share, 1);
eq("no sibling attributed", solo.per_tool[0].nearest, undefined);

/* ── Input overlap ────────────────────────────────────────────────────────── */

/**
 * Tools that could both be correct for one request.
 *
 * ── Where this fixture comes from, and what is missing from it ─────────────
 * The five descriptions below are **verbatim** from the ten-tool job-
 * applications server whose author identified `score_resume`,
 * `analyze_job_description` and `optimize_resume` as his ambiguous cluster.
 * They are the abridged one-liners he quoted, not the full text: his own
 * shared-noun count has `specific` in three descriptions, and that word
 * appears in none of these five. The remaining five tools and every
 * `inputSchema` are not available here.
 *
 * So this fixture pins what the quoted text can actually support — the
 * ordering, and the healthy distinctive scores that are the whole point of
 * adding the signal — and the Gmail fixture below carries the threshold case,
 * because it has real parameter schemas and the schemas are where the shared
 * nouns live on a real server.
 */
group("the ambiguous cluster still scores healthy on distinctive share");

const jobs = analyse(
  parseToolsList(
    JSON.stringify([
      { name: "score_resume", description: "Score a resume for ATS compatibility." },
      {
        name: "analyze_job_description",
        description: "Extract what a job posting actually screens on.",
      },
      { name: "optimize_resume", description: "Rewrite a resume so it passes ATS screening." },
      { name: "search_jobs", description: "Return the user's job matches. Read-only." },
      {
        name: "update_job_preferences",
        description: "Set the roles and locations it hunts for.",
      },
    ]),
  ),
);

// This is the finding, stated as a test: the existing metric calls all three
// healthy. If a future change makes distinctive share flag them, the argument
// for having a second signal has gone and this test should be the one that
// says so.
//
// Measured against the corpus median, which is the bar the report itself uses
// for `looks_healthy` — not the 0.5 that stood here before. That 0.5 was an
// arbitrarily stronger claim, and stemming is what exposed it: `optimize_resume`
// scored 0.500 while `screening` and `screens` were two words and scores 0.400
// now that they are one. The finding is unchanged — all three still clear the
// bar the corpus calls healthy — but it is now stated at the threshold that
// means something.
for (const name of ["score_resume", "analyze_job_description", "optimize_resume"]) {
  const tool = jobs.per_tool.find((report) => report.name === name)!;
  eq(
    `${name} looks healthy to distinctive share`,
    tool.distinctive_share >= INPUT_OVERLAP_DISTINCTIVE,
    true,
  );
}

// The stemming correction, at the pair it was reported on. Before it, these two
// tools shared their one genuinely linking term and both scored it distinctive.
eq(
  "screens and screening are one shared word",
  jobs.per_tool.find((r) => r.name === "optimize_resume")!.distinctive_words.includes(stem("screening")),
  false,
);
eq("and that costs optimize_resume its distinctive share", round3(
  jobs.per_tool.find((r) => r.name === "optimize_resume")!.distinctive_share), 0.4);
eq("and none of them collides", jobs.distinctive.zero.length, 0);

group("input nouns are what the tool acts on, not how it is worded");
const nouns = (name: string) =>
  jobs.per_tool.find((report) => report.name === name)!.input_nouns.sort();

// The opening verb is dropped — `score` and `rewrite` are what the two tools
// do, not what they act on, and keeping them would hide the shared object.
eq("the verb is not an input noun", nouns("score_resume"), ["ats", "compatibility", "resume"]);
// Surfaced, not stemmed: the list on screen has to be words the author can
// find in their own schema. `screens` rather than `screening` because the
// registry prints the shortest form it saw, and the sibling wrote `screens`.
eq("nor is it here", nouns("optimize_resume"), ["ats", "passes", "resume", "screens"]);

// "Return the user's job matches" opens on its verb rather than on a return
// marker. Reading it as output left this tool with no nouns at all, which
// silently dropped it out of every pair.
eq(
  "a description opening on `Return` keeps its nouns",
  nouns("search_jobs").includes("job"),
  true,
);

group("the cluster shares an object and the far pair does not");
const overlapOf = (a: string, b: string) => {
  const left = new Set(jobs.per_tool.find((report) => report.name === a)!.input_nouns);
  const right = new Set(jobs.per_tool.find((report) => report.name === b)!.input_nouns);
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / (left.size + right.size - shared);
};

// `resume` and `ats`, shared by two tools the author says are confusable.
eq(
  "score_resume and optimize_resume share their object",
  overlapOf("score_resume", "optimize_resume") > 0.3,
  true,
);
// The two tools nobody would confuse share nothing at all.
eq(
  "update_job_preferences and score_resume share nothing",
  overlapOf("update_job_preferences", "score_resume"),
  0,
);
eq("so the far pair is never flagged", jobs.input_overlap.length, 0);

/**
 * The threshold case, on a server that has parameter schemas.
 *
 * Three tools that all act on a draft: a request naming a draft could route to
 * any of them, and no amount of rewording changes that. This is the shape the
 * flag exists for, and it needs the schemas to reach it — which is exactly why
 * `inputNouns` reads them.
 */
group("tools that act on the same object are flagged as a pair");
const drafts = analyse(
  parseToolsList(
    JSON.stringify([
      {
        name: "gmail_get_draft",
        description: "Get a draft email using the Gmail API.",
        inputSchema: { properties: { draft_id: {}, user_id: {} } },
      },
      {
        name: "gmail_send_draft",
        description: "Send a draft email using the Gmail API.",
        inputSchema: { properties: { draft_id: {}, user_id: {} } },
      },
      {
        name: "gmail_list_labels",
        description: "List all the labels in the user's mailbox.",
        inputSchema: { properties: { user_id: {} } },
      },
    ]),
  ),
);

const top = drafts.input_overlap[0];
eq("the two draft tools are the pair", [top?.a, top?.b], ["gmail_get_draft", "gmail_send_draft"]);
eq("and they share their object", top?.shared.includes("draft"), true);
eq("the unrelated tool is not in any pair", drafts.input_overlap.length, 1);

// The point of the flag: this pair is reported *because* nothing else would.
group("a distinctive pair that still shares its object is called out");
const healthy = analyse(
  parseToolsList(
    JSON.stringify([
      {
        name: "score_resume",
        description: "Score a resume for ATS compatibility.",
        inputSchema: { properties: { resume_text: {}, job_description: {} } },
      },
      {
        name: "optimize_resume",
        description: "Rewrite a resume so it passes ATS screening.",
        inputSchema: { properties: { resume_text: {}, job_description: {} } },
      },
    ]),
  ),
);
eq("the pair is flagged", healthy.input_overlap.length, 1);
eq("and labelled as one the old metric passed", healthy.input_overlap[0].looks_healthy, true);

/* ── Name distinctiveness ─────────────────────────────────────────────────── */

/**
 * The backstop, and the server prefix that would otherwise hide it.
 *
 * Authors report that when descriptions stop discriminating a model falls back
 * to the tool name. `gmail` is on every one of these, so it discriminates
 * nothing *inside* the server and has to come off before anything is scored —
 * left in, it would drag every name down by a constant and make a
 * well-named server look collided.
 */
group("the server prefix comes off before names are scored");

const gmailNames = analyse(
  parseToolsList(
    JSON.stringify([
      { name: "Gmail_DeleteDraftEmail", description: "Delete a draft email using the Gmail API." },
      { name: "Gmail_SendDraftEmail", description: "Send a draft email using the Gmail API." },
      { name: "Gmail_ListLabels", description: "List all the labels in the user's mailbox." },
      { name: "Gmail_SearchThreads", description: "Search the threads in the user's mailbox." },
    ]),
  ),
);

eq("the prefix is found", gmailNames.distinctive.name_prefix, "gmail");
// The report surfaces: `name_words` is printed on the page, so it comes back
// as the author spelled it.
eq("and stripped from the tokens", gmailNames.per_tool[0].name_words, [
  "delete",
  "draft",
  "email",
]);
// The bare function does not: this is the counting form, and `delete` stems to
// `delet`. The pair of assertions is the contract — count in stem space, print
// in surface space.
eq("camelCase splits", nameWords("Gmail_DeleteDraftEmail"), [
  "gmail",
  "delet",
  "draft",
  "email",
]);
eq("a prefix needs to be on nearly every tool", commonPrefix(["a_one", "b_two", "c_three"]), null);

// The quadrant this set lands in: the names discriminate where the
// descriptions have started to run together.
for (const tool of gmailNames.per_tool) {
  eq(
    `${tool.name}: the name carries more than the description`,
    tool.name_distinctive_share >= tool.distinctive_share,
    true,
  );
}
eq("so nothing is in the serious quadrant", gmailNames.distinctive.both_low, []);

group("both low is the case with nothing left to choose on");
const nothingLeft = analyse(
  parseToolsList(
    JSON.stringify([
      { name: "gmail_get_draft", description: "Get a draft email using the Gmail API." },
      { name: "gmail_send_draft", description: "Send a draft email using the Gmail API." },
      { name: "gmail_get_message", description: "Get a message using the Gmail API." },
      { name: "gmail_send_message", description: "Send a message using the Gmail API." },
    ]),
  ),
);
// Every word of every description appears on a sibling, and after `gmail_`
// comes off so does every name token: `get`/`send` and `draft`/`message` each
// appear twice. A model choosing between these has nothing at all.
eq("all four have nothing left", nothingLeft.distinctive.both_low.length, 4);
eq("the descriptions had already collided", nothingLeft.distinctive.zero.length, 4);

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

/**
 * The failure with a populated field.
 *
 * Absence is what the survey counted and it is a floor, because a description
 * that restates the parameter name is commoner and passes every linter. Each
 * of these four is a real shape, and each one currently scores as described.
 */
group("a description that only repeats the name is not a description");

for (const [name, description] of [
  ["query", "The query"],
  ["user_id", "User ID"],
  ["maxResults", "Maximum results"],
  ["filter", "A filter to apply"],
] as const) {
  eq(`${name}: "${description}"`, paramState(name, description), "restates_name");
}

group("and a description that says something survives");
for (const [name, description] of [
  ["query", "Full-text search over order notes and customer names."],
  ["origin", "IATA airport code, e.g. LHR."],
  ["maxResults", "Between 1 and 100. Defaults to 20."],
  // One real word is enough. The list of filler is deliberately short, so this
  // errs toward calling a thin description substantive rather than the reverse.
  ["scope", "Which mailbox folder to search."],
] as const) {
  eq(`${name}: "${description}"`, paramState(name, description), "described");
}

group("absence and restatement are told apart, and neither is folded in");
eq("no field at all", paramState("query", undefined), "missing");
eq("an empty string", paramState("query", "   "), "missing");
eq("camelCase splits", nameTokens("maxResults"), ["maximum", "result"]);
// `id` expands through the abbreviation map and is then stemmed, in that
// order — see `normalise`.
eq("snake_case splits", nameTokens("user_id"), ["user", "identifi"]);
eq("kebab-case splits", nameTokens("page-token"), ["page", "token"]);
eq("an acronym keeps the word after it", nameTokens("HTTPServerName"), ["http", "server", "name"]);

const restating = analyse(
  parseToolsList(
    JSON.stringify([
      {
        name: "t",
        description: "d",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The query" },
            user_id: { type: "string" },
            scope: { type: "string", description: "Which mailbox folder to search." },
          },
        },
      },
    ]),
  ),
);
// The card prints `rate`, next to a published corpus figure that counted
// absence only. Folding the restatement into it would make the two numbers
// different measurements printed as a comparison.
eq("the published rate stays absence-only", restating.params.undescribed, 1);
eq("restatements are their own count", restating.params.restates_name, 1);
eq("and the two together are the real rate", restating.params.substantive, 2);
eq("the tool carries both lists", restating.per_tool[0].restated_params, ["query"]);

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
// This assertion has now caught two corpus changes, which is what it is for.
//
// 0.313 was published. 0.324 came from deduplicating the corpus — 5,123
// collected rows for 4,894 distinct servers, so every bucket had been weighted
// by how often a server happened to be scraped. 0.408 is stemming: `screens`
// and `screening` were two words, and on a 61-tool server the odds that some
// sibling wrote an inflection of your words are very high, which is why the
// correction grows with bucket size.
//
// Pinned precisely so a corpus change cannot pass silently into the benchmarks
// the page grades a reader against.
eq("the 61+ bucket collision rate is the study's", STUDY.buckets[5].zero, 0.408);

/* ── Output distinguishability ────────────────────────────────────────────── */
group("sharing an input is only a problem when the outputs are silent");

/**
 * The counter-example the gate exists for, from a six-tool ticket server.
 *
 * `get_tickets` and `build_ticket_evidence` take the same argument and are
 * correctly two tools: flat details for many tickets against a bounded evidence
 * bundle with comments and source anchors. Input overlap flags the pair and its
 * author is right to dismiss the flag.
 *
 * `list_tickets` and `show_tickets` are the failure the gate must still catch:
 * same object, and neither says what it gives back.
 */
const tickets = analyse(
  parseToolsList(
    JSON.stringify([
      // Identical input shapes and identical input nouns, so the pair clears the
      // overlap bar on its own merits rather than on how the sentences happen to
      // be worded — `overlap` is a Jaccard, so a long description dilutes a
      // shared object by everything else the author wrote.
      {
        name: "get_tickets",
        description: "Fetch tickets. Returns status, assignee, priority and title.",
        inputSchema: { type: "object", properties: { ticket_ids: { type: "array" } } },
        outputSchema: {
          type: "object",
          properties: { status: {}, assignee: {}, priority: {}, title: {} },
        },
      },
      {
        name: "build_ticket_evidence",
        description: "Bundle tickets. Returns comments, attachments and source anchors.",
        inputSchema: { type: "object", properties: { ticket_ids: { type: "array" } } },
        outputSchema: { type: "object", properties: { comments: {}, attachments: {}, anchors: {} } },
      },
      {
        name: "list_tickets",
        description: "List the tickets in a project.",
        inputSchema: {
          type: "object",
          properties: { project_id: { type: "string" }, ticket_ids: { type: "array" } },
        },
      },
      {
        name: "show_tickets",
        description: "Show the tickets in a project.",
        inputSchema: {
          type: "object",
          properties: { project_id: { type: "string" }, ticket_ids: { type: "array" } },
        },
      },
    ]),
  ),
);

const pairKey = (p: { a: string; b: string }) => [p.a, p.b].sort().join(" / ");
const flaggedPairs = tickets.input_overlap.map(pairKey);
const nearPairs = tickets.near_misses.map(pairKey);

eq(
  "the well-designed pair shares its object",
  [...flaggedPairs, ...nearPairs].includes("build_ticket_evidence / get_tickets"),
  true,
);
eq(
  "the well-designed pair is NOT flagged",
  flaggedPairs.includes("build_ticket_evidence / get_tickets"),
  false,
);
eq(
  "it is reported as a near miss instead",
  nearPairs.includes("build_ticket_evidence / get_tickets"),
  true,
);
eq(
  "the pair that never says what it returns IS flagged",
  flaggedPairs.includes("list_tickets / show_tickets"),
  true,
);

// Silence is not a distinction. The whole gate turns on this line: a tool that
// does not state its output cannot be told apart from a sibling by its output,
// so an empty set has to score as indistinguishable rather than as missing data.
eq(
  "an unstated output is not distinguishable from anything",
  outputsDistinguishable(new Set(), new Set(["comments", "anchors"])),
  false,
);
eq(
  "two stated outputs that share nothing are",
  outputsDistinguishable(new Set(["status", "title"]), new Set(["comments", "anchors"])),
  true,
);
// Half the terms either one uses — the same bar as the input side, so the two
// halves of the rule mean the same thing.
eq(
  "two stated outputs that mostly match are not",
  outputsDistinguishable(new Set(["a", "b", "c"]), new Set(["a", "b", "d"])),
  false,
);

eq(
  "outputSchema names count as stated output",
  [...outputTerms({ name: "x", outputSchema: { properties: { matchScore: {} } } } as never)].sort(),
  ["match", "score"],
);

/* ── Domain nouns and cluster nouns ───────────────────────────────────────── */
group("a focused server is not penalised for saying its own name");

/**
 * Every tool says `memory`, by design. That is the server's name repeated, not
 * a collision, and counting it against every tool is the complaint this reading
 * answers.
 */
const memory = analyse(
  parseToolsList(
    JSON.stringify([
      { name: "memory_set", description: "Write a memory to the durable store." },
      { name: "memory_get", description: "Read a memory back by its key." },
      { name: "memory_search", description: "Find a memory by fuzzy phrase." },
      { name: "memory_delete", description: "Remove a memory permanently." },
    ]),
  ),
);

eq("the domain word is found", memory.domain.nouns, ["memory"]);
eq(
  "and stripping it raises the score",
  memory.domain.stripped_median_share > memory.distinctive.median_share,
  true,
);

// Dial-free by construction: the domain is what *every* tool says, so a server
// with no universal word has no domain and nothing is stripped.
const varied = analyse(
  parseToolsList(
    JSON.stringify([
      { name: "a", description: "Send an invoice to a customer." },
      { name: "b", description: "Refund a payment." },
    ]),
  ),
);
eq("no universal word means nothing is stripped", varied.domain.nouns, []);

group("the cluster noun is the candidate collision list");

/**
 * The trap the two readings exist to avoid: on a focused server the collision
 * *is* the frequent noun, so it must survive into the overlap reading. `resume`
 * is on a subset here, and `ats` on the tightest subset of all — which is the
 * pair the author of that server flagged first.
 */
const jobClusters = jobs.domain.clusters;
const ats = jobClusters.find((cluster) => cluster.noun === "ats");
eq("ats is a cluster", ats?.tools.sort(), ["optimize_resume", "score_resume"]);
eq(
  "clusters come tightest first",
  jobClusters.length > 1 ? jobClusters[0].tools.length <= jobClusters[1].tools.length : true,
  true,
);

/* ── Synonym verbs ────────────────────────────────────────────────────────── */
group("synonym verbs are one verb, which no stemmer can reach");

eq("fetch is get", canonicalVerb([stem("fetch"), stem("orders")]), [stem("get"), stem("orders")]);
eq("query is search", canonicalVerb([stem("query"), stem("x")]), [stem("search"), stem("x")]);
eq("remove is delete", canonicalVerb([stem("remove"), stem("item")]), [stem("delete"), stem("item")]);
// `getAll` tokenises to get + all, so the leading-token rule alone would leave
// it distinct from `list`. The one two-token verb worth a special case.
eq("getAll is list", canonicalVerb([stem("get"), stem("all"), stem("orders")]), [
  stem("list"),
  stem("orders"),
]);
// Only the first token. `get_search_index` and `search_get_index` are not the
// same tool and must not be merged into one.
eq("only the leading token is canonicalised", canonicalVerb([stem("get"), stem("search")]), [
  stem("get"),
  stem("search"),
]);
eq("an unknown verb is left alone", canonicalVerb([stem("transcode"), stem("x")]), [
  stem("transcode"),
  stem("x"),
]);

const synonyms = analyse(
  parseToolsList(
    JSON.stringify([
      { name: "get_orders", description: "Return the orders placed in a period." },
      { name: "fetch_orders", description: "Look up orders across the account." },
      { name: "cancel_shipment", description: "Stop a shipment before it leaves." },
    ]),
  ),
);
const named = (n: string) => synonyms.per_tool.find((report) => report.name === n)!;
eq(
  "get_orders and fetch_orders have nothing to tell them apart by name",
  [named("get_orders").name_distinctive_share, named("fetch_orders").name_distinctive_share],
  [0, 0],
);
eq("a genuinely different tool keeps its name", named("cancel_shipment").name_distinctive_share, 1);

group("the both-low case: nothing left to discriminate on at either end");

/**
 * The flag that matters most, and the one nothing else on the page reaches. If
 * the name is what a model falls back to when descriptions collide, a tool in
 * here has left it nothing at all.
 */
const bothLow = analyse(
  parseToolsList(
    JSON.stringify([
      { name: "delete_item", description: "Remove an item from the collection." },
      { name: "remove_item", description: "Remove an item from the collection." },
    ]),
  ),
);
eq("both tools are flagged", bothLow.distinctive.both_low.sort(), ["delete_item", "remove_item"]);

/* ── Annotations against prose ────────────────────────────────────────────── */
group("the client and the model are told different things");

/**
 * No corpus figure is printed beside any of this. The registry drops
 * `annotations` for every one of 82,549 tools it stores, while the four official
 * reference servers booted locally emit it for all 37 of theirs — so there is
 * nothing to compare against, and an author's own paste is the only place the
 * field exists.
 */
const annotated = analyse(
  parseToolsList(
    JSON.stringify([
      {
        name: "replace_file",
        description: "REPLACES the file at the given path. Cannot be undone.",
        annotations: { readOnlyHint: false },
      },
      {
        name: "wipe_index",
        description: "Rebuild the search index from source.",
        annotations: { destructiveHint: true },
      },
      {
        name: "read_config",
        description: "Read-only view of the resolved configuration.",
        annotations: { readOnlyHint: true },
      },
    ]),
  ),
);

const finding = (tool: string, kind: string) =>
  annotated.annotations.findings.some((f) => f.tool === tool && f.kind === kind);

eq("prose says destructive, no hint set", finding("replace_file", "prose_only"), true);
eq("hint says destructive, prose silent", finding("wipe_index", "hint_only"), true);
eq("prose and hint agree, nothing reported", finding("read_config", "prose_only"), false);
eq("three tools carry annotations", annotated.annotations.tools_with_annotations, 3);

// A read-only tool whose description does not say so has told the model nothing
// dangerous, so silence there is not reported. The cost of silence is only real
// when it hides a side effect.
eq("a silent readOnlyHint is not a finding", finding("read_config", "hint_only"), false);

group("a safety distinction the client can see and the model cannot");

/**
 * Two tools a model has nothing to choose between, whose annotations differ. The
 * host will auto-approve one and prompt for the other on a distinction the
 * chooser is blind to — the worst arrangement of the three.
 */
const blind = analyse(
  parseToolsList(
    JSON.stringify([
      {
        name: "sync_now",
        description: "Synchronise the workspace with the remote.",
        annotations: { destructiveHint: false },
      },
      {
        name: "sync_hard",
        description: "Synchronise the workspace with the remote.",
        annotations: { destructiveHint: true },
      },
    ]),
  ),
);
eq("the pair is found", blind.annotations.annotation_only_pairs.length, 1);
eq(
  "and the hint it turns on is named",
  blind.annotations.annotation_only_pairs[0]?.differs_on,
  ["destructiveHint"],
);

/* ── Highlighting ─────────────────────────────────────────────────────────── */
group("highlight segments");
// `distinctive` arrives as stems — `tool.distinctive_words` is what the page
// passes — so the fixture says so rather than spelling one out and going stale.
const segments = highlightSegments("Delete a draft email using the Gmail API.", [stem("delete")]);
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
