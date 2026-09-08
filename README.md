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
npm run build:sig   # regenerate index.html
npm run check:sig   # 31 checks
```

`check:sig` executes the page's own script against a DOM stand-in and asserts real
behaviour — typing updates the preview, optional rows appear and disappear, the
phone label matches between the HTML and plain-text output, input is escaped, and
the copy buttons fall back cleanly where the clipboard API is unavailable.

It also enforces that this stays a general-purpose tool: no real person's name, no
client branding, and `@email.com` as the only example domain.

## Contents

Just the built page and the five icons. No personal data of any kind.

---

MIT. Use it for whatever.
