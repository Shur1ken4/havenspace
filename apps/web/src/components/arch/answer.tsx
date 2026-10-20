import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * Shows Arch's answer: paragraphs, bullet and numbered lists, **bold**, and
 * links. Built from plain React elements (never raw HTML); only links inside
 * HavenSpace (starting with "/") become clickable.
 */
export function Answer({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={`${list.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
        {list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    blocks.push(heading
      ? <p key={blocks.length} className="font-medium text-ink">{inline(heading[1])}</p>
      : <p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2.5 leading-relaxed">{blocks}</div>;
}

function inline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const href = m[2];
      parts.push(href.startsWith("/") && !href.startsWith("//")
        ? <Link key={m.index} href={href} className="text-primary-strong underline underline-offset-4">{m[1]}</Link>
        : m[1]);
    } else {
      parts.push(<strong key={m.index} className="font-medium text-ink">{m[3]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}
