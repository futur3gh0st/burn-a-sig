#!/usr/bin/env node
// Build "Burn A Sig" — the browser signature builder — from src/burn-a-sig.html.
//
//   node scripts/build-burn-a-sig.mjs
//
// Emits index.html at the repo root, which is what GitHub Pages serves.
//
// WHY THIS SCRIPT EXISTS
// The previous builder carried its own hand-ported copy of the rendering code.
// It drifted: the roster moved to a MOBILE phone label and the builder still
// offered only DIRECT/CELL, so the same person got two different signatures
// depending on which tool built it. Copying code by hand guarantees that
// eventually. So the page ships with a placeholder and this script inlines
// src/template.js into it — one implementation, mechanically copied, every build.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The signature travels inside an email, so its <img> sources must be absolute
// HTTPS URLs — a relative path would resolve against the recipient's mail host
// and break. The five contact icons are served from this tool's own site, so a
// signature it builds carries no third-party or organisation-specific URL.
const ASSET_BASE = "https://futur3gh0st.github.io/burn-a-sig/assets";

// Optional starting values for the form, keyed by field id. Empty means the tool
// opens blank and assumes nothing about who is using it. A deployment that only
// ever serves one organisation can pre-fill e.g. { "f-company": "…" } here.
const DEFAULTS = {};

// A deployment that also bundles the page elsewhere — inside a client delivery
// package, say — adds its path here rather than copying the built file by hand.
const OUTPUTS = [join(ROOT, "index.html")];

/**
 * Turn the ES module at src/template.js into a script the browser can run
 * inline: strip the `export` keywords (there is no module scope in an inline
 * <script>) and drop the trailing `export const _internal` test hook.
 *
 * Deliberately mechanical — no reformatting, no minifying. The inlined code
 * should read identically to the file it came from, so anyone comparing the
 * two can see at a glance that they match.
 */
function inlineModule(source) {
  const stripped = source
    .replace(/^export const _internal[^\n]*\n?/m, "")
    .replace(/^export\s+function\s+/gm, "function ")
    .replace(/^export\s+const\s+/gm, "const ");

  const leftovers = stripped.match(/^\s*(export|import)\b.*/gm);
  if (leftovers) {
    throw new Error(
      "src/template.js has module syntax this script does not handle:\n  " +
        leftovers.join("\n  ") +
        "\nTeach inlineModule() about it rather than hand-copying the code.",
    );
  }
  return stripped;
}

const page = await readFile(join(ROOT, "src", "burn-a-sig.html"), "utf8");
const engine = inlineModule(await readFile(join(ROOT, "src", "template.js"), "utf8"));

// A missing placeholder means the page was edited in a way that silently drops
// the engine or the asset URL — fail loudly instead of shipping a broken tool.
for (const token of ["/*{{ENGINE}}*/", "{{ASSET_BASE}}", "{{DEFAULTS}}"]) {
  if (!page.includes(token)) throw new Error(`src/burn-a-sig.html is missing ${token}`);
}

const built = page
  .replace("/*{{ENGINE}}*/", () => engine)
  .replaceAll("{{ASSET_BASE}}", ASSET_BASE)
  .replaceAll("{{DEFAULTS}}", JSON.stringify(DEFAULTS));

// The three functions the page calls must actually be present after inlining.
for (const fn of ["renderSignature", "renderPlainText", "toTel"]) {
  if (!new RegExp(`\\bfunction ${fn}\\b`).test(built)) {
    throw new Error(`inlined engine is missing function ${fn}() — did src/template.js change?`);
  }
}
if (built.includes("{{")) throw new Error("unsubstituted placeholder left in the built page");

for (const out of OUTPUTS) {
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, built, "utf8");
}

console.log(`Burn A Sig built (${(built.length / 1024).toFixed(1)} KB), engine inlined from src/template.js:`);
for (const out of OUTPUTS) console.log(`  ${out.replace(ROOT + "/", "")}`);
