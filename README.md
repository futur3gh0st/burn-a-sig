# 🔥 Burn A Sig

A one-page email signature builder. For anyone.

**→ [futur3gh0st.github.io/burn-a-sig](https://futur3gh0st.github.io/burn-a-sig)**

Fill in a few fields, watch the preview, copy, paste into Outlook. It also emits
the plain-text version the Outlook phone apps require — those only accept plain
text and will mangle an HTML signature.

## What you get

- **A desktop signature** — a table-and-inline-styles HTML fragment built to
  survive Outlook, Gmail and Apple Mail. No flexbox, no grid, no `<style>` block,
  no web fonts, no SVG, no JavaScript.
- **A phone signature** — plain text, for the Outlook iOS and Android apps.
- Both as copy-to-clipboard or as a downloadable `.html` / `.txt`.

Every row is optional. Leave a field blank and that row disappears — no empty
labels, no placeholder text, no broken image where a logo would be.

## Privacy

Everything runs in your browser. Nothing you type is uploaded, stored or logged.
There is no backend, no database, no analytics, and no third-party script.

## Your logo

Paste a **public HTTPS URL** to a PNG or JPG. Email clients cannot show an image
from your computer, so a logo has to be hosted somewhere that stays put — if it
moves or is deleted later, every signature you have already sent loses it.

Leave it blank and the signature simply has no logo.

The five contact icons are served from this site, so a signature built here
carries no third-party URL you have to keep alive yourself.

## Editing it

`index.html` is **generated**, not hand-edited. The signature-rendering engine is
inlined into it at build time from a shared module, so there is one
implementation rather than a copy that drifts.

```bash
npm run build:sig   # regenerate index.html from src/
npm run check:sig   # 38 checks
```

`check:sig` executes the page's own script against a DOM stand-in and asserts real
behaviour — typing updates the preview, optional rows appear and disappear, the
phone label matches between the HTML and plain-text output, input is escaped, and
the copy buttons fall back cleanly where the clipboard API is unavailable.

Static analysis would not catch the bug that prompted all of this: the code was
correct, compiled, and produced the wrong output. Only running it finds that.

It also enforces `@email.com` as the only example address. A deployment that builds
signatures for a named organisation alongside this tool can add an optional
`check.config.json` — `{ "offRosterNames": [...], "clientTerms": [...] }` — and those
names will fail the build if they ever reach the page. That file is git-ignored:
committing it would publish the very names it exists to keep out.

## Verify it yourself

```bash
git diff --stat index.html
```

Prints nothing. The published page is byte-identical to what the build produces from
source.

## Contents

`index.html` (built) · `src/` · `scripts/` · five icons. No personal data of any kind.

## Also

[**Latent Fault 001 — the README was lying**](./LATENT-FAULT-001.md). Four faults this
project shipped with, one still live, and the single pattern underneath all of them.

---

[MIT](./LICENSE). Use it for whatever.
