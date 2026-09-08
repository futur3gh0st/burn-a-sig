// Single reusable email-signature template.
//
// EMAIL-CLIENT CONSTRAINTS (Gmail, Outlook desktop/web, Apple Mail):
//   - Layout is <table>/<tr>/<td> only. No flexbox, no grid.
//   - All styling is inline. No <style> blocks, no external/linked CSS, no classes.
//   - No JavaScript, no SVG, no web fonts, no background images.
//   - Images are hosted PNGs referenced by absolute HTTPS URL (data: URIs are
//     stripped by Gmail). Every <img> carries width/height attrs + alt.
//   - Colored cells carry a bgcolor attribute AND an inline background style,
//     because Outlook's Word engine honors the attribute more reliably.
//
// This module exports one function, renderSignature(), used for every person.
// The <img> src values are built from an assetBase so the same template serves
// both the local browser preview (relative path) and production (HTTPS host).

export const DEFAULT_COLORS = {
  name: "#3f4a1f",
  title: "#4c5a26",
  text: "#3a3a34",
  label: "#b0aea3",
  webLink: "#6b7c3a",
  emailLink: "#4c5a26",
  divider: "#e6e1d4",
  bookLink: "#4c5a26",
  bookAccent: "#e0a12e",
};

const FONT = "Arial, Helvetica, sans-serif";

/**
 * Text stand-ins for the five contact icons, for signatures that should carry
 * no hosted images at all. Emoji are just characters, so they need no hosting
 * and cannot break later the way a linked PNG can — the trade is that each mail
 * client draws them in its own style.
 */
const EMOJI_ICONS = {
  "icon-mobile.png": "\u{1F4F1}",
  "icon-phone.png": "\u{260E}\u{FE0F}",
  "icon-fax.png": "\u{1F4E0}",
  "icon-globe.png": "\u{1F310}",
  "icon-email.png": "\u{2709}\u{FE0F}",
};

/** Escape text destined for HTML element content / double-quoted attributes. */
function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Join an asset base and a filename into one URL without doubling the slash.
 * A file that is already an absolute URL passes straight through, so a caller
 * can supply their own logo by full URL rather than dropping a file next to the
 * bundled icons.
 */
function assetUrl(base, file) {
  if (/^(https?:)?\/\//i.test(String(file))) return String(file);
  return `${String(base).replace(/\/+$/, "")}/${file}`;
}

/**
 * One contact row: icon cell + value cell. `valueHtml` is pre-built HTML.
 *
 * `iconStyle` picks how the left cell is drawn:
 *   "image" — the hosted PNG set (default; what the roster signatures use)
 *   "emoji" — a text character, so the signature carries no images at all
 *   "none"  — no icon cell, the values sit flush left
 */
function contactRow(assetBase, icon, valueHtml, isLast, c, iconStyle) {
  const pad = isLast ? "0" : "10px";
  let iconCell = "";
  if (iconStyle === "emoji") {
    iconCell =
      `<td width="15" valign="middle" style="padding:0 10px ${pad} 0;font-family:${FONT};font-size:13px;line-height:1;">` +
        (EMOJI_ICONS[icon] ?? "") +
      `</td>`;
  } else if (iconStyle !== "none") {
    iconCell =
      `<td width="15" valign="middle" style="padding:0 10px ${pad} 0;">` +
        `<img src="${esc(assetUrl(assetBase, icon))}" alt="" width="15" height="15" style="display:block;border:0;" />` +
      `</td>`;
  }
  return (
    `<tr>` +
      iconCell +
      `<td valign="middle" style="padding-bottom:${pad};font-family:${FONT};font-size:13px;color:${c.text};white-space:nowrap;">` +
        valueHtml +
      `</td>` +
    `</tr>`
  );
}

/**
 * Derive a `tel:` value from a typed number — "(970) 555-0134" -> "+19705550134".
 * The roster supplies `directTel`/`officeTel` explicitly and they are used as-is;
 * this is the fallback for numbers typed into the signature builder, where there
 * is no second field to disagree with. Returns "" if the digits aren't a NANP
 * number, and the caller then renders the number as text with no link — better
 * than emitting a link that dials something wrong.
 */
export function toTel(display) {
  const d = String(display ?? "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return "";
}

/** A phone number, linked when we have a dialable form for it. */
function phoneHtml(display, tel, c) {
  const dial = tel || toTel(display);
  return dial
    ? `<a href="tel:${esc(dial)}" style="color:${c.text};text-decoration:none;">${esc(display)}</a>`
    : esc(display);
}

/** A trailing gray label (DIRECT / MOBILE / OFFICE / FAX) after a phone number. */
function labelSpan(label, c) {
  return (
    `<span style="font-size:11px;color:${c.label};letter-spacing:0.5px;` +
    `margin-left:8px;">${esc(label)}</span>`
  );
}

/**
 * Render the signature HTML fragment for one person.
 * @param {object} person  A roster person record.
 * @param {object} shared  roster.shared.
 * @param {object} opts    { assetBase: string }
 * @returns {string} HTML fragment (a single <table>) safe to paste into a client.
 */
export function renderSignature(person, shared, opts = {}) {
  const assetBase = opts.assetBase ?? ".";
  // Any subset of the palette may be overridden; anything not supplied keeps
  // its default, so a caller can change one colour without restating the rest.
  const c = { ...DEFAULT_COLORS, ...(opts.colors ?? {}) };
  const iconStyle = opts.iconStyle ?? "image";

  // ---- Contact rows (right column) ----
  const rows = [];

  // Personal mobile/direct line — only if supplied (never invented).
  if (person.direct) {
    rows.push(
      contactRow(
        assetBase,
        "icon-mobile.png",
        phoneHtml(person.direct, person.directTel, c) + labelSpan(person.directLabel || "MOBILE", c),
        false,
        c,
        iconStyle,
      ),
    );
  }

  // Office line. Normally the shared main number, but a person may carry their
  // own `office`/`officeTel` — an exec with a direct line rather than the main
  // switchboard. Both must be overridden together, or the displayed number and
  // the tel: link would disagree.
  //
  // A falsy value drops the row rather than printing an empty one. Every roster
  // person inherits `shared.office`, so this only ever bites in the signature
  // builder, where office and fax are typed in per build and may be left blank.
  const office = person.office ?? shared.office;
  const officeTel = person.officeTel ?? shared.officeTel;

  if (office) {
    rows.push(
      contactRow(assetBase, "icon-phone.png", phoneHtml(office, officeTel, c) + labelSpan("OFFICE", c), false, c, iconStyle),
    );
  }

  // Fax line (no link — fax numbers are not dialable).
  const fax = person.fax ?? shared.fax;
  if (fax) {
    rows.push(contactRow(assetBase, "icon-fax.png", esc(fax) + labelSpan("FAX", c), false, c, iconStyle));
  }

  // Website line. Optional like the rest — a signature with no website simply
  // has no globe row.
  if (shared.website || shared.websiteUrl) {
    const shown = shared.website || String(shared.websiteUrl).replace(/^https?:\/\//i, "");
    const href = shared.websiteUrl || `https://${shared.website}`;
    rows.push(
      contactRow(
        assetBase,
        "icon-globe.png",
        `<a href="${esc(href)}" style="color:${c.webLink};text-decoration:none;">${esc(shown)}</a>`,
        false,
        c,
        iconStyle,
      ),
    );
  }

  // Personal email line — only if supplied (never invented).
  if (person.email) {
    rows.push(
      contactRow(
        assetBase,
        "icon-email.png",
        `<a href="mailto:${esc(person.email)}" style="color:${c.emailLink};text-decoration:none;">${esc(person.email)}</a>`,
        true,
        c,
        iconStyle,
      ),
    );
  } else if (rows.length) {
    // Close the whitespace on whatever row ends up last when there is no email.
    rows[rows.length - 1] = rows[rows.length - 1].replaceAll("padding-bottom:10px", "padding-bottom:0");
  }

  // ---- Booking link ----
  // Opt-in per person: only someone who has their own booking link gets one.
  // A person with no `bookingUrl` gets no booking row at all, not an empty one.
  const bookingBlock = person.bookingUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" role="presentation" ` +
        `style="border-collapse:collapse;margin-top:24px;">` +
        `<tr><td valign="middle" style="padding:0;">` +
          `<a href="${esc(person.bookingUrl)}" style="font-family:${FONT};font-size:12px;` +
          `font-weight:bold;letter-spacing:2px;color:${c.bookLink};text-decoration:none;` +
          `border-bottom:2px solid ${c.bookAccent};padding-bottom:3px;white-space:nowrap;">` +
          `${esc(person.bookingLabel || "BOOK A MEETING")}&nbsp;&rarr;</a>` +
        `</td></tr>` +
      `</table>`
    : "";

  // No logo configured means no <img> at all, rather than a broken-image icon
  // sitting in everyone's signature. `logoFile` may be a bare filename resolved
  // against assetBase, or a full URL of the caller's own.
  const logoHtml = shared.logoFile
    ? `<img src="${esc(assetUrl(assetBase, shared.logoFile))}" alt="${esc(shared.company ?? "")}" width="176" height="55" style="display:block;width:176px;height:auto;border:0;margin-top:22px;" />`
    : "";

  // ---- Assemble ----
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" ` +
      `style="border-collapse:collapse;font-family:${FONT};">` +
      `<tr>` +
        // Left column: name, title, logo.
        `<td width="216" valign="top" style="width:216px;padding:0 32px 0 0;font-family:${FONT};">` +
          `<div style="font-family:${FONT};font-size:24px;line-height:1.1;font-weight:bold;color:${c.name};">${esc(person.name)}</div>` +
          // A blank title drops the line rather than printing an empty band.
          // Every roster person has one; the builder allows leaving it out.
          (person.title
            ? `<div style="font-family:${FONT};font-size:13px;font-weight:bold;color:${c.title};text-transform:uppercase;letter-spacing:1.5px;padding-top:8px;">${esc(person.title)}</div>`
            : "") +
          logoHtml +
        `</td>` +
        // Divider.
        `<td width="1" bgcolor="${c.divider}" style="width:1px;background:${c.divider};font-size:1px;line-height:1px;">&#160;</td>` +
        // Right column: contact rows + booking link.
        `<td valign="top" style="padding:2px 0 0 32px;font-family:${FONT};">` +
          `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">${rows.join("")}</table>` +
          bookingBlock +
        `</td>` +
      `</tr>` +
    `</table>`
  );
}

/**
 * Render the plain-text signature for one person.
 *
 * This is the mobile signature. Outlook for iOS/Android exposes a plain-text
 * signature field only, so the logo, icons and two-column layout cannot appear
 * there — see HANDOFF.md §2. Shape matches the approved text signatures:
 *
 *   Melody Lee, MA
 *   Primary Counselor | Your organisation
 *   Mobile: (555) 555-0134
 *   Office: (555) 555-0100        <- an exec may show their own line instead
 *   mlee@email.com
 *   https://www.email.com
 *   Book a meeting: <url>
 *
 * The booking line follows the same rule as the HTML: it appears only for a
 * person who has their own `bookingUrl`.
 *
 * @param {object} person  A roster person record.
 * @param {object} shared  roster.shared.
 * @returns {string} Plain text, newline-terminated.
 */
export function renderPlainText(person, shared) {
  const org = shared.company ?? "";
  const heading = [person.title, org].filter(Boolean).join(" | ");
  const lines = [person.name];
  if (heading) lines.push(heading);
  if (person.direct) {
    // "MOBILE" -> "Mobile:", "DIRECT" -> "Direct:". Derived from the same label
    // the HTML shows, so the two can never disagree about what a number is.
    const label = (person.directLabel || "MOBILE").toLowerCase();
    lines.push(`${label.charAt(0).toUpperCase() + label.slice(1)}: ${person.direct}`);
  }
  const office = person.office ?? shared.office;
  if (office) lines.push(`Office: ${office}`);
  if (person.email) lines.push(person.email);
  if (shared.websiteUrl || shared.website) lines.push(shared.websiteUrl || `https://${shared.website}`);
  if (person.bookingUrl) lines.push(`Book a meeting: ${person.bookingUrl}`);
  return lines.join("\n") + "\n";
}

/** Wrap a fragment in a minimal full HTML document (for browser preview). */
export function renderDocument(fragmentHtml, title) {
  return (
    `<!DOCTYPE html>\n<html lang="en">\n<head>\n` +
    `<meta charset="utf-8" />\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />\n` +
    `<title>${esc(title)}</title>\n</head>\n` +
    `<body style="margin:0;padding:40px;background:#ffffff;">\n` +
    fragmentHtml +
    `\n</body>\n</html>\n`
  );
}

export const _internal = { esc, assetUrl };
