import { Fragment, type ReactNode } from "react";

/**
 * Telegram-style formatting, stored as plain text so posts appear exactly as typed.
 * **bold**  _italic_  __underline__  ~~strike~~  ||spoiler||  `code`  ```block```  > quote  [text](https://url)
 * Rendered as React elements only (no raw HTML), so it is safe to show user content.
 */
export type FormatKind = "bold" | "italic" | "underline" | "strike" | "spoiler" | "code" | "pre" | "quote" | "link";

export const FORMAT_MARKERS: Record<Exclude<FormatKind, "quote" | "link" | "pre">, string> = {
  bold: "**",
  italic: "_",
  underline: "__",
  strike: "~~",
  spoiler: "||",
  code: "`",
};

const INLINE = /(\*\*[^*]+?\*\*|__[^_]+?__|~~[^~]+?~~|\|\|[^|]+?\|\||`[^`\n]+?`|_[^_\n]+?_|\[[^\]\n]+?\]\([^)\s]+?\))/g;

function safeUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function renderInline(text: string, key: string): ReactNode[] {
  const parts = text.split(INLINE);
  return parts.map((part, i) => {
    const k = `${key}-${i}`;
    if (i % 2 === 0) return <Fragment key={k}>{part}</Fragment>;
    if (part.startsWith("**")) return <strong key={k}>{renderInline(part.slice(2, -2), k)}</strong>;
    if (part.startsWith("__")) return <u key={k}>{renderInline(part.slice(2, -2), k)}</u>;
    if (part.startsWith("~~")) return <s key={k}>{renderInline(part.slice(2, -2), k)}</s>;
    if (part.startsWith("||")) return <span key={k} className="tg-spoiler" tabIndex={0}>{part.slice(2, -2)}</span>;
    if (part.startsWith("`")) return <code key={k} className="tg-code">{part.slice(1, -1)}</code>;
    if (part.startsWith("_")) return <em key={k}>{renderInline(part.slice(1, -1), k)}</em>;
    const m = part.match(/^\[(.+)\]\((.+)\)$/);
    const href = m?.[2] ? safeUrl(m[2]) : null;
    if (m && href) return <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-2">{m[1]}</a>;
    return <Fragment key={k}>{part}</Fragment>;
  });
}

export function FormattedText({ text, className }: { text: string; className?: string }) {
  const nodes: ReactNode[] = [];
  const blocks = text.split(/```/);
  blocks.forEach((block, bi) => {
    if (bi % 2 === 1) {
      nodes.push(<pre key={`pre-${bi}`} className="tg-pre">{block.replace(/^\n/, "")}</pre>);
      return;
    }
    const lines = block.split("\n");
    lines.forEach((line, li) => {
      const k = `${bi}-${li}`;
      if (line.startsWith("> ")) {
        nodes.push(<blockquote key={k} className="tg-quote">{renderInline(line.slice(2), k)}</blockquote>);
      } else {
        nodes.push(<Fragment key={k}>{renderInline(line, k)}{li < lines.length - 1 ? "\n" : ""}</Fragment>);
      }
    });
  });
  return <div className={`whitespace-pre-wrap break-words ${className ?? ""}`}>{nodes}</div>;
}
