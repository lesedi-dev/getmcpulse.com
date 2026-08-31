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
          "The shape of a range — by the hour when you ask for a single day, drawn flat at zero when nothing happened, never left blank.",
      },
      {
        name: "Which client",
        detail:
          "Claude Desktop, Cursor, or something you did not expect — with its own outcomes, latency and first-call rate, not just a share of the total.",
      },
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

/**
 * The plans, mirroring `services/plans.ts` in the API.
 *
 * A copy, and knowingly so. The API is the authority — the dashboard renders
 * the catalogue it sends, and nothing here is ever read by anything that
 * charges anybody. But this site is a static build with no session and no
 * account, so it cannot fetch a catalogue that only answers an authenticated
 * request. Restated rather than fetched, in one file, with the source named.
 *
 * `highlights` is the plan card's own list, in the same order the dashboard
 * shows it, so somebody comparing this page against the one behind the login
 * reads the same six lines.
 */
export const PLANS = [
  {
    id: "free",
    name: "Free",
    tagline: "See whether your server is working.",
    price: { month: 0, year: 0 },
    highlights: [
      "7 days of history",
      "10,000 calls a month",
      "1 MCP",
      "1 person",
      "All 16 metrics",
      "API and MCP access",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For a server people depend on.",
    price: { month: 49, year: 490 },
    highlights: [
      "Every date range",
      "1M calls a month",
      "Unlimited MCPs",
      "Unlimited team",
      "Alerts and the weekly digest",
      "90 days of individual calls",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "For a lot of traffic and a long memory.",
    price: { month: 100, year: 1_000 },
    highlights: [
      "Everything in Pro",
      "10M calls a month",
      "365 days of individual calls",
      "Priority support",
    ],
  },
] as const;

/**
 * The questions a price list creates, answered on the same page.
 *
 * Each of these is a real decision recorded in the product rather than a
 * reassurance: what a cap does when you hit it, what a downgrade destroys, and
 * who the seller actually is.
 */
export const PRICING_NOTES = [
  {
    q: "What happens at the cap?",
    a: "Recording stops, and the app says so — a banner on the overview, the meter red on the billing page, the chart flat from the moment it stopped. Your server carries on serving; the SDK treats a refused batch the way it treats a network failure and drops it, so a cap costs you data and never a tool call. A cap that is not a cap is a line nobody can plan around.",
  },
  {
    q: "Does downgrading delete anything?",
    a: "History is hidden, not deleted. The counters are one row per hour per tool per client and cost almost nothing to keep, so a plan decides how far back the date picker reaches rather than when a clock starts — upgrade later and the months you could not see are already there. The one thing genuinely deleted is the individual call log, which is a row per call: 7 days on Free, 90 on Pro, 365 on Scale.",
  },
  {
    q: "Why is a year ten months?",
    a: "Because the card fee is the part that punishes a small plan. Our merchant of record charges a percentage plus a flat fifty cents, and a year is one of those rather than twelve. Paying yearly costs us less to collect, so it costs you less to pay.",
  },
  {
    q: "Who takes the payment?",
    a: "Polar, as merchant of record. They are the seller, so VAT, GST and sales tax in every country are handled by somebody who does that for a living. Cards, invoices and cancellation all live in their portal — MCPulse never holds a card number.",
  },
] as const;
