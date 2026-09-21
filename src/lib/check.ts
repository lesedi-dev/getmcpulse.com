/**
 * The schema checker's analysis, as pure functions.
 *
 * This is the study's method, reimplemented to run on one server instead of
 * 4,749 — same definitions, same thresholds, so a score here is comparable to
 * the figures in `study.ts`. Where the study had to make a judgement call, the
 * call is repeated here and the reasoning is in the comment, because a checker
 * that measures something subtly different from its own benchmark is a checker
 * that lies with real numbers.
 *
 * No DOM, no fetch, no imports beyond `study.ts`. It runs in the reader's
 * browser and nothing it touches leaves the tab — which is not a feature bolted
 * on for the privacy paragraph, it is the only honest way to ship this. We ask
 * people to paste the schema of a server that may not be public yet.
 */

import { stem, Surfaces } from "./stem";
import { STUDY, bucketFor } from "./study";

/* ── Input ────────────────────────────────────────────────────────────────── */

export interface Tool {
  name?: unknown;
  description?: unknown;
  inputSchema?: { properties?: Record<string, unknown>; [k: string]: unknown };
  /** Some servers use the camelCase spelling, some the JSON Schema one. */
  input_schema?: { properties?: Record<string, unknown>; [k: string]: unknown };
  /** And some SDKs name it after the OpenAI function-calling field. */
  parameters?: { properties?: Record<string, unknown>; [k: string]: unknown };
}

export class CheckError extends Error {}

/**
 * Pull the tools array out of whatever the reader pasted.
 *
 * Three shapes arrive in practice and all three are correct-looking to the
 * person pasting: the whole JSON-RPC envelope copied from a log, the `result`
 * object on its own, or the bare array. Rejecting two of them to be strict
 * about a wire format would fail the reader for doing the obvious thing.
 */
export function parseToolsList(text: string): Tool[] {
  const trimmed = text.trim();
  if (!trimmed) throw new CheckError("Paste the JSON from your server's tools/list response.");

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CheckError(`That is not valid JSON — ${detail}`);
  }

  const candidates: unknown[] = [
    value,
    (value as { tools?: unknown })?.tools,
    (value as { result?: { tools?: unknown } })?.result?.tools,
  ];

  const tools = candidates.find((c): c is Tool[] => Array.isArray(c));

  if (!tools) {
    throw new CheckError(
      "Could not find a tools array. Paste the whole tools/list response, the result object, or just the array of tools.",
    );
  }
  if (tools.length === 0) throw new CheckError("That tools array is empty.");
  if (!tools.some((tool) => typeof tool?.name === "string")) {
    throw new CheckError(
      "Found an array, but nothing in it has a name — is this the tools/list response?",
    );
  }

  return tools.filter((tool) => tool && typeof tool === "object");
}

/* ── Words ────────────────────────────────────────────────────────────────── */

/**
 * Stop words, removed before anything is called distinctive.
 *
 * The study counted *content* words. Leaving "the" and "of" in would score two
 * identical descriptions as partly distinctive the moment one of them ran
 * longer, which is noise rather than signal. The list is deliberately plain
 * English and short — it does not strip domain words like `list` or `get`,
 * because on an MCP server those *are* the content, and stripping them would
 * hide exactly the collision this measures.
 */
const STOP = new Set(
  `a about above after again against all am an and any are aren as at be because been
   before being below between both but by can cannot could couldn did didn do does
   doesn doing don down during each few for from further had hadn has hasn have haven
   having he her here hers herself him himself his how i if in into is isn it its
   itself let me more most mustn my myself no nor not of off on once only or other
   ought our ours ourselves out over own same shan she should shouldn so some such
   than that the their theirs them themselves then there these they this those
   through to too under until up very was wasn we were weren what when where which
   while who whom why with won would wouldn you your yours yourself yourselves
   use used uses using via with without will may might must shall`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * The same list after stemming.
 *
 * The list is written in surface forms and the counting happens in stem space,
 * so without this `used` is filler and `using` is a content word — the exact
 * inconsistency the stemmer exists to remove. Nothing meaningful is lost: a
 * word that lands on one of these stems is an inflection of a word already
 * judged filler.
 */
const STOP_STEMS = new Set([...STOP].map(stem));

/**
 * A raw token → its stem, or null when the token carries no content.
 *
 * Stopwords are tested on the surface form first and on the stem second. The
 * first test is what the list was written for; the second is what keeps it
 * consistent once words are merged.
 */
function contentStem(word: string, surfaces?: Surfaces): string | null {
  if (word.length <= 1 || STOP.has(word)) return null;
  const key = surfaces ? surfaces.add(word) : stem(word);
  return STOP_STEMS.has(key) ? null : key;
}

/**
 * A description's content words, as a set.
 *
 * A set rather than a list of tokens: the question is which *words* a tool has
 * that its siblings do not, and a tool that repeats "email" nine times has one
 * word, not nine. Numbers and single characters are dropped — a `2` in a
 * description distinguishes nothing.
 */
export function contentWords(description: unknown, surfaces?: Surfaces): Set<string> {
  if (typeof description !== "string") return new Set();

  const out = new Set<string>();
  for (const raw of description
    .toLowerCase()
    // Split on anything that is not a letter or an inner apostrophe. This
    // deliberately splits snake_case and camelCase stays joined — a
    // description writing `getUser` means one word, and `get_user` two.
    .split(/[^a-z']+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))) {
    const key = contentStem(raw, surfaces);
    if (key) out.add(key);
  }
  return out;
}

/**
 * A description split into runs, each marked shared or not.
 *
 * This is what turns the collision finding from a number into something a
 * reader can see: the description is printed with every word its siblings also
 * use marked, so a zero-distinctive tool lights up end to end and the reason is
 * obvious without reading the percentage.
 *
 * Returned as data rather than markup on purpose. Descriptions are arbitrary
 * strings out of a file the reader pasted, and building a highlighted string by
 * concatenating HTML is how a tool named `<img onerror=…>` ends up executing —
 * the caller walks these segments creating text nodes, which cannot.
 *
 * Every character of the original survives, separators included, so what is
 * displayed is the description and not a reassembled approximation of it.
 */
export interface Segment {
  text: string;
  /** A content word that at least one sibling also uses. */
  shared: boolean;
}

export function highlightSegments(description: unknown, distinctive: string[]): Segment[] {
  if (typeof description !== "string" || description === "") return [];

  // `distinctive` arrives as stems, because that is what was counted. Each word
  // on screen is stemmed to look itself up, so the highlight marks exactly the
  // words the percentage was computed from — `screening` lights up as shared
  // when a sibling wrote `screens`, which is the whole point of the correction.
  const unique = new Set(distinctive);
  const segments: Segment[] = [];

  // Same token shape `contentWords` splits on, so a word marked here is a word
  // that was counted there. Two different notions of "word" would put the
  // highlight on characters the percentage never looked at.
  for (const match of description.matchAll(/[a-zA-Z']+|[^a-zA-Z']+/g)) {
    const text = match[0];
    const word = text.toLowerCase().replace(/^'+|'+$/g, "");
    const key = /[a-z]/.test(word) ? contentStem(word) : null;
    const shared = key !== null && !unique.has(key);

    const previous = segments[segments.length - 1];
    if (previous && previous.shared === shared) previous.text += text;
    else segments.push({ text, shared });
  }

  return segments;
}

/* ── Input overlap ────────────────────────────────────────────────────────── */

/**
 * Whether two tools could both be *correct* for the same request.
 *
 * ── Why this is not distinctive share ──────────────────────────────────────
 * Distinctive share asks whether two descriptions *look* alike. This asks
 * whether a request could route to either tool. They are different questions,
 * and the second one is what predicts a wrong selection.
 *
 * The evidence is a real ten-tool server for job applications. Three of its
 * tools — `score_resume`, `analyze_job_description`, `optimize_resume` — score
 * 50–60% distinctive, which the corpus calls healthy, and its author confirms
 * they are ambiguous in practice: "check my resume for this job" is a fair
 * sentence for all three. They are ambiguous because they all act on a resume
 * and a job posting, not because they are worded alike. Distinctive share
 * cannot see that and is not supposed to; this is the signal that can.
 *
 * ── What was tried first, and why it is not here ───────────────────────────
 * The first attempt split each description into a verb and the nouns it
 * returns, and scored distinctiveness over the output half. It failed against
 * that same server: all ten verbs were lexically distinct — score, extract,
 * rewrite, produce, write, translate, return, set, apply, build — so the split
 * scored every tool at 100%, including the three the author had already
 * identified as the problem. A measurement that rates the known-bad case
 * perfect is worse than no measurement, so none of it survives here.
 *
 * ── Reported per pair, because the finding is relational ───────────────────
 * "These two both act on a resume" is a fact about a pair. Averaging it onto
 * one tool would turn the one actionable sentence — which other tool a request
 * could land on instead — back into a score.
 */

/**
 * The words an author uses to say what comes back.
 *
 * Only ever used to *exclude* the returned half from the input set. Nothing is
 * scored on the output — that was tried and it failed, for the reason in the
 * section header above.
 */
const RETURN_WORDS = new Set(
  `return returns returning returned give gives giving given provide provides providing
   provided produce produces producing produced output outputs outputting yield yields
   yielding respond responds responding`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * The same list after stemming.
 *
 * Same reason as `STOP_STEMS`: the list spells out every inflection, and once
 * words are merged the test has to run on the merged form or `provides` and
 * `providing` stop being the same exclusion.
 */
const RETURN_STEMS = new Set([...RETURN_WORDS].map(stem));

/**
 * Where the returned half begins: one of those words, or a colon.
 *
 * `Search flights: airline, price and duration` is the shape a return takes
 * when nobody writes "returns". It also fires on a colon that means something
 * else, which costs a few input nouns and never invents one.
 */
const RETURN_MARKER =
  /\b(?:returns?|returning|returned|gives?|giving|provides?|providing|produces?|producing|outputs?|yields?|responds?\s+with)\b|:/i;

/**
 * The words a tool operates on: content words from the description, minus the
 * returned half and minus the opening verb, plus every parameter name.
 *
 * ── Why the parameter names carry so much of this ──────────────────────────
 * A parameter name is the one place an author states the object without any
 * prose around it, and it needs no tagging at all: `resume_text` and
 * `job_description` say what `score_resume` acts on more plainly than its
 * sentence does. On the ten-tool server this measurement was built for, the
 * descriptions are one line each and the schemas are where the shared nouns
 * actually live.
 *
 * ── The two approximations, and which way each one errs ────────────────────
 * **The opening word is dropped as the verb.** An MCP description opens on an
 * imperative almost without exception — "Score a resume…", "Rewrite a
 * resume…" — and keeping it would put `score` and `rewrite` in the input sets
 * of two tools that act on the same thing, which is exactly the overlap this
 * is trying to see. Positional rather than a lexicon: a lexicon is what the
 * failed version was built on, and a first-word rule cannot silently fold two
 * unrelated verbs together.
 *
 * **Everything after a return marker is dropped.** What a tool gives back is
 * not what it operates on, and leaving it in would let two tools look alike
 * for returning the same shape.
 *
 * Neither is a part-of-speech tagger, so adjectives and adverbs survive as
 * "nouns". That dilutes an overlap rather than inventing one — a shared
 * adjective is still a shared word — so the figure is a floor, like every
 * other figure here.
 */
export function inputNouns(tool: Tool, surfaces?: Surfaces): Set<string> {
  const description = typeof tool.description === "string" ? tool.description : "";

  let before = description;
  const marker = RETURN_MARKER.exec(description);
  // Only when something comes before it. "Return the user's job matches" opens
  // on its verb, not on a return marker — treating that as output would leave
  // the tool with no nouns at all and silently drop it out of every pair.
  if (marker && /[a-z]/i.test(description.slice(0, marker.index))) {
    const rest = description.slice(marker.index);
    const stop = rest.search(/[.!?\n]/);
    before = description.slice(0, marker.index) + (stop === -1 ? "" : rest.slice(stop));
  }

  // `contentWords` returns a set and the verb needs position, so the kept half
  // is re-split in order — on the same token shape, so a word dropped here is a
  // word the distinctive figure counted. The ordering runs on raw tokens and the
  // merge happens after it: stemming first would not change which token is
  // first, but it would make the RETURN_WORDS test read against a form the list
  // was never written in.
  const ordered = before
    .toLowerCase()
    .split(/[^a-z']+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => contentStem(word) !== null);

  const nouns = new Set<string>();
  for (const word of ordered.slice(1)) {
    if (RETURN_STEMS.has(stem(word))) continue;
    const key = contentStem(word, surfaces);
    if (key) nouns.add(key);
  }

  for (const param of Object.keys(propertiesOf(tool))) {
    // Already stemmed: `nameTokens` runs `normalise`, which expands the
    // abbreviation and then stems. So `resumes` in a sentence and `resume_text`
    // in a schema land on one noun, which is the whole point.
    for (const token of nameTokens(param, surfaces)) if (token.length > 1) nouns.add(token);
  }

  return nouns;
}

/** Jaccard: shared nouns over the nouns either tool uses. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Above this, two tools act on enough of the same thing to be confusable.
 *
 * Half the nouns either of them uses. Lower and a single shared object — every
 * tool on a Gmail server mentions a message — would flag the whole server;
 * higher and the job-application cluster, which shares a resume and a job and
 * differs on everything else, stops being visible.
 */
export const INPUT_OVERLAP_FLAG = 0.5;

/**
 * Distinctive enough by the old measure to have passed unnoticed.
 *
 * A pair above the corpus median has cleared the check this page has always
 * run. A pair that is distinctive *and* overlapping is the case the whole
 * signal exists for, and it gets its own category — the existing metric calls
 * it healthy, so nothing else on the page will ever mention it.
 *
 * Read from `STUDY` rather than written out. It was written out as `0.26`, and
 * when the corpus was re-run with stemming the median fell to 0.20 — leaving a
 * literal here would have kept the page grading pairs against a benchmark it no
 * longer prints anywhere, which is the exact drift this file's header warns
 * about. There is one median and it lives in `study.ts`.
 */
export const INPUT_OVERLAP_DISTINCTIVE = STUDY.median_distinctive_share;

/* ── Output distinguishability ────────────────────────────────────────────── */

/**
 * Whether two tools state outputs a reader could tell apart.
 *
 * ── Why input overlap needs a gate ─────────────────────────────────────────
 * Input overlap on its own produces false positives on well-designed pairs, and
 * the counter-example is concrete. A six-tool ticket server has two tools with
 * identical input shapes that are correctly two tools: one returns flat details
 * for many tickets, the other a bounded evidence bundle with comments and source
 * anchors. Same input, clearly different stated output. Input overlap flags it
 * and the author is right to dismiss the flag.
 *
 * So the rule is a conjunction, not a single signal:
 *
 *     overlapping inputs + distinguishable outputs   = fine design
 *     overlapping inputs + indistinguishable outputs = the failure
 *
 * On a server with a hundred tools a 10% false-positive rate buries the real
 * signal completely, which is why this is a gate rather than a note in the docs.
 */

/**
 * The words a tool says it gives back.
 *
 * Three sources, in the order they are worth trusting:
 *
 *   1. `outputSchema` property names, when there is one. Like a parameter name
 *      on the input side, this is the author stating the shape with no prose
 *      around it, and it needs no parsing at all.
 *   2. Everything after a return marker — `returns`, `produces`, `gives`,
 *      `provides`, or a colon — to the end of that sentence. This is the exact
 *      half `inputNouns` throws away, read here instead of discarded.
 *   3. Nothing.
 *
 * An empty set is a finding, not a gap. A tool that never says what it returns
 * cannot be told apart from a sibling by its output, so silence counts as
 * indistinguishable rather than as missing data. It is also the commonest shape
 * on a focused server, which is the gap the domain reading reports.
 */
export function outputTerms(tool: Tool, surfaces?: Surfaces): Set<string> {
  const terms = new Set<string>();

  const schema = (tool as { outputSchema?: { properties?: unknown } }).outputSchema;
  const properties = schema?.properties;
  if (properties && typeof properties === "object") {
    for (const name of Object.keys(properties as Record<string, unknown>)) {
      for (const token of nameTokens(name, surfaces)) if (token.length > 1) terms.add(token);
    }
  }

  const description = typeof tool.description === "string" ? tool.description : "";
  const marker = RETURN_MARKER.exec(description);
  // Only when something comes before it, matching `inputNouns`: "Return the
  // user's job matches" opens on its verb, so the whole description is the
  // output rather than the half after a marker that is not there.
  if (marker && /[a-z]/i.test(description.slice(0, marker.index))) {
    const rest = description.slice(marker.index);
    const stop = rest.search(/[.!?\n]/);
    const tail = stop === -1 ? rest : rest.slice(0, stop);
    for (const raw of tail
      .toLowerCase()
      .split(/[^a-z']+/)
      .map((word) => word.replace(/^'+|'+$/g, ""))) {
      if (RETURN_STEMS.has(stem(raw))) continue;
      const key = contentStem(raw, surfaces);
      if (key) terms.add(key);
    }
  }

  return terms;
}

/**
 * Below this, two tools' stated outputs are different enough to tell apart.
 *
 * The same Jaccard at the same scale as the input threshold, so "half the terms
 * either one uses" means the same thing on both halves of the rule.
 */
export const OUTPUT_DISTINCT_FLAG = 0.5;

/**
 * Silence on either side is false, not true.
 *
 * The failure this gate protects is "two tools that act on the same object and
 * never say what they return". Scoring an unstated output as distinguishable
 * would wave exactly that case through, which is the one thing the gate must
 * not do.
 */
export function outputsDistinguishable(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  return jaccard(a, b) < OUTPUT_DISTINCT_FLAG;
}

/* ── The domain noun and the cluster noun ─────────────────────────────────── */

/**
 * ── Why frequency is not one signal ────────────────────────────────────────
 * Distinctive share penalises focused servers: a memory server says "memory" in
 * every description by design, and that is the server's name repeated rather
 * than a collision.
 *
 * But stripping frequent words globally breaks input overlap, because on a
 * focused server the collision *is* the domain noun. Strip `resume` from a
 * job-applications server and you delete exactly what makes three of its tools
 * confusable.
 *
 * The resolution removes the threshold question rather than answering it.
 * Frequency is not a dial; it is a distinction the count already makes:
 *
 *     a noun on ALL of a server's tools  = the domain. The server's name,
 *                                          repeated. Not a collision.
 *     a noun on a SUBSET of the tools    = a cluster, and that subset is the
 *                                          candidate collision list.
 *
 * So there are two readings with different preprocessing, and they are never
 * averaged. **The gap between them is the finding**: clean on the first and bad
 * on the second is a focused server whose tools all act on one object and never
 * say what they return. Averaging the two reports it as unremarkable.
 */

/**
 * The words every single tool on this server uses.
 *
 * Every tool, not nearly every tool. The point of the rule is that it has no
 * dial in it — a ratio would put the finding back inside a threshold nobody can
 * defend, and the count separates the two cases cleanly on its own.
 *
 * The cost is that a noun on 59 of 60 tools reads as a cluster rather than the
 * domain. That is the right way to be wrong: it is reported *as* a cluster of
 * 59, where its size is on screen, rather than silently deleted.
 */
export function domainNouns(wordsByTool: Set<string>[]): Set<string> {
  const usable = wordsByTool.filter((words) => words.size > 0);
  if (usable.length < 2) return new Set();

  const [first, ...rest] = usable;
  const shared = new Set(first);
  for (const words of rest) {
    for (const word of [...shared]) if (!words.has(word)) shared.delete(word);
    if (shared.size === 0) break;
  }
  return shared;
}

/** A noun on a subset of the tools, and which tools share it. */
export interface Cluster {
  noun: string;
  tools: string[];
}

/**
 * Every noun on a subset of the tools, tightest first.
 *
 * The candidate collision list, emitted directly rather than rolled into a
 * score. On the job-applications server the tightest cluster is `ats`, shared by
 * `score_resume` and `optimize_resume` and nothing else — which is the pair its
 * author flagged first, and the pair no ratio on this page names.
 *
 * Tightest first because a noun on two tools of ten localises the problem and a
 * noun on nine of ten barely narrows it.
 */
export function clustersOf(
  names: string[],
  wordsByTool: Set<string>[],
  domain: Set<string>,
  surfaces?: Surfaces,
): Cluster[] {
  const members = new Map<string, string[]>();

  names.forEach((name, i) => {
    for (const word of wordsByTool[i]) {
      if (domain.has(word)) continue;
      const list = members.get(word);
      if (list) list.push(name);
      else members.set(word, [name]);
    }
  });

  const out: Cluster[] = [];
  for (const [word, tools] of members) {
    if (tools.length >= 2) out.push({ noun: surfaces ? surfaces.of(word) : word, tools });
  }

  return out.sort((a, b) => a.tools.length - b.tools.length || a.noun.localeCompare(b.noun));
}

/* ── Name distinctiveness ─────────────────────────────────────────────────── */

/**
 * The same distinctive measure, over tool *names*.
 *
 * ── Why names are worth measuring at all ───────────────────────────────────
 * Server authors report, independently of each other, that when descriptions
 * stop discriminating a model falls back to pattern-matching on the name. If
 * that is what happens then the name is the backstop, and a server whose
 * descriptions collide *and* whose names collide is in a different situation
 * from one whose descriptions collide and whose names are clear. Measuring
 * only descriptions cannot tell those two apart, and until now nothing did.
 *
 * ── The prefix is stripped, and reported rather than blamed ────────────────
 * `Gmail_DeleteDraftEmail` and `Gmail_SendDraftEmail` share `gmail`, and that
 * word discriminates nothing *within* the server — every tool has it. Left in,
 * it would drag every name's score down by a constant and make a well-named
 * server look collided. Taken out, the remaining tokens are the ones a model
 * actually has to choose on. It is an observation about the server, not a
 * fault: a prefix is how a tool says which server it belongs to, which matters
 * to a client holding several.
 */

/**
 * The study's own "low" mark, applied to both description and name.
 *
 * Under 10% distinctive is already how this file decides a description has
 * stopped discriminating — `under_ten_rate`, and the threshold the nearest-
 * sibling search runs at. Names get the same bar rather than one invented for
 * them, so "both low" means the same thing on both halves.
 */
export const LOW_DISTINCTIVE = 0.1;

/** A prefix has to be on this share of the tools before it is one. */
const PREFIX_SHARE = 0.8;

/* ── Synonym verbs ────────────────────────────────────────────────────────── */

/**
 * `get_order` and `fetch_order` are the same tool name written twice.
 *
 * No stemmer reaches that — `get` and `fetch` share no letters — so a synonym
 * table is the only thing that can, and the table is small because the failure
 * is concentrated: `get` leads 15.6% of all public tool names, and the sets
 * below cover nearly every collision of this kind.
 *
 * ── Applied to the leading verb only ───────────────────────────────────────
 * A tool name is a verb followed by an object. Collapsing synonyms anywhere in
 * the name would merge `get_search_index` with `search_get_index`, which are
 * not the same tool and do not read as one; collapsing only the first token
 * merges exactly the pairs a model is being asked to choose between.
 *
 * ── Deliberately short ─────────────────────────────────────────────────────
 * Every verb left off counts as distinct, so the table under-reports collisions
 * rather than inventing them — the direction everything here errs in.
 */
const LEADING_VERB_SYNONYMS: Record<string, string> = {
  /* read one thing */
  get: "get", fetch: "get", read: "get", retrieve: "get", load: "get",
  /* read many */
  list: "list", index: "list", enumerate: "list", browse: "list",
  /* read many, by predicate */
  search: "search", query: "search", find: "search", lookup: "search",
  /* unmake */
  delete: "delete", remove: "delete", destroy: "delete", purge: "delete",
  /* make */
  create: "create", add: "create", insert: "create", new: "create",
  /* change */
  update: "update", modify: "update", edit: "update", patch: "update",
};

/** Keyed on stems, because that is the space names are counted in. */
const VERB_CANONICAL = new Map(
  Object.entries(LEADING_VERB_SYNONYMS).map(([word, canonical]) => [
    stem(word),
    stem(canonical),
  ]),
);

/**
 * `getAll` tokenises to `get` + `all`, so the leading-token rule alone would
 * canonicalise it to `get` and leave it distinct from `list`. The one two-token
 * verb common enough to earn a special case.
 */
const GET_ALL: [string, string] = [stem("get"), stem("all")];

/**
 * A name's tokens with its leading verb canonicalised.
 *
 * Unchanged when the first token is not a verb the table knows, which is the
 * common case and the safe one.
 */
export function canonicalVerb(words: string[]): string[] {
  if (words.length === 0) return words;

  if (words.length >= 2 && words[0] === GET_ALL[0] && words[1] === GET_ALL[1]) {
    return [stem("list"), ...words.slice(2)];
  }

  const canonical = VERB_CANONICAL.get(words[0]);
  return canonical ? [canonical, ...words.slice(1)] : [...words];
}

/** `Gmail_DeleteDraftEmail` → `["gmail", "delete", "draft", "email"]`. */
export function nameWords(name: string, surfaces?: Surfaces): string[] {
  return nameTokens(name, surfaces).filter((token) => token.length > 1);
}

/**
 * The token every tool on the server starts with, when there is one.
 *
 * Only the first token, and only when nearly every tool carries it. A word
 * that happens to appear in most names further along — `message` on a mail
 * server — is a real collision rather than a namespace, and stripping it would
 * hide the finding.
 */
export function commonPrefix(names: string[]): string | null {
  if (names.length < 3) return null;

  const first = names.map((name) => nameWords(name)[0]).filter(Boolean);
  if (first.length < names.length * PREFIX_SHARE) return null;

  const counts = new Map<string, number>();
  for (const token of first) counts.set(token, (counts.get(token) ?? 0) + 1);

  for (const [token, count] of counts) {
    if (count >= names.length * PREFIX_SHARE) return token;
  }
  return null;
}

/* ── Parameter descriptions ───────────────────────────────────────────────── */

/**
 * The three states a parameter description can be in, not two.
 *
 * The study counted absence — no `description` key, or an empty one. That is
 * exact, and it is a floor, because the commoner failure ships a populated
 * field: `query` described as "The query" passes every linter ever written and
 * hands a model nothing the name had not already given it.
 *
 * So the description is read against the name it sits on. Strip the words the
 * name already contains and the filler that says nothing about a value, and if
 * nothing is left the description restates the name.
 */
export type ParamState = "missing" | "restates_name" | "described";

/**
 * Filler, removed before a description is called substantive.
 *
 * Two kinds, both here for one reason. The first is ordinary English glue —
 * `the`, `to`, `optional`. The second is the words that name the *slot* rather
 * than the value in it: `value`, `field`, `apply`, `specify`. "A filter to
 * apply" on a parameter named `filter` is three filler words around the
 * parameter's own name.
 *
 * The list is a judgement call and deliberately short. Every word left off it
 * counts as information, so a description survives as `described` on the
 * strength of one real word — under-reporting the problem, which is the
 * direction the study errs in everywhere else.
 */
const PARAM_FILLER = new Set(
  `a an the of to for this that is are be and or in on at by with from it its as
   use used using uses optional required
   apply applies applied applying specify specifies specified specifying
   provide provides provided pass passed passing give gives given
   set sets setting want wants desired need needs
   value values field fields parameter parameters param params
   argument arguments input inputs option options here there which what your you`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * Short forms a name and its description spell differently.
 *
 * `maxResults` described as "Maximum results" is the same two words twice, and
 * a token comparison misses it because `max` is not `maximum`. Expanding both
 * sides through one map catches it without letting a prefix rule loose — a
 * prefix rule would also collapse `user` into `username`, which is a real
 * distinction a description is entitled to draw.
 */
const ABBREVIATIONS: Record<string, string> = {
  max: "maximum",
  min: "minimum",
  num: "number",
  cnt: "count",
  qty: "quantity",
  amt: "amount",
  pct: "percent",
  id: "identifier",
  uid: "identifier",
  idx: "index",
  len: "length",
  desc: "description",
  msg: "message",
  addr: "address",
  ts: "timestamp",
  tz: "timezone",
  cfg: "configuration",
  config: "configuration",
  dir: "directory",
  req: "request",
  res: "response",
  resp: "response",
  str: "string",
  int: "integer",
  bool: "boolean",
  args: "argument",
  auth: "authentication",
  repo: "repository",
  org: "organisation",
  organization: "organisation",
  prev: "previous",
  curr: "current",
  info: "information",
  spec: "specification",
  attr: "attribute",
  prop: "property",
  ref: "reference",
  src: "source",
  dst: "destination",
  dest: "destination",
};

/**
 * `max`, `Results` → `maximum`, `result`. Expand, then stem.
 *
 * The order matters and is not interchangeable. `organization` and
 * `organisation` stem to `organ` and `organis` — two spellings of one word,
 * pulled *further apart* by the stemmer — so the map has to collapse them
 * before Porter sees either. The map is also the only thing that knows `max`
 * and `maximum` are the same word: no suffix rule can reach that, and a prefix
 * rule loose enough to try would also collapse `user` into `username`, which is
 * a distinction a description is entitled to draw.
 *
 * Three hand-rolled plural rules used to live here. They were a stemmer with
 * one rule in it, and `screens` / `screening` is the pair they could not merge.
 */
function normalise(word: string, surfaces?: Surfaces): string {
  const expanded = ABBREVIATIONS[word] ?? word;
  // The surface recorded is the word the author wrote, not the expansion: a
  // reader looking for `maxResults` in their own schema will not find
  // `maximum`.
  if (surfaces && expanded === word) return surfaces.add(word);
  return stem(expanded);
}

/** `maxResults` → `["maximum", "result"]`. camelCase, snake_case, kebab-case. */
export function nameTokens(name: string, surfaces?: Surfaces): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    // `HTTPServer` → `HTTP Server`, so an acronym does not swallow the word
    // that follows it.
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((token) => normalise(token.toLowerCase(), surfaces));
}

export function paramState(name: string, description: unknown): ParamState {
  if (typeof description !== "string" || description.trim() === "") return "missing";

  const from_name = new Set(nameTokens(name));
  const remaining = description
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter(Boolean)
    .filter((word) => !PARAM_FILLER.has(word))
    // Point-free would pass the array index in as `surfaces`. A parameter
    // description never reaches the page as a word list, so none is wanted.
    .map((word) => normalise(word))
    .filter((word) => !from_name.has(word));

  return remaining.length === 0 ? "restates_name" : "described";
}

/* ── Annotations against prose ────────────────────────────────────────────── */

/**
 * Two readers, two channels, and nothing making them agree.
 *
 * MCP tools carry `readOnlyHint`, `destructiveHint`, `idempotentHint` and
 * `openWorldHint`. Authors set those *and* write "Read-only" or "REPLACES the
 * existing file" into the description by hand — because the two are read by
 * different things at different moments:
 *
 *   the **annotation** is read by the client, deciding whether to prompt the
 *   user before the call happens;
 *   the **description** is read by the model, deciding whether to call at all.
 *
 * Nothing in the protocol requires them to say the same thing, and when they
 * drift the failure is silent in both directions. Raised independently by two
 * server authors, which is why it is checked in both directions here.
 *
 * ── This cannot be measured on the corpus ──────────────────────────────────
 * The Smithery registry drops `annotations` exactly as it drops the top-level
 * `required` array: it reports the field for none of 82,549 tools, while the
 * four official reference servers booted locally emit it for all 37 of theirs,
 * with every hint represented. So there is no corpus benchmark to print beside
 * these findings, and the page must not invent one — but an author pasting
 * their own `tools/list` has the field, so the check runs for them.
 */

/** The four hints, and the prose that means the same thing. */
const HINT_PROSE: Array<{ hint: string; pattern: RegExp; means: string }> = [
  {
    hint: "readOnlyHint",
    pattern: /\bread[-\s]?only\b|\bdoes not (?:modify|change|write)\b|\bnon-?destructive\b/i,
    means: "read-only",
  },
  {
    hint: "destructiveHint",
    pattern:
      /\breplaces?\b|\boverwrites?\b|\bdeletes?\b|\bdestructive\b|\bpermanent(?:ly)?\b|\birreversible\b|\bcannot be undone\b|\bcan ?not be reversed\b/i,
    means: "destructive",
  },
  { hint: "idempotentHint", pattern: /\bidempotent\b/i, means: "idempotent" },
  {
    hint: "openWorldHint",
    pattern: /\bexternal (?:api|service|system)\b|\bthird[-\s]?party\b/i,
    means: "open-world",
  },
];

/** One tool's annotations, whatever shape they arrived in. */
function annotationsOf(tool: Tool): Record<string, unknown> {
  const value = (tool as { annotations?: unknown }).annotations;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export interface AnnotationFinding {
  tool: string;
  hint: string;
  /**
   * `prose_only` — the description states the constraint and the hint is unset,
   * so the client cannot protect the user.
   *
   * `hint_only` — the hint is set and the description is silent, so the model
   * does not know what the tool does at the moment it is choosing to call it.
   */
  kind: "prose_only" | "hint_only";
  /** The words in the description that triggered it, for a message that quotes. */
  evidence?: string;
}

/**
 * A pair a model cannot tell apart that the *client* can.
 *
 * Two tools with nothing to choose between them in either description, whose
 * annotations differ — so the host will auto-approve one and prompt for the
 * other, on a distinction the chooser cannot see at all. A safety boundary the
 * client honours and the model is blind to, which is the worst arrangement of
 * the three.
 */
export interface AnnotationOnlyPair {
  a: string;
  b: string;
  /** The hints they disagree on. */
  differs_on: string[];
}

function annotationFindings(named: Array<{ tool: Tool; name: string }>): AnnotationFinding[] {
  const out: AnnotationFinding[] = [];

  for (const { tool, name } of named) {
    const annotations = annotationsOf(tool);
    const description = typeof tool.description === "string" ? tool.description : "";

    for (const { hint, pattern, means } of HINT_PROSE) {
      const match = pattern.exec(description);
      const set = annotations[hint];

      // Only `true` counts as set. `destructiveHint: false` is an author saying
      // the opposite, and pairing it with destructive prose is a contradiction
      // worth reporting as prose_only rather than as agreement.
      if (match && set !== true) {
        out.push({ tool: name, hint, kind: "prose_only", evidence: match[0] });
      } else if (!match && set === true) {
        // `readOnlyHint` is the exception and is deliberately not reported this
        // way: a read-only tool whose description does not say "read-only" has
        // told the model nothing dangerous. The cost of silence is only real
        // when the silence hides a side effect.
        if (hint !== "readOnlyHint") out.push({ tool: name, hint, kind: "hint_only" });
      }
      void means;
    }
  }

  return out;
}

function annotationOnlyPairs(
  named: Array<{ tool: Tool; name: string }>,
  per_tool: ToolReport[],
): AnnotationOnlyPair[] {
  // Only among tools that have already lost the ability to discriminate. On a
  // healthy pair a differing hint is just two tools doing different things.
  const collided = per_tool
    .map((report, i) => (report.distinctive_share === 0 && report.word_count > 0 ? i : -1))
    .filter((i) => i >= 0);
  if (collided.length < 2) return [];

  /**
   * One representative per distinct set of hints, rather than every pair.
   *
   * The naive version compares every collided tool with every other, and the
   * shape that triggers this check is precisely the one where that is quadratic:
   * a server whose descriptions are generated boilerplate collides on all of
   * them, and 5,000 such tools is 12.5 million pairs — 2.8 seconds on the main
   * thread, measured, against a 750ms budget for the whole page.
   *
   * Grouping first makes it linear and makes the output better. Two tools with
   * the same hints cannot be an annotation-only pair by definition, so a group
   * contributes nothing internally; and a list of ten thousand rows that all say
   * the same thing is not a finding a reader can act on, where "these two differ
   * on destructiveHint and nothing else" is.
   */
  const signatures = new Map<string, number>();
  for (const i of collided) {
    const annotations = annotationsOf(named[i].tool);
    const signature = HINT_PROSE.map(({ hint }) =>
      hint in annotations ? `${hint}=${String(annotations[hint])}` : "",
    ).join("|");
    if (!signatures.has(signature)) signatures.set(signature, i);
  }

  // Every collided tool carries the same hints, so none of them differ.
  if (signatures.size < 2) return [];

  const representatives = [...signatures.values()];
  const out: AnnotationOnlyPair[] = [];

  for (let x = 0; x < representatives.length && out.length < MAX_OVERLAP_PAIRS; x++) {
    for (let y = x + 1; y < representatives.length && out.length < MAX_OVERLAP_PAIRS; y++) {
      const i = representatives[x];
      const j = representatives[y];
      const left = annotationsOf(named[i].tool);
      const right = annotationsOf(named[j].tool);

      const differs = HINT_PROSE.map(({ hint }) => hint).filter(
        (hint) => (hint in left || hint in right) && left[hint] !== right[hint],
      );

      if (differs.length > 0) {
        out.push({ a: named[i].name, b: named[j].name, differs_on: differs });
      }
    }
  }

  return out;
}

/* ── Report ───────────────────────────────────────────────────────────────── */

export interface ToolReport {
  name: string;
  description: string;
  described: boolean;
  /** Share of this tool's content words that no sibling uses. 1 when alone. */
  distinctive_share: number;
  distinctive_words: string[];
  word_count: number;

  /**
   * The same share, over the tool's *name* — tokens no sibling name uses, of
   * the tokens it has, with any server-wide prefix already stripped.
   *
   * The backstop when a description stops discriminating. See the section on
   * name distinctiveness above.
   */
  name_distinctive_share: number;
  /** The name's tokens, prefix stripped, for a message that can quote them. */
  name_words: string[];
  /** What this tool is understood to act on. See `inputNouns`. */
  input_nouns: string[];
  /** What it says it gives back. Empty means it never says. See `outputTerms`. */
  output_terms: string[];
  /**
   * Distinctive share with the server's own domain words taken out.
   *
   * Reading 1 of the two. A focused server scores badly on `distinctive_share`
   * for saying its own name in every description, which is not a fault; this is
   * the same measure with that word removed, and it is the one to read when
   * deciding whether the *wording* discriminates.
   */
  domain_stripped_share: number;

  /** Top level, matching the study's denominator. */
  param_count: number;
  /** No `description` at all. The study's definition, unchanged. */
  undescribed_params: string[];
  /** Populated, and adds nothing the parameter's name did not already say. */
  restated_params: string[];
  /** Every depth, for the list of things to actually go and fix. */
  undescribed_deep: string[];
  restated_deep: string[];
  /** Only computed for flagged tools; never feeds a headline number. */
  nearest?: Nearest;
}

/**
 * The sibling a tool is hardest to tell apart from.
 *
 * `overlap` is the share of *this* tool's content words that also appear in the
 * named one, so it is directional: a one-line tool inside a verbose sibling can
 * be 100% contained while the sibling is only 20% contained in it. The reader
 * is looking at the flagged tool, so the flagged tool is the denominator.
 */
export interface Nearest {
  name: string;
  overlap: number;
}

/**
 * Nearest siblings for the flagged tools, in bounded time.
 *
 * ── The problem this is written around ────────────────────────────────────
 * The obvious version compares every flagged tool against every other tool.
 * That is O(n²) with a set intersection inside it, and it is not a theoretical
 * concern: measured on 2,530 tools — the largest real server in the study — it
 * takes 2.6 seconds, and 5.8 seconds on 5,000. On the main thread, with no
 * spinner, that is a frozen tab.
 *
 * Worse, it degrades exactly where it is needed. A tool is flagged when it has
 * almost nothing distinctive, so a server full of collisions flags nearly every
 * tool — and servers full of collisions are the big ones, where 32.4% of tools
 * collide against 0.5% on the smallest. The naive version is slowest on the
 * servers whose authors most need the answer.
 *
 * ── Three bounds, in the order they bite ──────────────────────────────────
 * **1. Identical word sets are grouped first.** The common shape of a bad
 * server is a generated description repeated verbatim, so hundreds of tools
 * share one signature. Any other member of the group is a 100% match by
 * definition, which makes the answer O(1) and skips the search entirely.
 *
 * **2. Candidates come from an inverted index, rarest word first.** A word in
 * 80% of the tools cannot tell you *which* sibling is the problem, and its
 * posting list is enormous. Walking words in ascending frequency finds real
 * candidates in the first few lists and lets the budget stop the walk before it
 * reaches the useless ones.
 *
 * **3. A postings budget per tool.** Once spent, the walk stops and scoring
 * happens on whatever candidates were found. This is what makes the worst case
 * linear rather than quadratic. It can, in principle, miss a better match — so
 * this is only ever an *enhancement* on a flagged tool, never an input to any
 * headline number. Nothing scored is allowed to depend on it.
 */
const NEAREST_BUDGET = 600;
const NEAREST_CANDIDATES = 8;

function nearestSiblings(
  words_by_tool: Set<string>[],
  names: string[],
  flagged: number[],
): (Nearest | undefined)[] {
  const out = new Array<Nearest | undefined>(words_by_tool.length).fill(undefined);
  if (flagged.length === 0 || words_by_tool.length < 2) return out;

  /* Bound 1 — identical word sets. */
  const groups = new Map<string, number[]>();
  const signatures = words_by_tool.map((words) => [...words].sort().join(" "));
  signatures.forEach((signature, i) => {
    if (words_by_tool[i].size === 0) return;
    const group = groups.get(signature);
    if (group) group.push(i);
    else groups.set(signature, [i]);
  });

  /* The inverted index, and each word's frequency, for bounds 2 and 3. */
  const postings = new Map<string, number[]>();
  words_by_tool.forEach((words, i) => {
    for (const word of words) {
      const list = postings.get(word);
      if (list) list.push(i);
      else postings.set(word, [i]);
    }
  });

  const counts = new Map<number, number>();

  for (const i of flagged) {
    const words = words_by_tool[i];
    if (words.size === 0) continue;

    const twins = groups.get(signatures[i]);
    if (twins && twins.length > 1) {
      out[i] = { name: names[twins[0] === i ? twins[1] : twins[0]], overlap: 1 };
      continue;
    }

    /* Bound 2 — rarest words first. */
    const by_rarity = [...words].sort(
      (a, b) => (postings.get(a)?.length ?? 0) - (postings.get(b)?.length ?? 0),
    );

    counts.clear();
    let spent = 0;

    for (const word of by_rarity) {
      const list = postings.get(word);
      if (!list) continue;
      /* Bound 3 — stop before the useless, enormous lists. */
      if (spent + list.length > NEAREST_BUDGET && counts.size > 0) break;

      for (const j of list) {
        if (j === i) continue;
        counts.set(j, (counts.get(j) ?? 0) + 1);
      }
      spent += list.length;
      if (spent >= NEAREST_BUDGET) break;
    }

    /* Exact overlap, but only for the strongest few candidates. */
    const shortlist = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, NEAREST_CANDIDATES);

    let best: Nearest | undefined;
    for (const [j] of shortlist) {
      let shared = 0;
      for (const word of words) if (words_by_tool[j].has(word)) shared++;
      const overlap = shared / words.size;
      if (!best || overlap > best.overlap) best = { name: names[j], overlap };
    }

    // Below half, "these two look alike" is not a claim worth putting on screen.
    if (best && best.overlap >= 0.5) out[i] = best;
  }

  return out;
}

export interface ProseEnum {
  tool: string;
  param: string;
  description: string;
}

/**
 * Two tools that act on enough of the same thing to be confusable, and the
 * nouns they have in common.
 *
 * `shared` is what makes the row actionable — "both operate on: resume, ats"
 * names the object a request would have to mention for the ambiguity to bite.
 */
export interface InputOverlapPair {
  a: string;
  b: string;
  overlap: number;
  shared: string[];
  /**
   * True when both descriptions cleared the corpus median and this still
   * fired: the dangerous combination, because the existing metric has already
   * called this pair healthy and nothing else will mention it.
   */
  looks_healthy: boolean;
  /** What each tool says it gives back. Empty is why most pairs are flagged. */
  a_output: string[];
  b_output: string[];
}

/**
 * Every confusable pair, worst first.
 *
 * O(n²), and bounded rather than clever: a server with more tools than this
 * would spend longer pairing them than a reader would spend on the answer, and
 * the pairs that matter are the top few. `MAX_OVERLAP_TOOLS` is above the
 * corpus's 99th percentile for tools per server, so the cap is effectively
 * never reached on a real paste.
 */
const MAX_OVERLAP_TOOLS = 300;
const MAX_OVERLAP_PAIRS = 50;

function overlapPairs(
  per_tool: ToolReport[],
  nouns: Set<string>[],
  outputs: Set<string>[],
  surfaces: Surfaces,
): { flagged: InputOverlapPair[]; near_misses: InputOverlapPair[] } {
  const flagged: InputOverlapPair[] = [];
  const near_misses: InputOverlapPair[] = [];
  const count = Math.min(per_tool.length, MAX_OVERLAP_TOOLS);

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const overlap = jaccard(nouns[i], nouns[j]);
      if (overlap < INPUT_OVERLAP_FLAG) continue;

      // Printed as the author wrote them: "both operate on: resume, ats",
      // not "resum, ats".
      const shared = surfaces.all([...nouns[i]].filter((word) => nouns[j].has(word))).sort();

      const pair: InputOverlapPair = {
        a: per_tool[i].name,
        b: per_tool[j].name,
        overlap,
        shared,
        looks_healthy:
          per_tool[i].distinctive_share >= INPUT_OVERLAP_DISTINCTIVE &&
          per_tool[j].distinctive_share >= INPUT_OVERLAP_DISTINCTIVE,
        a_output: surfaces.all(outputs[i]).sort(),
        b_output: surfaces.all(outputs[j]).sort(),
      };

      // The gate. Sharing an input is not the failure; sharing an input while
      // neither tool states an output the other's could be told from is.
      if (outputsDistinguishable(outputs[i], outputs[j])) near_misses.push(pair);
      else flagged.push(pair);
    }
  }

  const worstFirst = (left: InputOverlapPair, right: InputOverlapPair) =>
    right.overlap - left.overlap;

  return {
    flagged: flagged.sort(worstFirst).slice(0, MAX_OVERLAP_PAIRS),
    near_misses: near_misses.sort(worstFirst).slice(0, MAX_OVERLAP_PAIRS),
  };
}

export interface Report {
  tool_count: number;
  bucket: (typeof STUDY.buckets)[number];

  params: {
    /** Top level only — the denominator the corpus rate can be compared to. */
    total: number;
    /**
     * Absence only: no `description`, or an empty one. This is the study's
     * definition and it stays the study's definition, because `rate` below is
     * printed beside a published corpus figure and the two have to be the same
     * measurement. The restatements are counted separately, not folded in.
     */
    undescribed: number;
    rate: number;
    /** Populated, and says nothing the parameter's name did not. */
    restates_name: number;
    restates_rate: number;
    /** Both failures together: what the model actually has to guess at. */
    substantive: number;
    substantive_rate: number;
    with_enum: number;
    enum_rate: number;
    /** Every depth. Not comparable to the corpus; used for the fix list. */
    deep_total: number;
    deep_undescribed: number;
    deep_restated: number;
  };

  tools_undescribed: string[];
  duplicate_names: string[];

  distinctive: {
    median_share: number;
    zero: string[];
    zero_rate: number;
    under_ten_rate: number;
    /** The same median, over names rather than descriptions. */
    median_name_share: number;
    /** The server-wide prefix that was stripped before scoring, if any. */
    name_prefix: string | null;
    /**
     * Tools whose description and whose name have both stopped discriminating.
     *
     * The serious case, and the one nothing else on the page can reach: if the
     * name is what a model falls back to when descriptions collide, a tool in
     * here has left it nothing at all.
     */
    both_low: string[];
  };

  /**
   * Pairs of tools that act on enough of the same thing to be confusable.
   *
   * Sorted by overlap, worst first, and capped — a server where every tool
   * shares an object has n² pairs and the first few are the finding.
   */
  input_overlap: InputOverlapPair[];

  /**
   * Pairs that share an object and say different things about what they return.
   *
   * Reported without alarm: this is what good design looks like when two tools
   * take the same argument. A six-tool ticket server has exactly this pair —
   * flat details for many tickets against a bounded evidence bundle — and its
   * author is right to dismiss the flag. Separating them out is what keeps the
   * list above worth reading on a server with a hundred tools.
   */
  near_misses: InputOverlapPair[];

  /**
   * The two readings of word frequency, kept apart.
   *
   * `stripped_median_share` answers "do these descriptions look alike once the
   * server's own name is out of them". `input_overlap` above answers "could two
   * of these tools be right for one sentence", and needs the domain word left
   * in, because on a focused server the domain word *is* the collision.
   *
   * `in_the_gap` is the finding neither reading states alone.
   */
  domain: {
    /** Words every tool on the server uses. The server's name, repeated. */
    nouns: string[];
    /** Reading 1: the median distinctive share with those words removed. */
    stripped_median_share: number;
    /** Candidate collisions: a noun on a subset of tools, tightest first. */
    clusters: Cluster[];
    /**
     * Clean on reading 1, flagged on reading 2. A focused server whose tools
     * all act on one object and never say what they return — a common shape,
     * and one that averaging the two readings hides completely.
     */
    in_the_gap: boolean;
  };

  cost: {
    bytes: number;
    tokens: number;
    /** Where this sits against the corpus: below median, mid, or above p90. */
    band: "under-median" | "median-to-p90" | "over-p90";
  };

  prose_enums: ProseEnum[];

  /**
   * Where the description and the annotations disagree.
   *
   * No corpus figure is printed beside these: the registry drops `annotations`
   * for every tool it stores, so there is nothing to compare against and
   * inventing a denominator would be worse than leaving the comparison out.
   */
  annotations: {
    /** How many tools carry any annotation at all. Zero is the common case. */
    tools_with_annotations: number;
    findings: AnnotationFinding[];
    /**
     * Zero-distinctive pairs whose only difference is an annotation. The client
     * can tell them apart and will treat them differently; the model choosing
     * between them cannot tell them apart at all.
     */
    annotation_only_pairs: AnnotationOnlyPair[];
  };

  per_tool: ToolReport[];
}

/** The parameters of one tool: `inputSchema.properties`, top level only. */
function propertiesOf(tool: Tool): Record<string, unknown> {
  const schema = tool.inputSchema ?? tool.input_schema ?? tool.parameters;
  const properties = (schema as { properties?: unknown } | undefined)?.properties;
  return properties && typeof properties === "object" ? (properties as Record<string, unknown>) : {};
}

export interface DeepParam {
  /** Dotted path from the tool's schema root — `filter.from`, `tags[]`. */
  path: string;
  described: boolean;
  /** `missing`, `restates_name` or `described` — see `paramState`. */
  state: ParamState;
  type: string;
  has_enum: boolean;
  schema: Record<string, unknown>;
}

/**
 * Every parameter at every depth, as a flat list with its path.
 *
 * ── Why this is separate from the top-level count ──────────────────────────
 * Two different questions are being asked and one number cannot answer both.
 *
 * The **benchmark** question is "how do I compare to 4,749 servers", and that
 * comparison is only valid against the denominator the study used: 257,287
 * parameters over 82,549 tools is 3.1 each, which is a top-level count. Divide
 * a recursive count by a top-level rate and the percentage means something
 * different from the percentage it is printed next to — it will read as a worse
 * score for having a nested schema, which is not a finding about the schema.
 *
 * The **actionable** question is "which of my parameters is undescribed", and
 * there the answer must include nesting, because an undescribed field three
 * levels down is exactly as invisible to a model as one at the top.
 *
 * So both are computed, kept apart, and labelled apart on the page. The card
 * scores the top level; the list of things to go and fix includes everything.
 *
 * `anyOf`/`oneOf`/`allOf` are followed because a parameter defined through a
 * union is still a parameter.
 *
 * The depth cap and the identity set are guards on `analyse` as an *exported*
 * function, not on the page. Everything the page passes came through
 * `JSON.parse`, which cannot produce a cycle or a shared reference — so via
 * `parseToolsList` neither guard can fire. They are here because this is the
 * function the dashboard would reuse if it ever runs the same check on schemas
 * it holds as live objects, where both are reachable, and a hang is a much
 * worse failure than a truncated count.
 */
function deepParams(tool: Tool): DeepParam[] {
  const out: DeepParam[] = [];
  const seen = new Set<object>();

  const walk = (node: unknown, path: string, depth: number) => {
    if (!node || typeof node !== "object" || depth > 8) return;
    // A schema generator that resolves `$ref` can hand back the same object
    // twice; visiting it twice would double every parameter under it.
    if (seen.has(node)) return;
    seen.add(node);

    const schema = node as Record<string, unknown>;
    const properties = schema.properties;

    if (properties && typeof properties === "object") {
      for (const [key, raw] of Object.entries(properties as Record<string, unknown>)) {
        const child = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const description = child.description;
        const child_path = path ? `${path}.${key}` : key;

        out.push({
          path: child_path,
          described: typeof description === "string" && description.trim() !== "",
          // Classified against the key, not the path: a nested `id` restates
          // `id`, and prefixing it with `filter.` would make every nested
          // parameter look like it said something its name did not.
          state: paramState(key, description),
          type: Array.isArray(child.type) ? child.type.join("|") : String(child.type ?? ""),
          has_enum: "enum" in child,
          schema: child,
        });

        walk(child, child_path, depth + 1);
      }
    }

    if (schema.items) walk(schema.items, path ? `${path}[]` : "[]", depth + 1);

    for (const keyword of ["anyOf", "oneOf", "allOf"] as const) {
      const branch = schema[keyword];
      if (Array.isArray(branch)) for (const sub of branch) walk(sub, path, depth + 1);
    }
  };

  walk(tool.inputSchema ?? tool.input_schema ?? tool.parameters, "", 0);
  return out;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * A closed set written in prose and left as an open string.
 *
 * The study's first attempt at this over-counted by twelve times, by matching
 * illustrations — `Filter by line (e.g. "1", "A", "F")` is an example, not an
 * enum. The fix was to require explicit closed-set language *and* the absence
 * of hedging, and that is what is repeated here. It under-counts on purpose:
 * a closed set nobody wrote down is invisible to this test, and the study
 * reports the figure as a floor rather than an estimate.
 */
const CLOSED_SET =
  /\b(?:options?|valid values?|allowed values?|possible values?|accepted values?|must be one of|one of the following|one of)\s*[:\-]|\b(?:must be|can be)\s+one\s+of\b/i;
const HEDGE = /\b(?:e\.?g\.?|for example|such as|for instance|like)\b/i;
/** `processed|confirmed|finalized` — a set written as alternatives. */
const PIPED = /(?:^|\s|")[a-z][a-z0-9_-]{1,20}(?:\s?\|\s?[a-z][a-z0-9_-]{1,20}){2,}/i;

function isProseEnum(schema: Record<string, unknown>): boolean {
  if ("enum" in schema) return false;
  const type = schema.type;
  if (type !== undefined && type !== "string" && !(Array.isArray(type) && type.includes("string")))
    return false;

  const description = schema.description;
  if (typeof description !== "string") return false;
  if (HEDGE.test(description)) return false;

  return CLOSED_SET.test(description) || PIPED.test(description);
}

/**
 * The schema's size on the wire.
 *
 * `JSON.stringify` throws on a circular structure, and while the page can never
 * hand one over — its input came from `JSON.parse` — a caller holding live
 * objects can. A thrown exception here would lose the whole report over one
 * number, so a cycle falls back to a serialiser that drops the repeated
 * reference and the figure comes back low rather than absent.
 */
function measureBytes(tools: Tool[]): number {
  const encode = (json: string) => new TextEncoder().encode(json).length;

  try {
    return encode(JSON.stringify(tools));
  } catch {
    const seen = new WeakSet<object>();
    return encode(
      JSON.stringify(tools, (_key, value) => {
        if (value && typeof value === "object") {
          if (seen.has(value)) return undefined;
          seen.add(value);
        }
        return value;
      }),
    );
  }
}

export function analyse(tools: Tool[]): Report {
  /**
   * Stems are counted; surface words are printed.
   *
   * Everything below counts in stem space, because that is the correction —
   * `screens` and `screening` are one word. But a page that tells an author
   * their tightest collision is on `at` when every tool they wrote says `ATS`
   * has made itself harder to check than the schema it is checking. So one
   * registry collects the words as written and every list that reaches the page
   * goes back through it.
   *
   * Per call rather than module-level: two pastes in one tab must not be able to
   * show each other's wording.
   */
  const surfaces = new Surfaces();

  const named = tools.map((tool, i) => ({
    tool,
    name: typeof tool.name === "string" && tool.name ? tool.name : `«tool ${i + 1} has no name»`,
  }));

  /**
   * How many *other* tools use each word.
   *
   * Counted once per tool rather than once per occurrence, so a word repeated
   * inside one description does not look shared.
   */
  const word_tools = new Map<string, number>();
  const words_by_tool = named.map(({ tool }) => contentWords(tool.description, surfaces));

  for (const words of words_by_tool) {
    for (const word of words) word_tools.set(word, (word_tools.get(word) ?? 0) + 1);
  }

  /**
   * The same count, over name tokens.
   *
   * A second tally rather than a filter on the first: a word can be all over
   * the descriptions and still be the only thing one *name* has, and the two
   * questions have different answers on purpose. The server-wide prefix comes
   * off before anything is counted, or it would be shared by construction and
   * drag every name down by a constant.
   */
  const name_prefix = commonPrefix(named.map(({ name }) => name));
  const name_words_by_tool = named.map(({ name }) => {
    const words = nameWords(name, surfaces);
    const stripped = name_prefix !== null && words[0] === name_prefix ? words.slice(1) : words;
    // After the prefix comes off, so the verb is genuinely first: on
    // `Gmail_GetThread` the leading token is `gmail` until it is stripped, and
    // the synonym table would never see `get`.
    return canonicalVerb(stripped);
  });

  const name_tools = new Map<string, number>();
  for (const words of name_words_by_tool) {
    for (const word of new Set(words)) name_tools.set(word, (name_tools.get(word) ?? 0) + 1);
  }

  const nouns_by_tool = named.map(({ tool }) => inputNouns(tool, surfaces));
  const outputs_by_tool = named.map(({ tool }) => outputTerms(tool, surfaces));
  const deep_by_tool = named.map(({ tool }) => deepParams(tool));

  /**
   * Reading 1: distinctiveness with the server's own name taken out.
   *
   * Computed over the same content words as `distinctive_share`, minus the
   * words every tool uses. A tool whose every word is the domain scores 0
   * rather than being skipped — it has said nothing the server's name had not,
   * which is the same call the un-stripped reading makes for a tool whose words
   * are all shared.
   */
  const domain = domainNouns(words_by_tool);
  const stripped_by_tool = words_by_tool.map((words) => {
    const mine = new Set([...words].filter((word) => !domain.has(word)));
    if (mine.size === 0) return 0;
    let unique = 0;
    for (const word of mine) {
      // Domain words are out on both sides, so a word shared only through the
      // domain is not counted against the tool twice.
      const shared = words_by_tool.some((other) => other !== words && other.has(word));
      if (!shared) unique++;
    }
    return unique / mine.size;
  });

  const per_tool: ToolReport[] = named.map(({ tool, name }, i) => {
    const words = words_by_tool[i];
    const distinctive = [...words].filter((word) => word_tools.get(word) === 1);

    const own_name = new Set(name_words_by_tool[i]);
    const distinctive_name = [...own_name].filter((word) => name_tools.get(word) === 1);

    const properties = propertiesOf(tool);
    const states = Object.entries(properties).map(
      ([param, schema]) =>
        [param, paramState(param, (schema as { description?: unknown })?.description)] as const,
    );

    return {
      name,
      description: typeof tool.description === "string" ? tool.description : "",
      described: typeof tool.description === "string" && tool.description.trim() !== "",
      // A tool alone on a server has nothing to collide with, so its words are
      // all distinctive by definition. Reported as 1 rather than excluded,
      // which is how the 1–3 bucket gets a 0.5% rate rather than no rate.
      distinctive_share: words.size === 0 ? 0 : distinctive.length / words.size,
      distinctive_words: distinctive,
      word_count: words.size,
      name_distinctive_share: own_name.size === 0 ? 0 : distinctive_name.length / own_name.size,
      name_words: surfaces.all(name_words_by_tool[i]),
      input_nouns: surfaces.all(nouns_by_tool[i]),
      output_terms: surfaces.all(outputs_by_tool[i]).sort(),
      domain_stripped_share: stripped_by_tool[i],
      param_count: Object.keys(properties).length,
      undescribed_params: states.filter(([, state]) => state === "missing").map(([param]) => param),
      restated_params: states
        .filter(([, state]) => state === "restates_name")
        .map(([param]) => param),
      undescribed_deep: deep_by_tool[i].filter((p) => !p.described).map((p) => p.path),
      restated_deep: deep_by_tool[i].filter((p) => p.state === "restates_name").map((p) => p.path),
    };
  });

  /**
   * Nearest siblings, for the flagged tools only.
   *
   * Under 10% distinctive is the study's own "low" threshold, and it is also
   * the only band where the answer is worth computing: a tool that is 60%
   * distinctive has a nearest sibling too, and naming it would be noise.
   */
  const flagged = per_tool
    .map((report, i) => (report.distinctive_share <= 0.1 && report.word_count > 0 ? i : -1))
    .filter((i) => i >= 0);

  const nearest = nearestSiblings(
    words_by_tool,
    per_tool.map((report) => report.name),
    flagged,
  );
  nearest.forEach((match, i) => {
    if (match) per_tool[i].nearest = match;
  });

  /* Parameters, and the two things worth saying about them. */
  let total_params = 0;
  let undescribed_params = 0;
  let restated_params = 0;
  let with_enum = 0;
  const prose_enums: ProseEnum[] = [];

  for (const { tool, name } of named) {
    for (const [param, raw] of Object.entries(propertiesOf(tool))) {
      total_params++;
      const schema = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

      const description = schema.description;
      const state = paramState(param, description);
      if (state === "missing") undescribed_params++;
      else if (state === "restates_name") restated_params++;
      if ("enum" in schema) with_enum++;

      if (isProseEnum(schema)) {
        prose_enums.push({ tool: name, param, description: String(description) });
      }
    }
  }

  /* Duplicate names — cheap to check, and the study says nobody has them. */
  const seen = new Set<string>();
  const duplicate_names: string[] = [];
  for (const { name } of named) {
    if (seen.has(name) && !duplicate_names.includes(name)) duplicate_names.push(name);
    seen.add(name);
  }

  /**
   * Size, measured re-serialised rather than as pasted.
   *
   * The reader's clipboard is usually pretty-printed, and indentation is not
   * something their server sends. Compacting first measures the schema, not the
   * formatting — otherwise the checker would grade a reader worse for having
   * run their JSON through a formatter before pasting it.
   */
  const bytes = measureBytes(tools);
  const tokens = Math.round(bytes / 4);

  const overlap = overlapPairs(per_tool, nouns_by_tool, outputs_by_tool, surfaces);

  const shares = per_tool.map((report) => report.distinctive_share);
  const zero = per_tool.filter((report) => report.distinctive_share === 0);

  /** What a model actually has to guess at: absent, plus saying nothing. */
  const substantive = undescribed_params + restated_params;

  return {
    tool_count: tools.length,
    bucket: bucketFor(tools.length),
    params: {
      total: total_params,
      undescribed: undescribed_params,
      rate: total_params === 0 ? 0 : undescribed_params / total_params,
      restates_name: restated_params,
      restates_rate: total_params === 0 ? 0 : restated_params / total_params,
      substantive,
      substantive_rate: total_params === 0 ? 0 : substantive / total_params,
      with_enum,
      enum_rate: total_params === 0 ? 0 : with_enum / total_params,
      deep_total: deep_by_tool.reduce((sum, list) => sum + list.length, 0),
      deep_undescribed: deep_by_tool.reduce(
        (sum, list) => sum + list.filter((param) => !param.described).length,
        0,
      ),
      deep_restated: deep_by_tool.reduce(
        (sum, list) => sum + list.filter((param) => param.state === "restates_name").length,
        0,
      ),
    },
    tools_undescribed: per_tool.filter((report) => !report.described).map((report) => report.name),
    duplicate_names,
    distinctive: {
      median_share: median(shares),
      zero: zero.map((report) => report.name),
      zero_rate: zero.length / per_tool.length,
      under_ten_rate: shares.filter((share) => share < 0.1).length / per_tool.length,
      median_name_share: median(per_tool.map((report) => report.name_distinctive_share)),
      name_prefix,
      // The both-low quadrant. A tool whose description has stopped
      // discriminating still has its name; a tool in here has neither, which
      // is the case no existing figure on this page separates out.
      both_low: per_tool
        .filter(
          (report) =>
            report.distinctive_share < LOW_DISTINCTIVE &&
            report.name_distinctive_share < LOW_DISTINCTIVE,
        )
        .map((report) => report.name),
    },
    input_overlap: overlap.flagged,
    near_misses: overlap.near_misses,
    domain: {
      nouns: surfaces.all(domain).sort(),
      stripped_median_share: median(stripped_by_tool),
      clusters: clustersOf(
        per_tool.map((report) => report.name),
        words_by_tool,
        domain,
        surfaces,
      ),
      // Clean once the domain is out, and still sharing an object. The shape
      // neither reading names on its own.
      in_the_gap:
        overlap.flagged.length > 0 &&
        median(stripped_by_tool) >= STUDY.median_distinctive_share,
    },
    cost: {
      bytes,
      tokens,
      band:
        bytes <= STUDY.median_bytes
          ? "under-median"
          : bytes <= STUDY.p90_bytes
            ? "median-to-p90"
            : "over-p90",
    },
    prose_enums,
    annotations: {
      tools_with_annotations: named.filter(({ tool }) => Object.keys(annotationsOf(tool)).length > 0)
        .length,
      findings: annotationFindings(named),
      annotation_only_pairs: annotationOnlyPairs(named, per_tool),
    },
    per_tool,
  };
}
