# Latent Fault 001 — the README was lying

A *latent fault* is a defect that already exists in a system but has not surfaced yet.
Nothing is broken. Everything passes. It is simply waiting for the conditions that make
it matter.

This tool exists because of one. It then shipped with four more, which is either
embarrassing or exactly on brand. I'm going with the second one.

---

## The fault that started it

The signature engine existed twice: once as the real module, once as a hand-ported copy
inside the browser builder. Two implementations of one truth.

Then the phone label changed from `DIRECT` to `MOBILE`. The module was updated. The copy
was not.

Nothing broke. No error, no failing build, no crash. The tool kept producing signatures
happily — it just labelled people's mobile numbers "Direct:". The same person got two
different signatures depending on which tool built it, and both looked completely fine.

That is the whole shape of the thing. **A latent fault does not announce itself. It waits
for the one input that separates the two copies.**

The fix wasn't correcting the label. Correcting the label would have left two copies that
happened to agree that day. The fix was deleting the copy: the page now ships with a
placeholder, and the build inlines `src/template.js` into it. One implementation,
mechanically copied, every build.

## Then I shipped four more

Published the tool. Read my own README a day later.

**1. It documented a build I hadn't published.** `npm run build:sig` — no `package.json`,
no `scripts/`, no `src/`. Anyone who cloned it and ran the documented command got an error.

**2. It documented a verification suite that wasn't there.** The strongest claim in the
README — a check suite that runs the page's own script against a DOM stand-in and asserts
real behaviour — was the one thing nobody could verify. I was describing the gate instead
of showing it.

**3. It said "31 checks."** The suite has 38. The number in the prose and the number in
the code were two copies of one truth, and only one of them got updated.

**4. It said MIT.** There was no LICENSE file.

## The pattern

Every one of these is the same fault wearing a different hat.

| Truth | Copy one | Copy two |
|---|---|---|
| how a signature renders | `src/template.js` | a hand-ported duplicate |
| how many checks exist | the check suite | "31 checks" in prose |
| the licence | `README.md` | *(no file)* |
| how to build it | `README.md` | *(no scripts)* |

**Documentation is a copy of the code.** It drifts for exactly the same reason a
hand-ported function drifts, and it drifts more easily, because nothing runs it.

The engine fault got fixed structurally — the duplicate was deleted, so it cannot recur.
The README faults got fixed by publishing the real thing, which is the same move: stop
keeping a second copy, ship the original.

The check count is still two copies. I've written 38 in the prose and I know it will be
wrong again.

## One that is still live

The five contact icons are served from `futur3gh0st.github.io/burn-a-sig/assets`. Every
signature this tool builds carries those URLs into people's mail.

Renaming the GitHub account changes the Pages domain, and unlike repository renames,
`username.github.io` does not redirect. Every signature anyone has ever built would lose
its icons — retroactively, in mail that already landed.

The README warns users about exactly this for their own logo: *"if it moves or is deleted
later, every signature you have already sent loses it."* I wrote that warning while
depending on the same thing.

It hasn't surfaced. Nothing is broken. That's what makes it a latent fault rather than a bug.

## What actually catches these

Not care, and not being experienced enough to know better — I knew all of this and shipped
it anyway. What catches them is a check that fails.

`npm run check:sig` runs the page's real script against a DOM stand-in and asserts what
happens when someone types. Static analysis would never have found the phone-label bug,
because the code was correct. It compiled, it ran, it produced output. The output was
just wrong.

That's the only kind of check worth writing: one that can tell the difference between
*working* and *right*.

---

**Verify it yourself:**

```bash
npm run build:sig        # regenerate index.html from src/
npm run check:sig        # 38 checks
git diff --stat index.html
```

The last line prints nothing. The published page is byte-identical to what the build
produces from source — which is the one claim in this README that checks itself.
