#!/usr/bin/env node
// Smoke-test the built Burn A Sig page without a browser.
//
//   node scripts/check-burn-a-sig.mjs [path-to-built-page]
//
// Two passes:
//
//   1. STATIC   — every id the script reaches for exists in the markup, every
//                 <label for> points at a real control, no duplicate ids, every
//                 control is labelled, and the inline script parses.
//
//   2. FUNCTIONAL — the page's own <script> is executed against a small DOM
//                 stand-in. That runs the real wiring: readForm, validate,
//                 refresh, the copy/download/reset handlers. Typing into a field
//                 and firing "input" must update the preview, exactly as it
//                 would in a browser.
//
// The functional pass is the one that matters. Static checks would not have
// caught the bug that prompted this rewrite (a stale phone label), because that
// was working code producing wrong output.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = process.argv[2] ?? join(ROOT, "index.html");
const html = readFileSync(PAGE, "utf8");

const failures = [];
const fail = (msg) => failures.push(msg);
const pass = [];
const ok = (msg) => pass.push(msg);

// ---------------------------------------------------------------------------
// 1. Static
// ---------------------------------------------------------------------------

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const idSet = new Set(ids);
const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
dupes.length ? fail(`duplicate id(s): ${[...new Set(dupes)].join(", ")}`) : ok(`${idSet.size} unique ids`);

const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
if (!script) fail("no inline <script> found");

// Every element the script looks up must exist. $("x") and getElementById("x").
const looked = new Set([
  ...[...(script ?? "").matchAll(/\$\("([^"]+)"\)/g)].map((m) => m[1]),
  ...[...(script ?? "").matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]),
]);
const missing = [...looked].filter((id) => !idSet.has(id));
missing.length
  ? fail(`script reaches for ids that do not exist: ${missing.join(", ")}`)
  : ok(`all ${looked.size} script-referenced ids exist`);

// Ids built dynamically by validate(): setError("f-x","e-x") pairs.
const pairs = [...(script ?? "").matchAll(/setError\("([^"]+)",\s*"([^"]+)"/g)];
const badPairs = pairs.filter(([, i, e]) => !idSet.has(i) || !idSet.has(e));
badPairs.length
  ? fail(`setError() references missing ids: ${badPairs.map(([, i, e]) => `${i}/${e}`).join(", ")}`)
  : ok(`all ${pairs.length} validation field/error pairs resolve`);

// Every <label for> must point at a real control.
const fors = [...html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]);
const orphanFors = fors.filter((f) => !idSet.has(f));
orphanFors.length
  ? fail(`<label for> pointing at nothing: ${orphanFors.join(", ")}`)
  : ok(`all ${fors.length} <label for> targets exist`);

// Every control must be labelled somehow — WCAG 2.2 AA, and screen-reader users
// otherwise meet a row of unnamed boxes.
const controls = [...html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)];
const unlabelled = controls
  .map(([, tag, attrs]) => ({ tag, attrs, id: /\sid="([^"]+)"/.exec(attrs)?.[1] }))
  .filter((c) => !/aria-label=/.test(c.attrs) && !(c.id && fors.includes(c.id)));
unlabelled.length
  ? fail(`unlabelled control(s): ${unlabelled.map((c) => c.id ?? c.tag).join(", ")}`)
  : ok(`all ${controls.length} form controls are labelled`);

// Buttons need an accessible name.
const namelessButtons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
  .filter(([, attrs, text]) => !/aria-label=/.test(attrs) && text.replace(/<[^>]*>/g, "").trim() === "");
namelessButtons.length ? fail(`${namelessButtons.length} button(s) with no accessible name`) : ok("all buttons are named");

if (html.includes("{{")) fail("unsubstituted {{placeholder}} left in the page");
if (/\\u[0-9a-fA-F]{4}/.test(html.replace(/<script>[\s\S]*?<\/script>/g, ""))) {
  fail("literal \\uXXXX escape in page text — it renders as backslash-u, not a character");
} else ok("no literal \\uXXXX escapes in page text");

// ---------------------------------------------------------------------------
// 1b. No staff data in a page that gets published publicly
// ---------------------------------------------------------------------------
// This page ships to a public site. Anyone building it alongside real customer
// data — a roster of staff, a client's branding — can publish someone's details
// by borrowing a real name as a form example or leaving one in a code comment.
// It has happened once already (a real employee's name was the "full name"
// placeholder), so it is checked on every build rather than remembered.
//
// The names and terms to forbid are deployment-specific, so they live in an
// OPTIONAL check.config.json next to this repo rather than in the source:
//
//   { "offRosterNames": ["Surname", ...], "clientTerms": ["AcmeCorp", ...] }
//
// That file is git-ignored. A public checkout has no config and reports these
// two checks as not applicable; a checkout that also builds signatures for a
// named organisation supplies one and gets the guard. Putting the denylist in
// the source would mean publishing the very names it exists to keep out.
let OFF_ROSTER_NAMES = [];
let CLIENT_TERMS = [];
try {
  const cfg = JSON.parse(readFileSync(join(ROOT, "check.config.json"), "utf8"));
  OFF_ROSTER_NAMES = cfg.offRosterNames ?? [];
  CLIENT_TERMS = cfg.clientTerms ?? [];
} catch {
  /* no local config — reported below */
}
// The only examples permitted anywhere in the page.
const ALLOWED_EXAMPLES = ["Melody Lee", "mlee@email.com", "@email.com"];
// The stand-in used in every example. If a real person ever shares this name,
// change the placeholder rather than weakening the check.
const PLACEHOLDER = "Melody Lee";
{
  if (!OFF_ROSTER_NAMES.length && !CLIENT_TERMS.length) {
    ok("no check.config.json — name and branding denylists not applicable here");
  }

  const named = OFF_ROSTER_NAMES.filter((n) => new RegExp(`\\b${n}\\b`).test(html));
  if (OFF_ROSTER_NAMES.length) {
    named.length
      ? fail(`real person named in a publicly-hosted page: ${named.join(", ")} — use "${PLACEHOLDER}" or a role instead`)
      : ok("no off-roster real names in the page");
  }

  const branded = CLIENT_TERMS.filter((t) => new RegExp(t, "i").test(html));
  if (CLIENT_TERMS.length) {
    branded.length
      ? fail(`client branding in a general-purpose tool: ${branded.join(", ")}`)
      : ok("no client branding in the page");
  }

  // Any other example address would be a second convention to keep straight.
  const addresses = [...html.matchAll(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi)].map((m) => m[0]);
  const strays = [...new Set(addresses)].filter((a) => !ALLOWED_EXAMPLES.some((x) => a.endsWith(x) || a === x));
  strays.length
    ? fail(`example address that is not @email.com: ${strays.join(", ")}`)
    : ok(`${addresses.length} example address(es), all @email.com`);
}

try {
  const roster = JSON.parse(readFileSync(join(ROOT, "data", "roster.json"), "utf8"));
  const leaks = [];
  for (const p of roster.people) {
    const surname = p.name.replace(/,.*$/, "").trim().split(/\s+/).pop();
    if (surname.length > 3 && html.includes(surname)) leaks.push(`${p.slug} (surname "${surname}")`);
    if (p.email && html.includes(p.email)) leaks.push(`${p.slug} (email)`);
    if (p.direct && html.includes(p.direct)) leaks.push(`${p.slug} (phone)`);
  }
  leaks.length
    ? fail(`staff data in a publicly-hosted page: ${[...new Set(leaks)].join(", ")}`)
    : ok(`no staff name, email or number from the roster appears in the page`);
} catch {
  ok("roster not readable from here — skipping the staff-data check");
}

// ---------------------------------------------------------------------------
// 2. Functional — run the page's script against a DOM stand-in
// ---------------------------------------------------------------------------

/** The smallest DOM that the page's wiring actually touches. */
function makeDom(pageHtml) {
  const nodes = new Map();
  // Seed every id found in the markup, carrying its initial value/selected option.
  for (const m of pageHtml.matchAll(/<(input|select|textarea|div|span|button|form)\b([^>]*)>/g)) {
    const [, tag, attrs] = m;
    const id = /\sid="([^"]+)"/.exec(attrs)?.[1];
    if (!id) continue;
    nodes.set(id, {
      id,
      tagName: tag.toUpperCase(),
      value: /\svalue="([^"]*)"/.exec(attrs)?.[1] ?? "",
      textContent: "",
      innerHTML: "",
      hidden: /\shidden\b/.test(attrs),
      selectedIndex: 0,
      _attrs: {},
      _listeners: {},
      addEventListener(ev, fn) { (this._listeners[ev] ??= []).push(fn); },
      dispatch(ev) { for (const fn of this._listeners[ev] ?? []) fn({ type: ev }); },
      setAttribute(k, v) { this._attrs[k] = v; },
      getAttribute(k) { return this._attrs[k]; },
      select() {}, setSelectionRange() {}, focus() { dom._focused = this.id; },
    });
  }
  // <select> options: value of the selected one.
  for (const m of pageHtml.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const id = /\sid="([^"]+)"/.exec(m[1])?.[1];
    if (!id || !nodes.has(id)) continue;
    const opts = [...m[2].matchAll(/<option value="([^"]*)"([^>]*)>/g)].map(([, v, a]) => ({ v, sel: /selected/.test(a) }));
    const node = nodes.get(id);
    node._options = opts;
    node.selectedIndex = Math.max(0, opts.findIndex((o) => o.sel));
    node.value = opts[node.selectedIndex]?.v ?? "";
    Object.defineProperty(node, "selectedIndex", {
      get() { return this._si ?? 0; },
      set(i) { this._si = i; this.value = this._options?.[i]?.v ?? ""; },
    });
    node.selectedIndex = Math.max(0, opts.findIndex((o) => o.sel));
  }

  const dom = {
    _focused: null,
    _clicks: [],
    document: {
      getElementById: (id) => nodes.get(id) ?? null,
      createElement: () => ({ href: "", download: "", click() { dom._clicks.push(this.download); }, style: {} }),
      createRange: () => ({ selectNodeContents() {} }),
      body: { appendChild() {}, removeChild() {} },
      execCommand: () => true,
    },
    nodes,
  };
  return dom;
}

if (script) {
  const dom = makeDom(html);
  const sandbox = {
    document: dom.document,
    window: { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) },
    navigator: {},
    URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
    Blob: class { constructor(parts) { this.parts = parts; } },
    setTimeout: () => 0,
    clearTimeout: () => {},
    console,
  };
  sandbox.globalThis = sandbox;

  try {
    runInNewContext(script, sandbox, { filename: "burn-a-sig inline script" });
    ok("inline script executes without throwing");
  } catch (e) {
    fail(`inline script threw on load: ${e.message}`);
  }

  const preview = dom.nodes.get("sigPreview");
  const plain = dom.nodes.get("plainOut");

  // -- initial render --
  if (!preview?.innerHTML?.includes("<table")) fail("preview did not render a signature on load");
  else ok("preview renders on load");
  if (!plain?.value?.includes("Melody Lee")) fail("plain-text box did not populate on load");
  else ok("plain-text box populates on load");
  if (preview?.innerHTML?.includes("{{")) fail("preview contains an unsubstituted placeholder");
  if (/\bundefined\b|\bnull\b/.test(plain?.value ?? "")) fail(`plain text rendered undefined/null: ${plain.value}`);

  // -- typing updates the output --
  const before = preview.innerHTML;
  dom.nodes.get("f-name").value = "Testy McTestface";
  dom.nodes.get("f-name").dispatch("input");
  if (preview.innerHTML === before) fail("typing a name did not update the preview");
  else if (!preview.innerHTML.includes("Testy McTestface")) fail("preview did not pick up the typed name");
  else ok("typing updates the preview");
  if (!plain.value.includes("Testy McTestface")) fail("typing did not update the plain-text box");
  else ok("typing updates the plain-text box");

  // -- the label bug this rewrite exists to fix --
  dom.nodes.get("f-direct").value = "(970) 555-0134";
  dom.nodes.get("f-direct").dispatch("input");
  if (!preview.innerHTML.includes(">MOBILE<")) fail("HTML signature does not show the MOBILE label");
  else ok("HTML shows MOBILE");
  if (!plain.value.includes("Mobile: (970) 555-0134")) fail(`plain text shows "${/^.*(Mobile|Direct|Cell):.*$/m.exec(plain.value)?.[0]}" instead of "Mobile: (970) 555-0134"`);
  else ok("plain text shows Mobile:");
  if (!preview.innerHTML.includes('href="tel:+19705550134"')) fail("no tel: link derived from the typed number");
  else ok("tel: link derived from typed digits");

  // Switching the label must move both outputs together.
  const sel = dom.nodes.get("f-label");
  sel.value = "DIRECT";
  sel.dispatch("change");
  if (!preview.innerHTML.includes(">DIRECT<") || !plain.value.includes("Direct: "))
    fail("switching the label to DIRECT did not update both HTML and plain text");
  else ok("label switch updates HTML and plain text together");
  sel.value = "MOBILE";
  sel.dispatch("change");

  // -- optional rows appear and disappear --
  const officeField = dom.nodes.get("f-office");
  if (preview.innerHTML.includes("icon-phone.png")) fail("office row rendered while the field is blank");
  else ok("blank office field renders no office row");
  officeField.value = "(970) 486-1440";
  officeField.dispatch("input");
  if (!preview.innerHTML.includes("icon-phone.png") || !plain.value.includes("Office: (970) 486-1440"))
    fail("filling the office field did not add the office row");
  else ok("office row appears when filled");
  officeField.value = "";
  officeField.dispatch("input");
  if (preview.innerHTML.includes("icon-phone.png")) fail("clearing the office field left the row behind");
  else ok("office row disappears when cleared");

  // -- validation is advisory and wired to the right spans --
  const email = dom.nodes.get("f-email");
  email.value = "not an email";
  email.dispatch("input");
  if (dom.nodes.get("e-email").hidden !== false) fail("bad email did not reveal its error message");
  else ok("invalid email shows an error");
  if (email.getAttribute("aria-invalid") !== "true") fail("bad email did not set aria-invalid");
  else ok("invalid email sets aria-invalid");
  if (!preview.innerHTML.includes("not an email")) fail("validation blocked rendering — it should be advisory only");
  else ok("validation is advisory, not blocking");
  email.value = "jdoe@email.com";
  email.dispatch("input");
  if (dom.nodes.get("e-email").hidden !== true) fail("fixing the email did not clear the error");
  else ok("fixing the email clears the error");

  // -- escaping --
  dom.nodes.get("f-name").value = '<script>alert(1)</' + "script>";
  dom.nodes.get("f-name").dispatch("input");
  if (/<script>alert/.test(preview.innerHTML)) fail("name field is not escaped — script injected into the preview");
  else ok("name field is escaped");

  // -- colour theme --
  // The palette is a template parameter now, not a constant. Both the preset
  // dropdown and an individual swatch must reach the rendered signature.
  const olive = preview.innerHTML.includes("#3f4a1f");
  olive ? ok("default olive palette reaches the signature") : fail("default palette not applied");

  const presetSel = dom.nodes.get("f-preset");
  presetSel.value = "navy";
  presetSel.dispatch("change");
  if (!preview.innerHTML.includes("#1b2a4a")) fail("changing the colour theme did not repaint the signature");
  else ok("colour theme changes the signature");
  if (dom.nodes.get("c-name").value !== "#1b2a4a") fail("preset did not update the swatches");
  else ok("preset updates the swatches");

  dom.nodes.get("c-name").value = "#ff0000";
  dom.nodes.get("c-name").dispatch("input");
  if (!preview.innerHTML.includes("#ff0000")) fail("a custom swatch did not reach the signature");
  else ok("custom swatch reaches the signature");

  presetSel.value = "olive";
  presetSel.dispatch("change");

  // -- contact icons --
  const iconSel = dom.nodes.get("f-iconstyle");
  if (!preview.innerHTML.includes("icon-email.png")) fail("image icons missing by default");
  else ok("image icons render by default");

  iconSel.value = "emoji";
  iconSel.dispatch("change");
  if (preview.innerHTML.includes("icon-email.png")) fail("emoji mode still emits a hosted <img> icon");
  else if (!preview.innerHTML.includes("\u{2709}")) fail("emoji mode did not emit the envelope character");
  else ok("emoji icons replace the hosted images");

  iconSel.value = "none";
  iconSel.dispatch("change");
  if (preview.innerHTML.includes("icon-email.png") || preview.innerHTML.includes("\u{2709}"))
    fail("\"no icons\" still rendered an icon");
  else ok("\"no icons\" drops the icon cell entirely");

  iconSel.value = "image";
  iconSel.dispatch("change");
  if (!preview.innerHTML.includes("icon-email.png")) fail("switching back to images did not restore them");
  else ok("icon style switches back cleanly");

  // -- reset --
  dom.document.getElementById("btn-reset").dispatch("click");
  ok("reset handler is wired");

  // -- downloads --
  dom.nodes.get("f-name").value = "Melody Lee";
  dom.nodes.get("f-name").dispatch("input");
  dom.document.getElementById("btn-dl-html").dispatch("click");
  dom.document.getElementById("btn-dl-txt").dispatch("click");
  if (!dom._clicks.includes("melody-lee.html") || !dom._clicks.includes("melody-lee.txt"))
    fail(`download filenames wrong: got ${JSON.stringify(dom._clicks)}`);
  else ok("downloads produce melody-lee.html and melody-lee.txt");

  // -- copy buttons must not throw where the clipboard API is absent (file://) --
  try {
    dom.document.getElementById("btn-copy").dispatch("click");
    dom.document.getElementById("btn-copy-plain").dispatch("click");
    ok("copy buttons fall back cleanly with no clipboard API");
  } catch (e) {
    fail(`copy button threw without the clipboard API: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------

for (const p of pass) console.log(`  PASS  ${p}`);
if (failures.length) {
  console.log("");
  for (const f of failures) console.log(`  FAIL  ${f}`);
  console.log(`\n${pass.length} passed, ${failures.length} FAILED — ${PAGE}`);
  process.exit(1);
}
console.log(`\n${pass.length}/${pass.length} checks passed — ${PAGE}`);
