/**
 * YouTube-like client-side search.
 *
 * Goals:
 * - Match related keywords (e.g. "maths" ↔ "math" ↔ "ganit", "phy" ↔ "physics").
 * - Tolerate typos (small edit distance) and word-boundary partials.
 * - Rank results: title hits > channel hits, exact phrase > all terms > any term.
 * - 100% client-side — zero backend cost.
 */

// Common Hinglish / exam-prep synonym groups. Any term in a group matches any other.
const SYNONYM_GROUPS: string[][] = [
  ["math", "maths", "mathematics", "ganit"],
  ["physics", "phy", "bhautiki"],
  ["chemistry", "chem", "rasayan"],
  ["biology", "bio", "jeev vigyan"],
  ["english", "eng", "angrezi"],
  ["hindi", "हिंदी"],
  ["reasoning", "reason"],
  ["gk", "general knowledge", "samanya gyan"],
  ["gs", "general studies"],
  ["current affairs", "current", "affairs", "ca"],
  ["history", "itihaas", "itihas"],
  ["geography", "geo", "bhugol"],
  ["polity", "political", "rajyavyavastha"],
  ["economy", "economics", "arthashastra"],
  ["ssc", "staff selection"],
  ["upsc", "ias", "ips"],
  ["neet", "medical"],
  ["jee", "iit", "engineering"],
  ["pcs", "state pcs"],
  ["ncert", "class"],
  ["lecture", "class", "lesson", "chapter"],
  ["previous year", "pyq", "pyqs"],
  ["mock", "test", "quiz"],
  ["live", "🔴"],
];

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "by",
  "is", "are", "ka", "ki", "ke", "se", "me", "hai", "ho",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // keep letters/numbers/space (unicode-safe)
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(" ").filter((t) => t && !STOP_WORDS.has(t));
}

/** Very light stemmer for English plurals / common suffixes. */
function stem(t: string): string {
  if (t.length <= 3) return t;
  if (t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.endsWith("es")) return t.slice(0, -2);
  if (t.endsWith("s")) return t.slice(0, -1);
  if (t.endsWith("ing") && t.length > 5) return t.slice(0, -3);
  if (t.endsWith("ed") && t.length > 4) return t.slice(0, -2);
  return t;
}

/** Levenshtein distance capped at `max` (early-exit for speed). */
function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Expand a token into itself + stem + synonyms. */
function expandToken(token: string): string[] {
  const base = stem(token);
  const set = new Set<string>([token, base]);
  for (const group of SYNONYM_GROUPS) {
    if (group.includes(token) || group.includes(base)) {
      for (const g of group) set.add(g);
    }
  }
  return Array.from(set);
}

interface Scorable {
  title: string;
  channel_name: string;
}

/**
 * Score a single video against the query. Higher is better; 0 means no match.
 * Ranking factors (roughly YouTube-like):
 *   +100 exact phrase in title
 *   +40  exact phrase in channel
 *   +20  per query token matched in title (exact or synonym)
 *   +8   per query token matched in channel
 *   +6   per token matched as prefix / partial word
 *   +3   per token matched via typo (edit distance ≤ 1 for len≥4, ≤2 for len≥7)
 *   -    stop-words ignored entirely
 */
export function scoreVideo<V extends Scorable>(video: V, queryTokens: string[], phrase: string): number {
  if (queryTokens.length === 0) return 1; // no query => all match

  const title = normalize(video.title);
  const channel = normalize(video.channel_name);
  const titleTokens = title.split(" ");
  const channelTokens = channel.split(" ");

  let score = 0;

  if (phrase && title.includes(phrase)) score += 100;
  if (phrase && channel.includes(phrase)) score += 40;

  for (const raw of queryTokens) {
    const variants = expandToken(raw);
    let matched = false;

    // Exact / synonym token match
    for (const v of variants) {
      if (titleTokens.includes(v)) { score += 20; matched = true; break; }
    }
    if (!matched) {
      for (const v of variants) {
        if (channelTokens.includes(v)) { score += 8; matched = true; break; }
      }
    }
    // Substring / prefix (e.g. "phy" → "physics")
    if (!matched) {
      for (const v of variants) {
        if (v.length >= 3 && (title.includes(v) || channel.includes(v))) {
          score += 6; matched = true; break;
        }
      }
    }
    // Typo tolerance
    if (!matched && raw.length >= 4) {
      const cap = raw.length >= 7 ? 2 : 1;
      const pool = raw.length >= 6 ? [...titleTokens, ...channelTokens] : titleTokens;
      for (const tt of pool) {
        if (Math.abs(tt.length - raw.length) > cap) continue;
        if (editDistance(tt, raw, cap) <= cap) { score += 3; break; }
      }
    }
  }

  return score;
}

export interface SmartSearchOptions {
  /** Return only videos scoring at least this much. Default 1. */
  minScore?: number;
  /** If true, require every non-stopword token to contribute some score. */
  requireAllTerms?: boolean;
}

/**
 * YouTube-like search: relevance-ranked, synonym-aware, typo-tolerant.
 * Returns matches sorted by score descending. Non-matching items are removed.
 */
export function smartSearch<V extends Scorable>(
  videos: readonly V[],
  query: string,
  opts: SmartSearchOptions = {},
): V[] {
  const q = normalize(query);
  if (!q) return videos.slice();

  const rawTokens = tokenize(query);
  if (rawTokens.length === 0) return videos.slice();

  // Teacher/channel-specific mode: if the query matches channel name(s),
  // restrict results to those channels so a teacher search only shows their videos.
  const channelMap = new Map<string, string>(); // normalized -> original
  for (const v of videos) {
    const key = normalize(v.channel_name);
    if (key && !channelMap.has(key)) channelMap.set(key, v.channel_name);
  }
  const matchedChannels = new Set<string>();
  for (const [normCh, origCh] of channelMap) {
    const chTokens = normCh.split(" ").filter(Boolean);
    if (normCh.includes(q) || q.includes(normCh)) {
      matchedChannels.add(origCh);
      continue;
    }
    const allIn = rawTokens.every((t) =>
      chTokens.some((c) => c === t || (t.length >= 3 && c.startsWith(t)) || (c.length >= 3 && t.startsWith(c))),
    );
    if (allIn) matchedChannels.add(origCh);
  }

  const channelLocked = matchedChannels.size > 0;
  const pool = channelLocked
    ? videos.filter((v) => matchedChannels.has(v.channel_name))
    : videos;

  const effectiveOpts = channelLocked ? { ...opts, requireAllTerms: false } : opts;
  const minScore = effectiveOpts.minScore ?? 1;
  const results: Array<{ v: V; s: number }> = [];

  for (const v of pool) {
    let s = scoreVideo(v, rawTokens, q);

    if (matchedChannels.has(v.channel_name)) s += 50;

    if (effectiveOpts.requireAllTerms) {
      const hay = `${normalize(v.title)} ${normalize(v.channel_name)}`;
      const ok = rawTokens.every((t) =>
        expandToken(t).some((x) => x.length >= 2 && hay.includes(x)),
      );
      if (!ok) s = 0;
    }

    // In channel-locked mode, keep every video from that teacher even if title score is 0.
    if (channelLocked || s >= minScore) {
      results.push({ v, s: Math.max(s, 1) });
    }
  }

  results.sort((a, b) => b.s - a.s);
  return results.map((r) => r.v);
}
