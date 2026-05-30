/**
 * Lightweight HTML sanitiser for warframe-items description strings.
 *
 * The warframe-items dataset descriptions contain a limited set of HTML:
 *   - Inline tags: <b>, <i>, <em>, <strong>, <span>, <a>, <br>
 *   - HTML entities: &amp; &lt; &gt; &quot; &#39; &nbsp;
 *
 * We use sanitize-html with a strict allowlist rather than a regex stripper
 * so that nested or malformed markup is handled correctly.
 */

import sanitizeHtml from "sanitize-html";

/**
 * Strips all HTML tags and decodes entities, returning plain text.
 * Preserves newlines from <br> tags.
 */
export function stripHtml(raw: string | undefined): string {
  if (!raw) return "";

  // Replace <br> variants with a newline before stripping so we preserve
  // line breaks that carry semantic meaning in multi-line descriptions.
  const withNewlines = raw.replace(/<br\s*\/?>/gi, "\n");

  // allowedTags: [] strips all tags. sanitize-html decodes HTML entities by default.
  const stripped = sanitizeHtml(withNewlines, {
    allowedTags: [],
    allowedAttributes: {},
  });

  // Collapse runs of whitespace/newlines left by removed block tags
  return stripped.replace(/\n{3,}/g, "\n\n").trim();
}
