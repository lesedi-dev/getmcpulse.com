/**
 * The schema checker's analysis, as pure functions.
 *
 * This is the study's method, reimplemented to run on one server instead of
 * 4,951 — same definitions, same thresholds, so a score here is comparable to
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

/* ── Report ───────────────────────────────────────────────────────────────── */

export interface ToolReport {
  name: string;
  described: boolean;
  /** Share of this tool's content words that no sibling uses. 1 when alone. */
  distinctive_share: number;
  distinctive_words: string[];
  word_count: number;
  param_count: number;
  undescribed_params: string[];
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
    total: number;
    undescribed: number;
    rate: number;
    with_enum: number;
    enum_rate: number;
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
  const schema = tool.inputSchema ?? tool.input_schema;
  const properties = schema?.properties;
  return properties && typeof properties === "object" ? (properties as Record<string, unknown>) : {};
}

/**
 * Top level only, matching the study.
 *
 * 270,487 parameters over 87,146 tools is 3.1 each, which is a top-level count
 * — nested object properties are not in the denominator. Counting them here
 * would score a deeply nested schema against a benchmark that never included
 * one. The page says this out loud rather than leaving it as a footgun.
 */
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
      described: typeof tool.description === "string" && tool.description.trim() !== "",
      // A tool alone on a server has nothing to collide with, so its words are
      // all distinctive by definition. Reported as 1 rather than excluded,
      // which is how the 1–3 bucket gets a 0.5% rate rather than no rate.
      distinctive_share: words.size === 0 ? 0 : distinctive.length / words.size,
      distinctive_words: distinctive,
      word_count: words.size,
      param_count: Object.keys(properties).length,
      undescribed_params,
    };
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
  const bytes = new TextEncoder().encode(JSON.stringify(tools)).length;
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
