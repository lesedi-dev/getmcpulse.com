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
 * A description's content words, as a set.
 *
 * A set rather than a list of tokens: the question is which *words* a tool has
 * that its siblings do not, and a tool that repeats "email" nine times has one
 * word, not nine. Numbers and single characters are dropped — a `2` in a
 * description distinguishes nothing.
 */
export function contentWords(description: unknown): Set<string> {
  if (typeof description !== "string") return new Set();

  return new Set(
    description
      .toLowerCase()
      // Split on anything that is not a letter or an inner apostrophe. This
      // deliberately splits snake_case and camelCase stays joined — a
      // description writing `getUser` means one word, and `get_user` two.
      .split(/[^a-z']+/)
      .map((word) => word.replace(/^'+|'+$/g, ""))
      .filter((word) => word.length > 1 && !STOP.has(word)),
  );
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

  const unique = new Set(distinctive);
  const segments: Segment[] = [];

  // Same token shape `contentWords` splits on, so a word marked here is a word
  // that was counted there. Two different notions of "word" would put the
  // highlight on characters the percentage never looked at.
  for (const match of description.matchAll(/[a-zA-Z']+|[^a-zA-Z']+/g)) {
    const text = match[0];
    const word = text.toLowerCase().replace(/^'+|'+$/g, "");
    const shared =
      /[a-z]/.test(word) && word.length > 1 && !STOP.has(word) && !unique.has(word);

    const previous = segments[segments.length - 1];
    if (previous && previous.shared === shared) previous.text += text;
    else segments.push({ text, shared });
  }

  return segments;
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
  /** Top level, matching the study's denominator. */
  param_count: number;
  undescribed_params: string[];
  /** Every depth, for the list of things to actually go and fix. */
  undescribed_deep: string[];
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

export interface Report {
  tool_count: number;
  bucket: (typeof STUDY.buckets)[number];

  params: {
    /** Top level only — the denominator the corpus rate can be compared to. */
    total: number;
    undescribed: number;
    rate: number;
    with_enum: number;
    enum_rate: number;
    /** Every depth. Not comparable to the corpus; used for the fix list. */
    deep_total: number;
    deep_undescribed: number;
  };

  tools_undescribed: string[];
  duplicate_names: string[];

  distinctive: {
    median_share: number;
    zero: string[];
    zero_rate: number;
    under_ten_rate: number;
  };

  cost: {
    bytes: number;
    tokens: number;
    /** Where this sits against the corpus: below median, mid, or above p90. */
    band: "under-median" | "median-to-p90" | "over-p90";
  };

  prose_enums: ProseEnum[];
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
  const words_by_tool = named.map(({ tool }) => contentWords(tool.description));

  for (const words of words_by_tool) {
    for (const word of words) word_tools.set(word, (word_tools.get(word) ?? 0) + 1);
  }

  const deep_by_tool = named.map(({ tool }) => deepParams(tool));

  const per_tool: ToolReport[] = named.map(({ tool, name }, i) => {
    const words = words_by_tool[i];
    const distinctive = [...words].filter((word) => word_tools.get(word) === 1);

    const properties = propertiesOf(tool);
    const undescribed_params = Object.entries(properties)
      .filter(([, schema]) => {
        const description = (schema as { description?: unknown })?.description;
        return typeof description !== "string" || description.trim() === "";
      })
      .map(([param]) => param);

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
      param_count: Object.keys(properties).length,
      undescribed_params,
      undescribed_deep: deep_by_tool[i].filter((p) => !p.described).map((p) => p.path),
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
  let with_enum = 0;
  const prose_enums: ProseEnum[] = [];

  for (const { tool, name } of named) {
    for (const [param, raw] of Object.entries(propertiesOf(tool))) {
      total_params++;
      const schema = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

      const description = schema.description;
      if (typeof description !== "string" || description.trim() === "") undescribed_params++;
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

  const shares = per_tool.map((report) => report.distinctive_share);
  const zero = per_tool.filter((report) => report.distinctive_share === 0);

  return {
    tool_count: tools.length,
    bucket: bucketFor(tools.length),
    params: {
      total: total_params,
      undescribed: undescribed_params,
      rate: total_params === 0 ? 0 : undescribed_params / total_params,
      with_enum,
      enum_rate: total_params === 0 ? 0 : with_enum / total_params,
      deep_total: deep_by_tool.reduce((sum, list) => sum + list.length, 0),
      deep_undescribed: deep_by_tool.reduce(
        (sum, list) => sum + list.filter((param) => !param.described).length,
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
    per_tool,
  };
}
