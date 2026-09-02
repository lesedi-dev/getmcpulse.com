/**
 * A very small syntax highlighter for the code blocks on this site.
 *
 * ── Why not a real one ────────────────────────────────────────────────────
 * Shiki or Prism would be correct and would also be the largest dependency in
 * a static marketing site, shipped to colour six short snippets that are all
 * written by us and all change about once a quarter. This handles exactly the
 * constructs those snippets use and nothing else.
 *
 * ── Why it returns data ───────────────────────────────────────────────────
 * `Token[]`, not an HTML string. The caller renders text nodes, so a snippet
 * can never inject markup — the same reason `highlightSegments()` in
 * `check.ts` returns segments instead of `<mark>` tags. Nothing here is user
 * input today, but the cost of keeping that true is one array.
 *
 * The class names are the `.t-*` set in `global.css`, which is the terminal
 * palette that deliberately does not follow the theme toggle.
 */

export type Token = {
  text: string;
  /** A `.t-*` class from the terminal palette, or "" for whitespace. */
  cls: string;
};

export type Lang = "sh" | "js" | "env" | "json";

const KEYWORDS = new Set([
  "import",
  "export",
  "from",
  "const",
  "let",
  "var",
  "new",
  "return",
  "function",
  "async",
  "await",
  "default",
  "if",
  "else",
  "class",
  "extends",
  "typeof",
]);

/**
 * Ordered alternation — first match wins, so `fn` and `prop` get their shot at
 * an identifier before the generic `word` arm claims it. `word` allows dots so
 * `process.env.MCPULSE_KEY` stays one token rather than three plus punctuation.
 */
const JS_TOKEN = new RegExp(
  [
    String.raw`(?<comment>\/\/[^\n]*)`,
    // Backtick written as \x60: inside String.raw a `\`` would stay a literal
    // backslash-backtick, which is an invalid identity escape under the u flag.
    String.raw`(?<string>"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\x60(?:[^\x60\\]|\\.)*\x60)`,
    String.raw`(?<number>\b\d[\d_.]*\b)`,
    String.raw`(?<fn>[A-Za-z_$][\w$]*(?=\s*\())`,
    String.raw`(?<prop>[A-Za-z_$][\w$]*(?=\s*:))`,
    String.raw`(?<word>[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)`,
    String.raw`(?<punc>[{}()\[\].,;:=<>+\-*/%!&|?]+)`,
    String.raw`(?<space>\s+)`,
    // Catch-all, and the reason the round-trip test exists: without it a
    // character no arm claims — a lone quote from an unterminated string, a
    // stray backslash — is silently dropped, which edits the snippet the
    // reader is about to paste. Every character must leave as some token.
    String.raw`(?<other>[\s\S])`,
  ].join("|"),
  "gu",
);

/**
 * JSON gets its own scanner rather than riding the JS one. Under the JS arms a
 * key like `"tool_name"` matches `string` before anything notices the colon
 * after it, so every key came out the same colour as every value — which is
 * most of what reading a payload is: telling the two apart.
 *
 * Keys take `t-prop`, the same colour a JS object key gets a few blocks up the
 * same page. Consistency inside one codebase beats matching any one editor.
 */
const JSON_TOKEN = new RegExp(
  [
    String.raw`(?<key>"(?:[^"\\\n]|\\.)*"(?=\s*:))`,
    String.raw`(?<string>"(?:[^"\\\n]|\\.)*")`,
    String.raw`(?<number>-?\b\d[\d.]*(?:[eE][+-]?\d+)?)`,
    String.raw`(?<lit>\b(?:true|false|null)\b)`,
    String.raw`(?<punc>[{}\[\],:])`,
    String.raw`(?<space>\s+)`,
    String.raw`(?<other>[\s\S])`,
  ].join("|"),
  "gu",
);

function jsonLine(line: string, out: Token[]): void {
  for (const m of line.matchAll(JSON_TOKEN)) {
    const g = m.groups!;
    if (g.space !== undefined) out.push({ text: g.space, cls: "" });
    else if (g.key !== undefined) out.push({ text: g.key, cls: "t-prop" });
    else if (g.string !== undefined) out.push({ text: g.string, cls: "t-str" });
    else if (g.number !== undefined) out.push({ text: g.number, cls: "t-num" });
    else if (g.lit !== undefined) out.push({ text: g.lit, cls: "t-kw" });
    else if (g.punc !== undefined) out.push({ text: g.punc, cls: "t-punc" });
    else if (g.other !== undefined) out.push({ text: g.other, cls: "t-text" });
  }
}

/** Guess the language from the snippet itself, so callers need not label them. */
export function detectLang(code: string): Lang {
  const lines = code.split("\n").filter((l) => l.trim() !== "");
  if (lines.length > 0 && lines.every((l) => /^\s*\$\s/.test(l))) return "sh";
  if (lines.length > 0 && lines.every((l) => /^\s*(#|[A-Z][A-Z0-9_]*\s*=)/.test(l))) return "env";

  // A brace-first block with none of JS's own vocabulary in it. The negative
  // half matters: `HTTP_SNIPPET` on /install is a function body full of braces
  // and object literals, and must stay js.
  // `lines` is already filtered of blanks, so it can be empty — `lines[0]!` here
  // crashed on `highlight("")`. Nothing on the site passes an empty block today;
  // the round-trip test does.
  const first = lines[0]?.trim() ?? "";
  if (
    /^[{[]/.test(first) &&
    !/\b(const|let|var|function|import|export|return|new|class|await)\b|=>|\/\//.test(code)
  )
    return "json";

  return "js";
}

function jsLine(line: string, out: Token[]): void {
  for (const m of line.matchAll(JS_TOKEN)) {
    const g = m.groups!;
    if (g.space !== undefined) out.push({ text: g.space, cls: "" });
    else if (g.comment !== undefined) out.push({ text: g.comment, cls: "t-dim" });
    else if (g.string !== undefined) out.push({ text: g.string, cls: "t-str" });
    else if (g.number !== undefined) out.push({ text: g.number, cls: "t-num" });
    else if (g.fn !== undefined) out.push({ text: g.fn, cls: "t-fn" });
    else if (g.prop !== undefined) out.push({ text: g.prop, cls: "t-prop" });
    else if (g.word !== undefined)
      out.push({ text: g.word, cls: KEYWORDS.has(g.word) ? "t-kw" : "t-text" });
    else if (g.punc !== undefined) out.push({ text: g.punc, cls: "t-punc" });
    else if (g.other !== undefined) out.push({ text: g.other, cls: "t-text" });
  }
}

/**
 * Tokenise `code`. Newlines are emitted as their own untagged tokens, so a
 * `<pre>` renders the original line breaks with no extra elements.
 */
export function highlight(code: string, lang: Lang = detectLang(code)): Token[] {
  const out: Token[] = [];
  const lines = code.split("\n");

  lines.forEach((line, i) => {
    if (i > 0) out.push({ text: "\n", cls: "" });

    // A shell prompt is the one thing coloured across every language: the `$`
    // is not part of the command, and a reader who copies it gets an error.
    const prompt = /^(\s*)(\$)(\s+)(.*)$/.exec(line);
    if (prompt) {
      const [, lead, sigil, gap, rest] = prompt;
      if (lead) out.push({ text: lead, cls: "" });
      out.push({ text: sigil, cls: "t-prompt" });
      out.push({ text: gap, cls: "" });
      out.push({ text: rest, cls: "t-text" });
      return;
    }

    if (line.trim() === "") {
      if (line !== "") out.push({ text: line, cls: "" });
      return;
    }

    if (lang === "sh") {
      out.push({ text: line, cls: "t-text" });
      return;
    }

    if (lang === "env") {
      const comment = /^\s*#/.test(line);
      if (comment) {
        out.push({ text: line, cls: "t-dim" });
        return;
      }
      const kv = /^(\s*)([A-Z][A-Z0-9_]*)(=)(.*)$/.exec(line);
      if (kv) {
        const [, lead, key, eq, value] = kv;
        if (lead) out.push({ text: lead, cls: "" });
        out.push({ text: key, cls: "t-key" });
        out.push({ text: eq, cls: "t-punc" });
        if (value) out.push({ text: value, cls: "t-str" });
        return;
      }
      out.push({ text: line, cls: "t-text" });
      return;
    }

    if (lang === "json") {
      jsonLine(line, out);
      return;
    }

    // A `#` comment in a JS block is a shell comment that wandered in — treat
    // it as a comment rather than letting `punc` split it character by character.
    if (/^\s*#/.test(line)) {
      out.push({ text: line, cls: "t-dim" });
      return;
    }

    jsLine(line, out);
  });

  return out;
}
