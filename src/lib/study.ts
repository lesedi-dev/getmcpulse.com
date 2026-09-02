/**
 * The corpus, as numbers.
 *
 * Every figure here is from "We read the schemas of 4,749 public MCP servers"
 * — `src/content/blog/reading-5000-mcp-schemas.md` — and the checker scores
 * against them. They are stated once, here, because a benchmark that disagrees
 * with the post it came from is worse than no benchmark: the post is the thing
 * a sceptical reader checks, and the checker is the thing they act on.
 *
 * If the follow-up study moves a number, it moves in this file and the page
 * follows. Nothing in `check.astro` restates a corpus figure.
 */

export const STUDY = {
  post: "/blog/reading-5000-mcp-schemas",
  repo: "https://github.com/getmcpulse/mcp-schema-study",

  servers: 4749,
  tools: 82549,
  parameters: 257287,

  /** 55,383 of 257,287 parameters ship with no `description`. */
  undescribed_parameter_rate: 0.215,
  /** Parameters with no description appear on a third of servers. */
  undescribed_on_servers: 0.337,

  /** Only 0.4% of *tools* have no description — the contrast is the finding. */
  undescribed_tool_rate: 0.004,

  /** The median tool's description is 26% distinctive. */
  median_distinctive_share: 0.26,
  /** Under 10% distinctive. */
  low_distinctive_rate: 0.27,
  /** Not one content word unique to the tool. */
  zero_distinctive_rate: 0.177,
  /** Servers with at least one zero-distinctive tool. */
  zero_distinctive_on_servers: 0.228,

  /** 7.9% of parameters carry an `enum`. */
  enum_rate: 0.079,
  /** Closed set written in prose, left as an open string: 857 parameters. */
  prose_enum_parameters: 857,
  prose_enum_on_servers: 0.044,

  /** Duplicate tool names within one server. Effectively nobody does this. */
  duplicate_name_rate: 0.002,

  /**
   * Schema size. Bytes are measured; tokens are bytes ÷ 4, which is what the
   * post reports and roughly what a BPE tokeniser does to dense JSON.
   */
  median_bytes: 5005,
  median_tokens: 1251,
  p90_bytes: 31968,
  p90_tokens: 7992,
  max_bytes: 1145575,
  max_tokens: 286394,

  median_tools_per_server: 7,
  mean_tools_per_server: 17.4,

  /**
   * Collision by server size — the sharpest result in the study, rising by a
   * factor of sixty across the range. `zero` is the share of tools on servers
   * that size with no distinguishing content word.
   *
   * `min`/`max` are tool counts, inclusive. The last bucket is open-ended.
   */
  buckets: [
    { label: "1–3 tools", min: 1, max: 3, servers: 1193, undescribed: 0.152, zero: 0.005 },
    { label: "4–7 tools", min: 4, max: 7, servers: 1257, undescribed: 0.224, zero: 0.016 },
    { label: "8–15 tools", min: 8, max: 15, servers: 1013, undescribed: 0.219, zero: 0.044 },
    { label: "16–30 tools", min: 16, max: 30, servers: 738, undescribed: 0.248, zero: 0.076 },
    { label: "31–60 tools", min: 31, max: 60, servers: 350, undescribed: 0.214, zero: 0.166 },
    { label: "61+ tools", min: 61, max: Infinity, servers: 198, undescribed: 0.201, zero: 0.324 },
  ],
} as const;

/** The size bucket a tool count falls in, for a like-for-like comparison. */
export function bucketFor(tool_count: number) {
  return (
    STUDY.buckets.find((b) => tool_count >= b.min && tool_count <= b.max) ?? STUDY.buckets[0]
  );
}
