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
 *
 * ── The figures below are the corrected ones ──────────────────────────────
 * Every word-counting metric in the study did exact string matching, so
 * `screens` and `screening` were two different words and two tools sharing
 * their most meaningful term both scored it as distinctive. The corpus was
 * re-run with a Porter stemmer — see `stem.ts`, and `scripts/stem.py` in the
 * study repo, which are held to the same answers by `tests/stem.test.ts`.
 *
 * The direction was predictable and the size was not. Stemming can only merge
 * words, never split them, so distinctiveness could only fall and collision
 * could only rise; it moved the headline collision rate by more than a quarter
 * of itself. The originally published values are kept beside each corrected one
 * so a reader who has seen the post can find the number they remember.
 *
 * The parameter-description rates did not move at all, which is the check that
 * this was a word-counting bug and not something broader: those measure whether
 * a field is present, and no stemmer can change that.
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

  /**
   * ── Measured after the post, on the same corpus ──────────────────────────
   *
   * The rate above counts *absence* — no `description`, or an empty one. It is
   * exact, and it is a floor, because the commoner failure ships a populated
   * field that only restates the parameter's own name: `query` described as
   * "The query", `maxResults` as "Maximum results". Those pass every linter
   * ever written, and they passed the study's own definition.
   *
   * 8,195 parameters, on 15.9% of servers, taking the real rate to 24.7%. The
   * new figure is a floor too: the filler list behind it is short on purpose,
   * so one word of real information is enough to count as a description.
   */
  restated_parameter_rate: 0.032,
  restated_on_servers: 0.159,
  /** Absent plus empty of information — what a model has to guess at. 63,578. */
  substantive_undescribed_rate: 0.247,

  /** Only 0.4% of *tools* have no description — the contrast is the finding. */
  undescribed_tool_rate: 0.004,

  /** The median tool's description is 20% distinctive. Published as 26%. */
  median_distinctive_share: 0.2,
  /** Under 10% distinctive. Published as 27%. */
  low_distinctive_rate: 0.341,
  /**
   * Not one content word unique to the tool. **Published as 17.7%.**
   *
   * The single largest correction stemming made, and the headline figure of the
   * post: better than one tool in five has nothing in its description that a
   * sibling has not also written.
   */
  zero_distinctive_rate: 0.229,
  /** Servers with at least one zero-distinctive tool. Published as 22.8%. */
  zero_distinctive_on_servers: 0.278,

  /**
   * ── Input overlap. Measured after the post ───────────────────────────────
   *
   * Distinctiveness above asks whether two descriptions look alike. This asks
   * whether two tools could both be *correct* for one request, and that is the
   * question that predicts a wrong pick.
   *
   * The evidence is a real ten-tool job-applications server whose author
   * confirmed three of its tools are ambiguous in practice — and all three
   * score 50–60% distinctive, healthy by the figures above. They are ambiguous
   * because they all act on a resume and a job posting, not because they are
   * worded alike.
   *
   * An earlier attempt measured distinctiveness over the *output* half of each
   * description instead. It was tested against that same server and failed:
   * all ten verbs were lexically distinct, so it scored every tool at 100%,
   * including the three already known to be the problem. Nothing of it
   * survives, and the figures it produced are not published anywhere.
   */
  /**
   * 12,169 of 564,810 pairs, on 25.1% of servers — after the output gate.
   *
   * 15,404 pairs share an object. 3,235 of those state outputs a reader could
   * tell apart and are *not* flagged: two tools taking the same argument and
   * returning different shapes is good design, not a collision. So the gate
   * removes 21% of the raw signal as false positives, which is the difference
   * between a list an author reads and a list an author closes.
   */
  input_overlap_pair_rate: 0.022,
  input_overlap_on_servers: 0.251,
  /** Shares an object, states different outputs. Informational, not a problem. */
  output_near_miss_on_servers: 0.102,
  /** How much of the raw input-overlap signal the output gate removes. */
  output_gate_removes: 0.21,
  /**
   * The dangerous combination: both descriptions above the corpus median and
   * the pair still sharing its object, so the distinctive figure has already
   * called it healthy and nothing else would mention it. 919 pairs.
   *
   * This is the one figure stemming moved *down*, and it moved down for a good
   * reason rather than a flattering one: the bar for "looks healthy" is the
   * corpus median distinctive share, and that median fell from 26% to 20%. The
   * pairs that dropped out did not stop sharing their object — they stopped
   * being pairs the old metric would have called fine, because the old metric
   * now flags them outright.
   */
  input_overlap_looks_healthy_on_servers: 0.08,

  /**
   * ── The same ratio, over tool names. Measured after the post ─────────────
   *
   * Authors report that when descriptions stop discriminating, a model falls
   * back to pattern-matching on the name. If that is what happens then the
   * name is the backstop, and a server whose descriptions collide and whose
   * names are clear is in a different position from one where both have gone.
   * Measured with any server-wide prefix stripped, since that discriminates
   * nothing within the server. 19.3% of servers have one.
   *
   * **The theory does not survive the corpus, and that is the finding.** If
   * names were the backstop, a collided description would usually sit beside a
   * clear name. It does not: names collide *harder* than descriptions — 42.0%
   * of tool names carry no token a sibling does not, against 17.7% of
   * descriptions — and the quadrant where the name rescues a collided
   * description is the rarest of the four.
   */
  median_name_distinctive_share: 0.333,
  /** Published as 42.0%. Names moved least: they are short and rarely inflected. */
  zero_name_distinctive_rate: 0.451,
  name_prefix_on_servers: 0.193,

  /**
   * The cross of the two, and the reason to measure names at all.
   *
   * `both_low` is the one nobody had counted: under 10% on the description
   * *and* under 10% on the name. 17,005 tools — one in five — with nothing
   * left to choose on at either end.
   */
  quadrants: {
    /** Both clear. Still the majority, and the good outcome. Published as 51.9%. */
    both_clear: 0.47,
    /** Description collided, name clear — the backstop actually working. Published as 6.1%. */
    name_carries: 0.08,
    /** Name collided, description clear. Fine; the description is the signal. Published as 21.0%. */
    desc_carries: 0.19,
    /** Neither. Nothing to discriminate on at all. Published as 20.9%. */
    both_low: 0.261,
  },
  /**
   * 21,148 tools, up from the 17,005 published — better than one in four.
   *
   * `both_low` grew fastest of the four quadrants, which is what makes the
   * correction worth publishing rather than quietly applying: the finding
   * nobody had measured got substantially bigger, not smaller.
   */
  both_low_count: 21215,

  /**
   * ── Word frequency reads two ways, and they are never averaged ───────────
   *
   * A noun on *all* of a server's tools is the domain — the server's name,
   * repeated — and counting it against every tool penalises a focused server
   * for being focused. A noun on a *subset* is a cluster, and that subset is
   * the candidate collision list. The count makes the distinction; there is no
   * threshold to pick.
   *
   * The complaint that drove this turns out to be right in principle and small
   * in practice: stripping the domain moves the low-distinctive rate from 34.1%
   * to 33.6% and does not move the zero rate at all. A word every tool uses was
   * never distinctive to any of them, so removing it mostly cancels out.
   *
   * **The gap is where the finding is.** 18.4% of servers read clean once the
   * domain is out and still have two tools that could both be right for one
   * sentence — a focused server whose tools all act on one object and never say
   * what they return. Averaging the two readings hides it completely.
   */
  domain_noun_on_servers: 0.351,
  domain_stripped_low_rate: 0.336,
  reading_gap_on_servers: 0.184,

  /**
   * ── Parameters, at every depth rather than only the top ──────────────────
   *
   * The published 21.5% counts top-level `inputSchema.properties`, so a tool
   * whose top-level parameters are all described and whose nested object is
   * entirely bare scores clean. An undescribed field at depth four is exactly
   * as invisible to a model as one at depth one.
   *
   * Walking the whole schema finds 324,382 parameters rather than 257,287, and
   * the rate rises from 21.5% to 27.7% absent, 24.7% to 30.7% substantive.
   * 1,227 tools are spotless on top and bare below.
   *
   * Reported beside the published figure, never merged into it: the denominator
   * is different, so dividing one by the other would read as a worse score for
   * having a nested schema, which is not a finding about the schema.
   */
  deep_parameters: 324382,
  deep_undescribed_rate: 0.277,
  deep_substantive_rate: 0.307,
  deep_clean_on_top_bare_below: 1227,

  /**
   * ── Shape: how much there is to fill in, against how much is a choice ────
   *
   * Depth is a max over the tree, so one field at depth 5 and forty fields at
   * depth 5 score the same. Leaf count is the size of the job; decision depth is
   * how much of it is a branch the model has to choose at.
   *
   * The result is a negative one and worth saying plainly: public MCP schemas
   * are shallow and narrow. The median tool has **two** leaves at depth 1, only
   * 6.1% have any `anyOf`/`oneOf` at all, and just **38 tools in the whole
   * corpus** have a branch whose alternatives overlap enough to be a real
   * choice. Branch ambiguity is a genuine failure mode that public servers
   * almost never commit.
   */
  median_leaves: 2,
  p90_leaves: 8,
  max_leaves: 1950,
  median_structural_depth: 1,
  tools_with_a_branch: 0.061,
  tools_with_an_ambiguous_branch: 38,

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
   * factor of thirty-four across the range. `zero` is the share of tools on
   * servers that size with no distinguishing content word.
   *
   * Corrected for stemming. The published table ran 0.5% → 32.4%; it now runs
   * 1.2% → 40.8%. The shape is unchanged and steeper: the correction grows with
   * server size, because the more siblings a tool has the more chances one of
   * them has to have written an inflection of its words.
   *
   * `undescribed` did not move, and could not: it counts a missing field.
   *
   * `min`/`max` are tool counts, inclusive. The last bucket is open-ended.
   */
  buckets: [
    { label: "1–3 tools", min: 1, max: 3, servers: 1193, undescribed: 0.152, zero: 0.012 },
    { label: "4–7 tools", min: 4, max: 7, servers: 1257, undescribed: 0.224, zero: 0.023 },
    { label: "8–15 tools", min: 8, max: 15, servers: 1013, undescribed: 0.219, zero: 0.062 },
    { label: "16–30 tools", min: 16, max: 30, servers: 738, undescribed: 0.248, zero: 0.108 },
    { label: "31–60 tools", min: 31, max: 60, servers: 350, undescribed: 0.214, zero: 0.219 },
    { label: "61+ tools", min: 61, max: Infinity, servers: 198, undescribed: 0.201, zero: 0.408 },
  ],
} as const;

/** The size bucket a tool count falls in, for a like-for-like comparison. */
export function bucketFor(tool_count: number) {
  return (
    STUDY.buckets.find((b) => tool_count >= b.min && tool_count <= b.max) ?? STUDY.buckets[0]
  );
}
