/**
 * Tier 2 wiki ingestion pipeline.
 *
 * Fetches raw wikitext from the Warframe Fandom MediaWiki API (bypassing
 * HTML scraping entirely, per spec) and chunks it into semantically coherent
 * segments for embedding.
 *
 * API endpoint:
 *   https://warframe.fandom.com/api.php
 *   ?action=query&prop=revisions&rvprop=content&rvslots=main
 *   &format=json&titles=<PageTitle>
 *
 * Chunking strategy:
 *   Wikitext is split on level-2 (==) and level-3 (===) section headers.
 *   This preserves semantic groupings — e.g. "Abilities", "Acquisition",
 *   "Damage" sections stay intact so mechanical interactions are not split
 *   across chunk boundaries. Chunks that exceed MAX_CHUNK_CHARS are further
 *   split on paragraph boundaries (\n\n) to stay within the embedding
 *   model's token budget (~8191 tokens for text-embedding-3-small).
 */

const MEDIAWIKI_API = "https://warframe.fandom.com/api.php";
const FETCH_TIMEOUT_MS = 15_000;

/** Approximate character limit per chunk. 1500 chars ≈ 375 tokens, well within the 8191 limit. */
const MAX_CHUNK_CHARS = 1_500;

/** Minimum chunk size — discard sections that are just a header with no content. */
const MIN_CHUNK_CHARS = 40;

// ── MediaWiki API types ───────────────────────────────────────────────────────

interface MediaWikiRevisionSlot {
  contentmodel: string;
  contentformat: string;
  "*": string; // raw wikitext
}

interface MediaWikiRevision {
  slots?: { main?: MediaWikiRevisionSlot };
  "*"?: string; // legacy format fallback
}

interface MediaWikiPage {
  pageid?: number;
  missing?: string;
  revisions?: MediaWikiRevision[];
}

interface MediaWikiQueryResponse {
  query?: {
    pages?: Record<string, MediaWikiPage>;
  };
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

/**
 * Fetches raw wikitext for a single page title.
 * Returns null if the page does not exist or the request fails.
 */
export async function fetchWikitext(pageTitle: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    format: "json",
    formatversion: "2",
    titles: pageTitle,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${MEDIAWIKI_API}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        // Identify ourselves per MediaWiki bot policy
        "User-Agent": "ParazonApp/1.0 (https://github.com/voidxela/parazon-app; bot)",
      },
    });

    if (!res.ok) {
      console.warn(`[wiki] HTTP ${res.status.toString()} fetching "${pageTitle}"`);
      return null;
    }

    const data = (await res.json()) as MediaWikiQueryResponse;
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) {
      console.warn(`[wiki] page not found: "${pageTitle}"`);
      return null;
    }

    const revision = page.revisions?.[0];
    if (!revision) return null;

    // rvslots=main (formatversion=2) puts content in slots.main["*"]
    const wikitext = revision.slots?.main?.["*"] ?? revision["*"] ?? null;
    return wikitext ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[wiki] fetch error for "${pageTitle}": ${msg}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Wikitext cleaning ─────────────────────────────────────────────────────────

/**
 * Strips wikitext markup that adds noise without semantic value:
 *   - Templates: {{...}}
 *   - File/Image links: [[File:...]] [[Image:...]]
 *   - Category links: [[Category:...]]
 *   - Ref tags: <ref>...</ref>
 *   - HTML comments: <!-- ... -->
 *   - Infobox tables (start with {| ... |})
 *   - Remaining wiki link brackets: [[target|label]] → label, [[target]] → target
 *   - Bold/italic markup: '''...''' ''...''
 *
 * Preserves section headers (== ... ==) and plain prose.
 */
export function cleanWikitext(raw: string): string {
  let text = raw;

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Remove <ref> tags and their content
  text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  text = text.replace(/<ref[^>]*\/>/gi, "");

  // Remove infobox / table blocks (lines starting with {| through |})
  text = text.replace(/\{\|[\s\S]*?\|\}/g, "");

  // Remove templates {{...}} — non-greedy, handles nesting imperfectly but
  // good enough for the flat templates common in Warframe wiki pages
  // Two passes handles one level of nesting
  text = text.replace(/\{\{[^{}]*\}\}/g, "");
  text = text.replace(/\{\{[^{}]*\}\}/g, "");

  // Remove File/Image/Category links
  text = text.replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, "");

  // Unwrap wiki links: [[target|label]] → label, [[target]] → target
  text = text.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1");

  // Remove external link brackets: [http://... label] → label
  text = text.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1");
  text = text.replace(/\[https?:\/\/\S+\]/g, "");

  // Remove bold/italic markup
  text = text.replace(/'{2,3}/g, "");

  // Collapse excessive blank lines
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

// ── Chunker ───────────────────────────────────────────────────────────────────

export interface WikiChunk {
  /** Human-readable source label, e.g. "wiki:Saryn/Abilities" */
  readonly source: string;
  /** Plain text content ready for embedding */
  readonly content: string;
}

/**
 * Splits cleaned wikitext into semantically bounded chunks.
 *
 * Algorithm:
 *   1. Split on level-2 (==) and level-3 (===) section headers.
 *   2. Each section becomes a candidate chunk, prefixed with its header
 *      so the embedding carries the section context.
 *   3. Sections exceeding MAX_CHUNK_CHARS are further split on paragraph
 *      boundaries (\n\n), each sub-chunk also prefixed with the header.
 *   4. Chunks below MIN_CHUNK_CHARS are discarded.
 */
export function chunkWikitext(pageTitle: string, cleanedText: string): WikiChunk[] {
  const chunks: WikiChunk[] = [];

  // Split on == or === headers (capture the header line)
  const sectionPattern = /^(={2,3}[^=\n]+={2,3})\s*$/m;
  const parts = cleanedText.split(sectionPattern);

  // parts alternates: [preamble, header1, body1, header2, body2, ...]
  // Index 0 is the preamble (content before the first header)
  let i = 0;

  // Handle preamble (intro section before any header)
  const preamble = parts[0]?.trim() ?? "";
  if (preamble.length >= MIN_CHUNK_CHARS) {
    const subChunks = splitByParagraph(preamble, `wiki:${pageTitle}`);
    chunks.push(...subChunks);
  }
  i = 1;

  while (i < parts.length - 1) {
    const header = parts[i]?.trim() ?? "";
    const body = parts[i + 1]?.trim() ?? "";
    i += 2;

    if (!header) continue;

    // Derive a clean section label from the header markup
    const sectionLabel = header.replace(/^=+\s*/, "").replace(/\s*=+$/, "").trim();
    const source = `wiki:${pageTitle}/${sectionLabel}`;
    const fullText = `${sectionLabel}\n\n${body}`;

    if (fullText.length < MIN_CHUNK_CHARS) continue;

    if (fullText.length <= MAX_CHUNK_CHARS) {
      chunks.push({ source, content: fullText });
    } else {
      // Section is too large — split on paragraph boundaries
      const subChunks = splitByParagraph(fullText, source);
      chunks.push(...subChunks);
    }
  }

  return chunks;
}

/**
 * Splits a text block on double-newline paragraph boundaries.
 * Each resulting chunk is prefixed with the source label for context.
 */
function splitByParagraph(text: string, source: string): WikiChunk[] {
  const paragraphs = text.split(/\n\n+/);
  const result: WikiChunk[] = [];
  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 > MAX_CHUNK_CHARS && current.length > 0) {
      if (current.length >= MIN_CHUNK_CHARS) {
        result.push({ source, content: current.trim() });
      }
      current = trimmed;
    } else {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    }
  }

  if (current.length >= MIN_CHUNK_CHARS) {
    result.push({ source, content: current.trim() });
  }

  return result;
}

// ── Item description chunker ──────────────────────────────────────────────────

/**
 * Wraps a Tier 1 item description as a single chunk.
 * Used to embed item descriptions alongside wiki content.
 */
export function chunkItemDescription(
  itemName: string,
  description: string,
): WikiChunk | null {
  const content = `${itemName}\n\n${description}`.trim();
  if (content.length < MIN_CHUNK_CHARS) return null;
  return { source: `item:${itemName}`, content };
}

// ── Page list helpers ─────────────────────────────────────────────────────────

/**
 * Fetches wikitext for a list of page titles, returning chunks for all
 * successfully retrieved pages. Rate-limits to one request per 500ms to
 * respect Fandom's API guidelines.
 */
export async function fetchAndChunkPages(pageTitles: string[]): Promise<WikiChunk[]> {
  const allChunks: WikiChunk[] = [];

  for (const title of pageTitles) {
    const raw = await fetchWikitext(title);
    if (!raw) continue;

    const cleaned = cleanWikitext(raw);
    const chunks = chunkWikitext(title, cleaned);
    allChunks.push(...chunks);

    console.log(`[wiki] "${title}": ${chunks.length.toString()} chunks`);

    // Polite delay between requests
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  }

  return allChunks;
}
