import type { ReactNode } from "react";

// Matches http(s) URLs and bare www. URLs.
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>()[\]{}'"]+[^\s<>()[\]{}'".,;:!?])/gi;

/**
 * Render text with clickable links. URLs open in a new tab with safe rel.
 * Whitespace/newlines are preserved by the caller via `whitespace-pre-line`.
 */
export function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) out.push(text.slice(lastIndex, start));
    const href = url.startsWith("www.") ? `https://${url}` : url;
    out.push(
      <a
        key={`lk-${key++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-500 underline decoration-sky-500/40 underline-offset-2 hover:text-sky-400 hover:decoration-sky-400"
      >
        {url}
      </a>,
    );
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}
