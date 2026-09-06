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
    // "Directory-listed servers cannot change their URL and OAuth breaks the
    // moment traffic is redirected" was the hardest sentence on the site: a
    // subordinate clause, a term of art, and two failure modes, in one breath.
    // Split into the two consequences a reader actually cares about — my URL
    // stays, my login stays — with the proxy comparison left as the punchline.
    body: "An npm package you install, not a proxy. Your server keeps its own URL, so anything that already links to it still works and your OAuth still works. Nothing of ours sits in the request path. If we are down, your server keeps serving.",
  },
  {
    kind: "hash",
    title: "Never your arguments, never your results",
    body: "Sizes and fingerprints only. Your arguments become twelve characters of a one-way hash — enough to tell whether two calls were the same, and not enough for anything else. There is no option to turn this off, because a guarantee you can switch off is not one.",
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
      { name: "Calls per tool", detail: "Which of your tools agents actually reach." },
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
        detail: "Validation rejected the call. Usually your schema, not the agent.",
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
    // "~14k tokens" was reading the tool table's "14 kB" as a token count. 14 kB
    // of JSON is about 3.5k tokens, so the cost was roughly four times too high.
    // Stated in bytes here — that is what the SDK actually measures, and it is
    // the figure the table prints — with the token estimate marked as one.
    text: "Returns ~14 kB per call — about 3.5k tokens, roughly $0.01 of context every time it runs.",
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
      // "1 MCP" / "Unlimited MCPs" used the protocol's name as a countable noun
      // for the thing it is a protocol for. The heading directly above these
      // cards says "Free for one server", so the page named the same unit two
      // ways within a screen — and "1 MCP" is the one a reader has to translate.
      "1 server",
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
      "Unlimited servers",
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

/**
 * The languages a server can be written in, and whether we ship a package yet.
 *
 * A copy of `install_languages.ts` in the dashboard, for the same reason
 * `PLANS` is a copy of the API's catalogue: this is a static build with no
 * session, so it cannot fetch anything the product knows. Restated in one
 * place, with the source named.
 *
 * The list is the official MCP SDKs rather than every language that exists,
 * and it is in their tier order — tier 1 first, because that is where servers
 * actually get written and so the order somebody scans the grid in. **The tier
 * is never printed.** It is the MCP project's classification of its own SDKs;
 * on our page it would read as tiers of *our* support.
 *
 * All ten are implemented. Each carries the same modules — canonical, hashing,
 * outcome, buffer, transport — and each is checked against the same shared
 * `canonical.json` conformance fixture, which is what keeps ten separate
 * implementations agreeing on one wire format.
 *
 * ── Two shapes of integration, and the page must not blur them ────────────
 * The four SDKs whose host framework exposes a server object or middleware —
 * TypeScript, Python, Go, Java — wrap it and hand the same thing back. The
 * other six have no such seam, so they expose a `record()` that wraps the
 * handler body instead.
 *
 * That difference is real and a reader hits it in their first five minutes.
 * Writing "two lines in every language" would be the kind of small
 * over-claim this site has already been burned by, so `snippet` carries each
 * SDK's genuine API, copied from its own README rather than paraphrased.
 *
 * ── Keeping this honest ───────────────────────────────────────────────────
 * `install` is the command a reader will paste. It only belongs here once the
 * package resolves — a 404 from `pip install` costs more trust than a missing
 * language ever would. Set `status` to "available" and the page prints the
 * command; leave it "written" and the page shows the API without pretending
 * there is something to fetch.
 */
export type InstallLanguage = {
  id: string;
  label: string;
  /** Two or three letters for the card's tile — no borrowed brand marks. */
  short: string;
  /** The official MCP SDK the MCPulse package for this language pairs with. */
  sdk: string;
  /** The MCP project's own tier, used for the order and nothing else. */
  tier: 1 | 2 | 3;
  /**
   * `available` — published, and `install` resolves today.
   * `written`   — implementation complete, package not yet on a registry.
   */
  status: "available" | "written";
  /** The install command, exactly as a reader would paste it. */
  install: string;
  /** How it is wired in, from the SDK's own README. */
  snippet: string;
  /**
   * `wrap` — hands your server or middleware back instrumented.
   * `record` — wraps the handler body, for hosts with no seam to attach to.
   */
  shape: "wrap" | "record";
};

export const INSTALL_LANGUAGES: InstallLanguage[] = (
  [
    {
      id: "typescript",
      label: "TypeScript",
      short: "TS",
      sdk: "modelcontextprotocol/typescript-sdk",
      tier: 1,
      status: "available",
      shape: "wrap",
      install: "npm install @mcpulse/sdk",
      snippet: `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { watch } from "@mcpulse/sdk";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

// … your registerTool calls …

watch(server, { key: process.env.MCPULSE_KEY });`,
    },
    {
      id: "python",
      label: "Python",
      short: "PY",
      sdk: "modelcontextprotocol/python-sdk",
      tier: 1,
      status: "available",
      shape: "wrap",
      // The distribution is `mcpulse-sdk`; the import stays `mcpulse`. They
      // differ because `mcpulse` on PyPI belongs to an unrelated project and
      // PyPI has no scoping, so this mirrors the npm name instead.
      install: "pip install mcpulse-sdk",
      snippet: `from mcp.server.mcpserver import MCPServer
from mcpulse import watch

mcp = MCPServer("my-server")
watch(mcp, key="mp_live_…")`,
    },
    {
      id: "csharp",
      label: "C#",
      short: "C#",
      sdk: "modelcontextprotocol/csharp-sdk",
      tier: 1,
      status: "available",
      shape: "record",
      install: "dotnet add package MCPulse",
      snippet: `using MCPulse;

McPulse.Configure(new McPulseOptions { Key = "mp_live_…" });

// Around your tool handler:
return await McPulse.RecordAsync(
    toolName: request.Params.Name,
    arguments: request.Params.Arguments,
    clientName: server.ClientInfo?.Name,
    invoke: () => next(request, cancellationToken));`,
    },
    {
      id: "go",
      label: "Go",
      short: "GO",
      sdk: "modelcontextprotocol/go-sdk",
      tier: 1,
      status: "available",
      shape: "wrap",
      // Attaches through the SDK's public AddReceivingMiddleware — no reaching
      // into internals, which is the same guarantee the other wrappers make.
      install: "go get github.com/getmcpulse/mcpulse-go",
      snippet: `import (
    "github.com/modelcontextprotocol/go-sdk/mcp"
    mcpulse "github.com/getmcpulse/mcpulse-go"
)

server := mcp.NewServer(&mcp.Implementation{Name: "my-server"}, nil)
mcpulse.Watch(server, mcpulse.Options{Key: "mp_live_…"})`,
    },
    {
      id: "rust",
      label: "Rust",
      short: "RS",
      sdk: "modelcontextprotocol/rust-sdk",
      tier: 1,
      status: "available",
      shape: "record",
      install: 'cargo add mcpulse',
      snippet: `use mcpulse::{McPulse, Options};

let mcpulse = McPulse::new(Options::new("mp_live_…"));

// Around your tool handler:
let result = mcpulse.record("search", Some(&arguments), || {
    my_handler(&arguments)
});`,
    },
    {
      id: "java",
      label: "Java",
      short: "JV",
      sdk: "modelcontextprotocol/java-sdk",
      tier: 2,
      status: "available",
      shape: "wrap",
      // Java wraps the tool specs rather than the server, because the Java SDK
      // builds its server from them — a different seam, same result.
      install: `<dependency>
  <groupId>com.mcpulse</groupId>
  <artifactId>mcpulse</artifactId>
  <version>0.1.0</version>
</dependency>`,
      snippet: `import com.mcpulse.MCPulse;
import com.mcpulse.Options;

var specs = MCPulse.instrument(Options.key("mp_live_…"), searchSpec, fetchSpec);

McpSyncServer server = McpServer.sync(transport)
    .serverInfo("my-server", "1.0.0")
    .tools(specs)
    .build();`,
    },
    {
      id: "ruby",
      label: "Ruby",
      short: "RB",
      sdk: "modelcontextprotocol/ruby-sdk",
      tier: 2,
      status: "available",
      shape: "record",
      install: 'bundle add mcpulse',
      snippet: `require "mcpulse"

MCPulse.configure(key: "mp_live_…")

# Around your tool handler:
MCPulse.record("search", arguments, client_name: client) do
  my_handler.call(arguments)
end`,
    },
    {
      id: "swift",
      label: "Swift",
      short: "SW",
      sdk: "modelcontextprotocol/swift-sdk",
      tier: 3,
      status: "available",
      shape: "record",
      install: '.package(url: "https://github.com/getmcpulse/mcpulse-swift.git", from: "0.1.0")',
      snippet: `import MCPulse

let mcpulse = MCPulse(options: Options(key: "mp_live_…"))

// Around your tool handler:
let result = try await mcpulse.record("search", arguments: arguments, result: { $0 }) {
    try await handler(arguments)
}`,
    },
    {
      id: "php",
      label: "PHP",
      short: "PHP",
      sdk: "modelcontextprotocol/php-sdk",
      tier: 3,
      status: "available",
      shape: "record",
      install: "composer require mcpulse/mcpulse",
      snippet: `use MCPulse\\MCPulse;
use MCPulse\\Options;

MCPulse::configure(new Options('mp_live_…'));

// Around your tool handler:
$result = MCPulse::record('search', $arguments, fn () => $handler($arguments), $clientName);`,
    },
    {
      id: "kotlin",
      label: "Kotlin",
      short: "KT",
      sdk: "modelcontextprotocol/kotlin-sdk",
      tier: 3,
      status: "available",
      shape: "record",
      install: 'implementation("com.mcpulse:mcpulse:0.1.0")',
      snippet: `import com.mcpulse.MCPulse
import com.mcpulse.Options

MCPulse.configure(Options(key = "mp_live_…"))

// Around your tool handler:
val result = MCPulse.record("search", arguments, clientName) {
    handler(arguments)
}`,
    },
    // `tier` to `number` and quietly opt out of the union.
  ] satisfies InstallLanguage[]
).sort((a, b) => a.tier - b.tier);

/**
 * The questions asked before installing, rather than before paying.
 *
 * `PRICING_NOTES` answers the billing questions and stays on `/pricing`. These
 * are the ones that decide whether somebody installs at all, and every one of
 * them was already answered somewhere on this site — in a pillar, in a blog
 * post, in a sentence on the install page. Answered *somewhere* is not the same
 * as answerable: a reader deciding whether to put our package inside their
 * server is not going to read twenty-one essays to find out whether we can see
 * their arguments.
 *
 * Ordered by how much the answer can stop a sale. The first three are all
 * versions of "what does this do to my server", which is the real question
 * under all of them.
 *
 * `short` is the answer's first sentence, used where there is no room for the
 * whole thing. Written rather than sliced, because a truncated paragraph and a
 * summary are different pieces of writing.
 */
export const FAQS = [
  {
    q: "What happens to my server if MCPulse goes down?",
    short: "Nothing. Your traffic never routes through us.",
    a: "Nothing. The SDK runs inside your process and sends its own batches outward, so your tool calls never traverse anything of ours. A failed batch is dropped the way a network error is dropped. This is the whole reason it is a package and not a proxy: a proxy that is down is a server that is down.",
  },
  {
    q: "Can you see my tool arguments or my results?",
    short: "No, and there is no setting that would let us.",
    a: "No. One row leaves your process per call. It holds which tool ran, how long it took, how big the answer was, and a one-way fingerprint of the arguments. There is no field that could hold customer data — which is a stronger thing to be able to say than a promise about how the fields get used. The fingerprint is twelve characters of a SHA-256 with the keys sorted: enough to tell whether two calls were the same, not enough for anything else. There is no option to turn this off, because a guarantee you can switch off is not one.",
  },
  {
    q: "Will it slow my tools down?",
    short: "No. Recording is off the request path and never throws.",
    a: "Recording happens after your handler has returned and batches are sent on their own schedule, so a tool call never waits on us. The SDK has no runtime dependencies, so it drags nothing into your tree. And every path through it is wrapped: if the recording itself fails, it fails silently rather than turning a working tool call into an error. Instrumentation that can break the thing it measures is worse than no instrumentation.",
  },
  {
    q: "Do I have to change my server's URL or its auth?",
    short: "No. Nothing about how your server is reached changes.",
    a: "No. You add a package and wrap the server object you already built; `watch()` hands the same server back, so nothing downstream sees a difference. Your URL, your OAuth, your deployment and your dependencies are untouched. That is the point of not being a proxy: a proxy would move your traffic to a new address, which breaks your OAuth and breaks every directory that already lists you.",
  },
  {
    q: "Which languages can I use it from?",
    short: "All ten official MCP SDKs have an MCPulse package.",
    a: "All ten: TypeScript, Python, C#, Go, Rust, Java, Ruby, Swift, PHP and Kotlin. Every one is checked against the same wire-format fixture, so ten separate implementations cannot drift into sending ten slightly different payloads. Where the host SDK gives us a server object or middleware — TypeScript, Python, Go, Java — you wrap it and get the same thing back. The rest expose a `record()` that wraps your handler body instead, because there is no seam to attach to. And if your language is not on the list at all, ingest is one authenticated POST with two payload shapes; the package only exists to save you writing it.",
  },
  {
    q: "How long before I see anything?",
    short: "The first payload lands within a minute of a restart.",
    a: "Create a server in the dashboard, paste the key, restart. The startup payload — your tool list and the byte size of each schema — arrives immediately, so dead tools and schema cost are visible before a single call happens. Per-call numbers appear as traffic does. The three nightly metrics, including first-call success, are labelled as of yesterday because they need a night's worth of calls in order.",
  },
  {
    q: "Can I get at my own data?",
    short: "Yes — a REST API and an MCP connector, on every plan including Free.",
    a: "Every plan reaches its own data through the API and through an MCP connector, so your agent can ask about your server the same way you would. There is also a documented agent skill that tells a model which figures are already computed server-side and must not be re-derived. Analytics you can only read inside somebody else's dashboard is a hostage, not a product.",
  },
  {
    q: "Will this pass a security review?",
    short: "It is built to. There is a written answer to each of the five usual questions.",
    a: "The five questions a review actually asks — what leaves the process, what is retained, who is the subprocessor, can it be turned off, and what happens if you are breached — each have a written answer rather than a sales response. The short version: sizes and hashes only, no field that could hold customer data, and no dependency for us to be compromised through.",
  },
] as const;
