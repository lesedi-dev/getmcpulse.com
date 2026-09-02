/**
 * The highlighter, and the one invariant that matters.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * `highlight()` is a hand-rolled tokeniser, which means it has the failure mode
 * every hand-rolled tokeniser has: it drops characters. A real highlighter
 * losing a brace is a colouring bug; this one losing a brace changes the code a
 * reader is about to paste into their server.
 *
 * So the first and most important assertion here is not about colour at all —
 * it is that concatenating every token reproduces the input exactly, for every
 * snippet the site actually ships. Colour is checked after that, and only for
 * the handful of constructs that carry meaning: the `$` prompt that must not be
 * copied, the env-var name, keywords, strings.
 *
 * ── Why the real snippets ─────────────────────────────────────────────────
 * The cases below import `WRAP_SNIPPET` from `site.ts` rather than restating
 * it. A test that highlights its own private copy of a snippet passes forever
 * while the shipped one breaks.
 */

import { highlight, detectLang, type Token } from "../src/lib/highlight";
import { WRAP_SNIPPET, INSTALL_COMMAND } from "../src/lib/site";

let failures = 0;

function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failures++;
    console.log(`FAIL  ${label}\n        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
  } else {
    console.log(`pass  ${label}`);
  }
}

const text = (tokens: Token[]) => tokens.map((t) => t.text).join("");
const classOf = (tokens: Token[], needle: string) =>
  tokens.find((t) => t.text === needle)?.cls ?? "(not tokenised)";

/* ── 1. Lossless: every snippet the site ships ──────────────────────────── */

const HTTP_SNIPPET = `function createServer() {
  const server = new McpServer({ name: "my-server", version: "1.0.0" });

  // … your registerTool calls …

  return watch(server, { key: process.env.MCPULSE_KEY });
}`;

const SHIPPED: Record<string, string> = {
  WRAP_SNIPPET,
  HTTP_SNIPPET,
  "install command": `$ ${INSTALL_COMMAND}`,
  "package managers": ["npm install", "pnpm add", "yarn add", "bun add"]
    .map((m) => `$ ${m} @mcpulse/sdk`)
    .join("\n"),
  "env line": "MCPULSE_KEY=mp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
};

for (const [name, code] of Object.entries(SHIPPED)) {
  eq(`round-trips exactly: ${name}`, text(highlight(code)), code);
}

/* ── 2. Lossless: the awkward shapes ───────────────────────────────────── */

const EDGE: Record<string, string> = {
  empty: "",
  "single newline": "\n",
  "blank line between": "a\n\nb",
  "trailing newline": "const a = 1;\n",
  "leading whitespace": "    const a = 1;",
  "tabs": "\tconst a = 1;",
  "unicode in a comment": "// … your registerTool calls …",
  "unicode in a string": 'const s = "café — ok";',
  "emoji": 'const s = "✓ done";',
  "unterminated string": 'const s = "oops',
  "escaped quote": 'const s = "a \\" b";',
  "template literal": "const s = `hello ${name}`;",
  "regex-looking": "const r = a / b / c;",
  "no trailing newline in JSON-ish": '{ "a": 1 }',
  "windows line ending": "const a = 1;\r\nconst b = 2;",
  "only whitespace": "   ",
  "dollar not a prompt": "const $x = 1;",
  "hash comment in js": "# not javascript",
};

for (const [name, code] of Object.entries(EDGE)) {
  eq(`round-trips exactly: ${name}`, text(highlight(code)), code);
}

/* ── 3. Language detection ─────────────────────────────────────────────── */

eq("detects sh from prompts", detectLang("$ npm i\n$ npm test"), "sh");
eq("detects env from KEY=", detectLang("MCPULSE_KEY=abc"), "env");
eq("detects env with a comment", detectLang("# .env\nMCPULSE_KEY=abc"), "env");
eq("falls back to js", detectLang("const a = 1;"), "js");
eq("empty input is js", detectLang(""), "js");
eq("a mixed block is js, not sh", detectLang("$ npm i\nconst a = 1;"), "js");

/* ── 4. The colours that carry meaning ────────────────────────────────── */

{
  // The prompt must be its own token: it is the character a reader must not
  // copy, and CopyBlock strips it separately.
  const sh = highlight("$ npm install @mcpulse/sdk");
  eq("the $ prompt is its own token", classOf(sh, "$"), "t-prompt");
  eq("the command after it is not the prompt", classOf(sh, "npm install @mcpulse/sdk"), "t-text");
}

{
  const env = highlight("MCPULSE_KEY=mp_live_4f8a2c19bd7e");
  eq("env-var name gets brand cyan", classOf(env, "MCPULSE_KEY"), "t-key");
  eq("the = is punctuation", classOf(env, "="), "t-punc");
  eq("the value reads as a string", classOf(env, "mp_live_4f8a2c19bd7e"), "t-str");
}

{
  const js = highlight(WRAP_SNIPPET);
  eq("import is a keyword", classOf(js, "import"), "t-kw");
  eq("from is a keyword", classOf(js, "from"), "t-kw");
  eq("const is a keyword", classOf(js, "const"), "t-kw");
  eq("new is a keyword", classOf(js, "new"), "t-kw");
  eq("the module path is a string", classOf(js, '"@mcpulse/sdk"'), "t-str");
  // `watch` appears twice: in the import, where it is a plain binding, and as
  // the call. Only the second is a call, and asserting the first was the bug
  // in this test rather than in the highlighter.
  const watches = js.filter((t) => t.text === "watch").map((t) => t.cls);
  eq("watch: imported binding then call", watches, ["t-text", "t-fn"]);
  eq("an object key is a key", classOf(js, "key"), "t-prop");
  eq("a dotted path stays one token", classOf(js, "process.env.MCPULSE_KEY"), "t-text");
  eq("a // comment is dim", classOf(js, "// … your registerTool calls …"), "t-dim");
}

{
  // A `#` line inside a JS block used to be shredded one character at a time by
  // the punctuation arm, which is how it was found.
  const hash = highlight("# .env", "js");
  eq("a # line in a js block is one dim token", hash.length, 1);
  eq("  …and it is dim", hash[0]!.cls, "t-dim");
}

{
  const num = highlight("const port = 8080;");
  eq("numbers are numbers", classOf(num, "8080"), "t-num");
}

/* ── 5. No token may carry markup ─────────────────────────────────────── */

{
  // The caller renders text nodes, so this is belt-and-braces — but if the
  // contract ever changes, this is the assertion that should fail first.
  const evil = highlight('const s = "</script><img onerror=alert(1)>";');
  eq("round-trips a script tag exactly", text(evil), 'const s = "</script><img onerror=alert(1)>";');
  eq(
    "every class is a plain .t-* name",
    evil.every((t) => t.cls === "" || /^t-[a-z]+$/.test(t.cls)),
    true,
  );
}

/* ── 6. Every class the highlighter emits must exist in the stylesheet ── */

{
  const { readFileSync } = await import("node:fs");
  const css = readFileSync("src/styles/global.css", "utf8");
  const emitted = new Set<string>();
  for (const code of [...Object.values(SHIPPED), ...Object.values(EDGE), "const port = 8080;"])
    for (const t of highlight(code)) if (t.cls) emitted.add(t.cls);

  const missing = [...emitted].filter((c) => !css.includes(`.${c} {`) && !css.includes(`.${c}{`));
  eq(`all ${emitted.size} emitted classes are defined in global.css`, missing, []);
}

/* ── 7. JSON — the ingest payload on /how-it-works ────────────────────── */

const PAYLOAD = `{
  "v": 1,
  "type": "call",
  "session_id": "s_7f2a91",
  "tool_name": "search_orders",
  "client_name": "claude-desktop",
  "started_at": "2026-08-09T14:22:31Z",
  "duration_ms": 240,
  "outcome": "ok",
  "response_bytes": 1420,
  "is_empty": false,
  "args_hash": "9c1b4e2f0a11"
}`;

eq("detects json", detectLang(PAYLOAD), "json");
eq("round-trips exactly: the ingest payload", text(highlight(PAYLOAD)), PAYLOAD);

{
  const j = highlight(PAYLOAD);
  // The whole point of a JSON arm: a key and a string value must not be the
  // same colour. Under the JS scanner both matched `string` and both came out
  // blue, which is most of what reading a payload is — telling them apart.
  eq("a key is a key", classOf(j, '"tool_name"'), "t-prop");
  eq("a string value is a string", classOf(j, '"search_orders"'), "t-str");
  eq("keys and values differ", classOf(j, '"tool_name"') !== classOf(j, '"search_orders"'), true);
  eq("a number is a number", classOf(j, "240"), "t-num");
  eq("false is a literal", classOf(j, "false"), "t-kw");
  eq("braces are punctuation", classOf(j, "{"), "t-punc");
  eq("the colon is punctuation", classOf(j, ":"), "t-punc");
}

// The negative case that nearly broke: a JS function body is full of braces and
// object literals and must not be mistaken for JSON.
eq("a js function body is not json", detectLang(HTTP_SNIPPET), "js");
eq("an import block is not json", detectLang(WRAP_SNIPPET), "js");
eq("a bare object literal with a comment is js", detectLang('{ // hi\n "a": 1 }'), "js");

for (const [name, code] of Object.entries({
  "empty object": "{}",
  "empty array": "[]",
  "nested": '{ "a": { "b": [1, 2, null] } }',
  "escaped quote in a value": '{ "a": "say \\" hi" }',
  "negative and exponent": '{ "a": -1, "b": 1e-9 }',
  "unicode value": '{ "a": "café — ✓" }',
})) {
  eq(`round-trips exactly: json ${name}`, text(highlight(code)), code);
}

console.log(
  failures ? `\n${failures} highlighter failure(s)` : `\nhighlighter lossless and correctly coloured`,
);
process.exit(failures ? 1 : 0);
