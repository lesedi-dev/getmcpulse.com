/**
 * The product's own vocabulary, in one file.
 *
 * The home page summarises these and the detail pages expand them. Held here
 * rather than in either, because the sixteen metrics living in two files is
 * the sort of duplication that is correct on the day it is written and wrong
 * three edits later — and the one place a reader would notice is a marketing
 * site claiming a different set of numbers on two of its own pages.
 */

/** Every call ends as exactly one of these. */
export const OUTCOMES = [
  { name: "ok", tone: "text-ok", detail: "Ran and returned a result." },
  {
    name: "bad_args",
    tone: "text-warn",
    detail: "Arguments failed validation — your handler never ran.",
  },
  { name: "tool_error", tone: "text-warn", detail: "Ran and returned isError: true." },
  { name: "crashed", tone: "text-bad", detail: "Threw." },
] as const;

export const PILLARS = [
  {
    kind: "inside",
    title: "Inside your server, not in front of it",
    body: "An npm package you install, not a proxy. Directory-listed servers cannot change their URL and OAuth breaks the moment traffic is redirected — so the SDK sits beside your traffic instead of in it. If we are down, your server keeps serving.",
  },
  {
    kind: "hash",
    title: "Never your arguments, never your results",
    body: "Sizes and hashes only. args_hash is twelve hex characters of a SHA-256 over the arguments with keys sorted: enough to tell whether two calls were the same, and not enough for anything else. There is no option to turn this off, because a guarantee you can switch off is not one.",
  },
  {
    kind: "wrap",
    title: "Two lines, then it is measuring",
    body: "One import, one wrap, after your tools are registered. watch() hands back the same server, so nothing downstream changes. No runtime dependencies at all — it will not drag anything into your tree.",
  },
] as const;

/**
 * The sixteen, grouped by where each one comes from.
 *
 * Every entry carries what it tells you rather than only its name — a list of
 * sixteen bare labels is a specification, and the question a reader actually
 * has is which of these would change what they do on Monday.
 */
export const METRICS = [
  {
    group: "Live on ingest",
    note: "Counted as each payload lands.",
    dot: "bg-cyan",
    items: [
      { name: "Calls per tool", detail: "Which of your tools the model actually reaches." },
      {
        name: "Calls per day",
        detail:
          "The shape of a range — drawn flat at zero when nothing happened, never left blank.",
      },
      { name: "Which client", detail: "Claude Desktop, Cursor, or something you did not expect." },
      { name: "Crashes", detail: "Your handler threw. A bug list, sorted by tool." },
      {
        name: "Tool errors",
        detail: "You returned isError deliberately. Healthy in small doses.",
      },
      {
        name: "Bad arguments",
        detail: "Validation rejected the call. Usually your schema, not the model.",
      },
      {
        name: "Empty answers",
        detail: "Succeeded and returned nothing usable. The failure nobody reports.",
      },
      { name: "Speed", detail: "Four buckets, because percentiles cannot be summed across days." },
      { name: "Result size", detail: "Bytes per answer, which is what context actually costs." },
      {
        name: "Sessions",
        detail: "Counted from their own rows, so one crossing midnight counts once.",
      },
      { name: "Cost per session", detail: "What a single conversation with your server spends." },
    ],
  },
  {
    group: "Nightly pass",
    note: "02:00 UTC. Labelled as of yesterday, because they are.",
    dot: "bg-warn",
    items: [
      { name: "Retries", detail: "Same tool, inside 30 seconds, with different arguments." },
      { name: "First-call success", detail: "Asked once, got something usable, moved on." },
      { name: "Tool pairs", detail: "Which tools get called one after another." },
    ],
  },
  {
    group: "From the startup payload",
    note: "Sent once, when your server boots.",
    dot: "bg-ok",
    items: [
      {
        name: "Schema size",
        detail: "What each tool costs in context before anyone asks a question.",
      },
      { name: "Dead tools", detail: "Registered, described, and never once called." },
    ],
  },
] as const;

export const INSIGHTS = [
  {
    tone: "bad",
    tool: "search_orders",
    text: "Agents retried it 2.4 times on average before getting a usable answer.",
  },
  {
    tone: "warn",
    tool: "list_customers",
    text: "Returns ~14k tokens per call, roughly $0.04 of context every time it runs.",
  },
  { tone: "warn", tool: "get_invoice", text: "312 calls returned empty with no error at all." },
  {
    tone: "bad",
    tool: "export_report",
    text: "Has never been called, but costs 480 tokens of schema every session.",
  },
] as const;

/** The rules in `services/insights.ts`, which are the actual product. */
export const INSIGHT_RULES = [
  {
    rule: "Low first-call",
    when: "first_call_ok / calls < 0.7",
    says: "Agents retried X N times on average.",
  },
  {
    rule: "Heavy payload",
    when: "avg response_bytes > 10,000",
    says: "X returns ~Nk tokens per call, roughly $N of context each time.",
  },
  {
    rule: "Silent empties",
    when: "empties / calls > 0.05",
    says: "N calls to X returned empty with no error.",
  },
  {
    rule: "Dead tool",
    when: "registered, no calls in range",
    says: "X has never been called but costs N tokens of schema every session.",
  },
  {
    rule: "Slow tool",
    when: "ms_over_2000 / calls > 0.1",
    says: "N% of X calls take over 2 seconds.",
  },
] as const;
