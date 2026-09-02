/**
 * Front matter, checked for the things YAML silently mis-parses.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * Three posts in a row broke the build on the same mistake: an unquoted YAML
 * scalar cannot contain `": "`, because YAML reads it as a nested key. A
 * description like `A twenty-minute pass: dump the real response` fails with
 * a `readBlockMapping` error pointing at a column number, which is a long way
 * from telling you the problem is a colon in your prose.
 *
 * `astro check` does catch it — but only after the whole content collection
 * fails to load, and the message names js-yaml internals rather than the file.
 * This names the file, the field and the fix.
 *
 * It also enforces the two limits the rest of the site is held to, which the
 * Zod schema in `content.config.ts` cannot express: Google renders about 60
 * characters of a title and about 160 of a description.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "src/content/blog";
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 165;

/** Leading characters that make YAML treat a scalar as something else. */
const YAML_LEAD = /^[\[\]{}>|*&!%@`#,?:-]/;

let failures = 0;
let checked = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".md"))) {
  const text = readFileSync(join(DIR, file), "utf8");
  const front = text.split("---")[1] ?? "";

  for (const field of ["title", "description"] as const) {
    const line = new RegExp(`^${field}: (.*)$`, "m").exec(front);
    if (!line) {
      console.log(`FAIL  ${file}: no ${field}`);
      failures++;
      continue;
    }

    const value = line[1];
    checked++;
    const quoted = /^["'].*["']$/.test(value.trim());

    // The one that keeps breaking the build.
    if (!quoted && value.includes(": ")) {
      console.log(`FAIL  ${file}: ${field} contains ": " and is unquoted — YAML reads it as a nested key. Use an em dash, or quote the whole value.`);
      failures++;
    }

    if (!quoted && YAML_LEAD.test(value.trim())) {
      console.log(`FAIL  ${file}: ${field} starts with a YAML control character — quote it.`);
      failures++;
    }

    const max = field === "title" ? TITLE_MAX : DESCRIPTION_MAX;
    if (value.length > max) {
      console.log(`FAIL  ${file}: ${field} is ${value.length} chars, over ${max}`);
      failures++;
    }
  }
}

console.log(
  failures
    ? `\n${failures} front-matter problem(s) across ${checked} fields`
    : `\nfront matter clean: ${checked} fields across ${readdirSync(DIR).filter((f) => f.endsWith(".md")).length} posts`,
);
process.exit(failures ? 1 : 0);
