import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Cpu,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Clock,
  Info,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Hash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

/* ---------------- Reading time + word count ---------------- */

type ElementWithChildren = ReactElement<{ children?: ReactNode }>;

function getElementChildren(el: ElementWithChildren): ReactNode {
  return el.props?.children;
}

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (isValidElement(node)) {
    return extractText(getElementChildren(node as ElementWithChildren));
  }
  return "";
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/* ---------------- Content primitives ---------------- */

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="text-foreground/90 text-lg leading-relaxed mb-5 first:mt-0">
      {children}
    </p>
  );
}

export function Para({ children }: { children: ReactNode }) {
  return (
    <p className="text-foreground/85 leading-relaxed mb-4">{children}</p>
  );
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function H2({ children }: { children: ReactNode }) {
  const text = extractText(children);
  const id = slugifyHeading(text);
  return (
    <h2
      id={id}
      className="font-display text-2xl font-bold mt-10 mb-4 scroll-mt-24 group"
    >
      <a href={`#${id}`} className="no-underline">
        <span className="opacity-0 group-hover:opacity-60 transition-opacity mr-1 text-primary">
          <Hash className="w-4 h-4 inline -mt-1" />
        </span>
        {children}
      </a>
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-display text-lg font-semibold mt-7 mb-3">
      {children}
    </h3>
  );
}

export function BulletList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc list-outside pl-5 space-y-1.5 text-foreground/85 mb-5">
      {children}
    </ul>
  );
}

export function OrderedList({ children }: { children: ReactNode }) {
  return (
    <ol className="list-decimal list-outside pl-5 space-y-1.5 text-foreground/85 mb-5">
      {children}
    </ol>
  );
}

export function LI({ children }: { children: ReactNode }) {
  return <li className="leading-relaxed">{children}</li>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="text-foreground font-semibold">{children}</strong>;
}

export function Em({ children }: { children: ReactNode }) {
  return <em className="text-foreground/90 italic">{children}</em>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-[0.85em] px-1.5 py-0.5 rounded bg-muted text-foreground/90 border border-border/50">
      {children}
    </code>
  );
}

export function CodeBlock({
  children,
  language,
}: {
  children: ReactNode;
  language?: string;
}) {
  return (
    <div className="mb-5 rounded-lg border border-border bg-muted/40 overflow-hidden">
      {language && (
        <div className="px-4 py-1.5 text-xs text-muted-foreground border-b border-border/50 font-mono uppercase tracking-wide">
          {language}
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed text-foreground/90">
        <code>{children}</code>
      </pre>
    </div>
  );
}

type CalloutTone = "info" | "warning" | "tip" | "success";

const CALLOUT_STYLES: Record<
  CalloutTone,
  { border: string; bg: string; icon: ReactNode; label: string }
> = {
  info: {
    border: "border-primary/30",
    bg: "bg-primary/5",
    icon: <Info className="w-4 h-4 text-primary" />,
    label: "Note",
  },
  warning: {
    border: "border-orange-500/30",
    bg: "bg-orange-500/5",
    icon: <AlertTriangle className="w-4 h-4 text-orange-500" />,
    label: "Watch out",
  },
  tip: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    icon: <Lightbulb className="w-4 h-4 text-blue-500" />,
    label: "Tip",
  },
  success: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    label: "What we recommend",
  },
};

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: CalloutTone;
  title?: string;
  children: ReactNode;
}) {
  const style = CALLOUT_STYLES[tone];
  return (
    <aside
      className={`my-6 rounded-xl border ${style.border} ${style.bg} p-4`}
      data-testid={`callout-${tone}`}
    >
      <div className="flex items-center gap-2 mb-1.5 text-sm font-medium">
        {style.icon}
        <span>{title ?? style.label}</span>
      </div>
      <div className="text-sm text-foreground/85 leading-relaxed [&>p:last-child]:mb-0">
        {children}
      </div>
    </aside>
  );
}

export function Quote({
  children,
  attribution,
}: {
  children: ReactNode;
  attribution?: string;
}) {
  return (
    <blockquote className="my-6 border-l-2 border-primary/60 pl-4 italic text-foreground/85">
      <div>{children}</div>
      {attribution && (
        <footer className="mt-2 not-italic text-sm text-muted-foreground">
          — {attribution}
        </footer>
      )}
    </blockquote>
  );
}

export function DataTable({
  caption,
  headers,
  rows,
  testId,
}: {
  caption?: string;
  headers: string[];
  rows: Array<Array<ReactNode>>;
  testId?: string;
}) {
  return (
    <figure className="my-6">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table
          className="w-full text-sm"
          data-testid={testId ?? "table-data"}
        >
          <thead className="bg-muted/40 text-left">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className="px-3 py-2 font-medium text-foreground/80 border-b border-border"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-colors"
              >
                {r.map((cell, j) => (
                  <td
                    key={j}
                    className="px-3 py-2 text-foreground/85 align-top"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <figcaption className="mt-2 text-xs text-muted-foreground text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function StatGrid({
  items,
}: {
  items: Array<{ label: string; value: string; sub?: string }>;
}) {
  return (
    <div
      className="my-6 grid grid-cols-2 md:grid-cols-4 gap-3"
      data-testid="stat-grid"
    >
      {items.map((s, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-muted/20 p-4"
        >
          <div className="text-2xl font-display font-bold text-foreground">
            {s.value}
          </div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
            {s.label}
          </div>
          {s.sub && (
            <div className="text-xs text-muted-foreground/80 mt-1">
              {s.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const CHIP_CLASS =
  "inline-flex items-center align-baseline whitespace-nowrap rounded-md border [border-color:var(--badge-outline)] px-2 py-0.5 text-xs font-semibold text-foreground hover:bg-primary/10 transition-colors no-underline";

export function CompanyChip({ slug, name }: { slug: string; name: string }) {
  return (
    <Link
      href={`/stack/${slug}`}
      className={CHIP_CLASS}
      data-testid={`chip-company-${slug}`}
    >
      {name}
    </Link>
  );
}

export function ProviderChip({ slug, name }: { slug: string; name: string }) {
  return (
    <Link
      href={`/provider/${slug}`}
      className={CHIP_CLASS}
      data-testid={`chip-provider-${slug}`}
    >
      {name}
    </Link>
  );
}

export function CompanyChipRow({
  items,
  label,
}: {
  items: Array<{ slug: string; name: string }>;
  label?: string;
}) {
  return (
    <div className="my-4">
      {label && (
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {items.map((c) => (
          <CompanyChip key={c.slug} slug={c.slug} name={c.name} />
        ))}
      </div>
    </div>
  );
}

export function ProviderChipRow({
  items,
  label,
}: {
  items: Array<{ slug: string; name: string }>;
  label?: string;
}) {
  return (
    <div className="my-4">
      {label && (
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {items.map((p) => (
          <ProviderChip key={p.slug} slug={p.slug} name={p.name} />
        ))}
      </div>
    </div>
  );
}

export function Methodology({ children }: { children: ReactNode }) {
  return (
    <section
      className="mt-12 rounded-xl border border-border bg-muted/20 p-5"
      data-testid="methodology"
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
        Methodology
      </div>
      <div className="text-sm text-foreground/85 leading-relaxed [&>p]:mb-3 [&>p:last-child]:mb-0">
        {children}
      </div>
    </section>
  );
}

/* ---------------- Live data fetcher (used inside posts) ---------------- */

type LeaderboardRow = {
  slug: string;
  name: string;
  category?: string | null;
  aiProvider?: string | null;
  aiConfidence?: string | null;
};

export function useLeaderboard() {
  const [data, setData] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (cancelled) return;
        const rows: LeaderboardRow[] = Array.isArray(j)
          ? j
          : Array.isArray(j?.rows)
          ? j.rows
          : [];
        setData(rows);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);
  return { data, error };
}

type ProviderRow = {
  slug: string;
  name: string;
  description?: string | null;
  aliases?: string[] | null;
  sortOrder?: number | null;
};

export function useProviders() {
  const [data, setData] = useState<ProviderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/providers")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (cancelled) return;
        const rows: ProviderRow[] = Array.isArray(j?.providers)
          ? j.providers
          : Array.isArray(j)
          ? j
          : [];
        setData(rows);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);
  return { data, error };
}

/**
 * Inline directory of canonical AI provider rollups. Pulls from /api/providers
 * so the post stays accurate as we add or rename providers in the catalog.
 */
export function LiveProviderDirectory({
  emptyText = "Provider catalog will appear here once /api/providers responds.",
}: {
  emptyText?: string;
}) {
  const { data, error } = useProviders();
  const { data: leaderboard } = useLeaderboard();
  const counts = useMemo(() => {
    if (!leaderboard) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const r of leaderboard) {
      const key = (r.aiProvider ?? "").toLowerCase();
      if (!key) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [leaderboard]);

  if (error) {
    return (
      <Callout tone="info" title="Provider catalog temporarily unavailable">
        {emptyText}
      </Callout>
    );
  }
  if (!data) {
    return (
      <div
        className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
        data-testid="provider-directory-loading"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-lg border border-border bg-muted/20 animate-pulse"
          />
        ))}
      </div>
    );
  }
  const sorted = [...data].sort(
    (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
  );
  return (
    <figure className="my-6" data-testid="provider-directory">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sorted.map((p) => {
          const count = counts.get(p.slug.toLowerCase()) ?? 0;
          return (
            <Link
              key={p.slug}
              href={`/provider/${p.slug}`}
              className="block rounded-lg border border-border bg-muted/10 p-3 hover:border-primary/50 transition-colors no-underline"
              data-testid={`provider-card-${p.slug}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-display font-semibold text-foreground">
                  {p.name}
                </div>
                {count > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {count} live
                  </span>
                )}
              </div>
              {p.description && (
                <div className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {p.description}
                </div>
              )}
            </Link>
          );
        })}
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground text-center">
        Source: AIHackr provider catalog (/api/providers) joined to live
        leaderboard counts.
      </figcaption>
    </figure>
  );
}

export function LiveProviderShare({
  providers,
  emptyText = "Live provider share will appear here once the leaderboard finishes its current cycle.",
}: {
  providers: string[];
  emptyText?: string;
}) {
  const { data, error } = useLeaderboard();
  const counts = useMemo(() => {
    if (!data) return null;
    const total = data.filter((r) => !!r.aiProvider).length || 1;
    return providers.map((p) => {
      const n = data.filter(
        (r) => (r.aiProvider ?? "").toLowerCase() === p.toLowerCase(),
      ).length;
      return { provider: p, count: n, pct: Math.round((n / total) * 100) };
    });
  }, [data, providers]);

  if (error) {
    return (
      <Callout tone="info" title="Live data temporarily unavailable">
        {emptyText}
      </Callout>
    );
  }
  if (!counts) {
    return (
      <div
        className="my-6 rounded-lg border border-border bg-muted/20 p-4 animate-pulse"
        data-testid="live-share-loading"
      >
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p} className="flex items-center gap-3">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-3 flex-1 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <figure className="my-6" data-testid="live-share">
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
          Live share across tracked SaaS · {data?.length ?? 0} companies
        </div>
        <div className="space-y-2.5">
          {counts.map((c) => (
            <div key={c.provider} className="flex items-center gap-3 text-sm">
              <div className="w-32 text-foreground/85 truncate">{c.provider}</div>
              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary/70"
                  style={{
                    width: `${Math.max(2, (c.count / max) * 100)}%`,
                  }}
                />
              </div>
              <div className="w-16 text-right tabular-nums text-foreground/80">
                {c.count} · {c.pct}%
              </div>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground text-center">
        Source: AIHackr leaderboard, refreshed continuously.
      </figcaption>
    </figure>
  );
}

export function LiveCompaniesByProvider({
  provider,
  emptyText = "No companies currently fingerprinted on this provider.",
  max = 24,
}: {
  provider: string;
  emptyText?: string;
  max?: number;
}) {
  const { data, error } = useLeaderboard();
  if (error) {
    return (
      <Callout tone="info" title="Live data temporarily unavailable">
        Refresh in a minute — the leaderboard cycle is rebuilding.
      </Callout>
    );
  }
  if (!data) {
    return (
      <div className="my-4 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-6 w-20 rounded-md bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }
  const matches = data
    .filter((r) => (r.aiProvider ?? "").toLowerCase() === provider.toLowerCase())
    .slice(0, max);
  if (matches.length === 0) {
    return <Para>{emptyText}</Para>;
  }
  return (
    <div className="my-4">
      <div className="flex flex-wrap gap-2" data-testid="live-companies">
        {matches.map((c) => (
          <CompanyChip key={c.slug} slug={c.slug} name={c.name} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- Layout shell ---------------- */

export interface BlogPostLayoutProps {
  slug: string;
  title: string;
  description: string;
  publishedTime: string;
  /** ISO date — when the post was last edited. Defaults to publishedTime. */
  modifiedTime?: string;
  displayDate: string;
  category: string;
  keywords: string;
  /** Author/byline. Defaults to "AIHackr Research". */
  author?: string;
  related: {
    companies?: Array<{ name: string; slug: string }>;
    providers?: Array<{ name: string; slug: string }>;
    posts?: Array<{ title: string; slug: string }>;
  };
  body: ReactNode;
}

export function BlogPostLayout(props: BlogPostLayoutProps) {
  const {
    slug,
    title,
    description,
    publishedTime,
    modifiedTime,
    displayDate,
    category,
    keywords,
    author = "AIHackr Research",
    related,
    body,
  } = props;

  const url = `https://aihackr.com/blog/${slug}`;
  const wordCount = useMemo(() => countWords(extractText(body)), [body]);
  const readingMinutes = Math.max(2, Math.round(wordCount / 220));

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    author: { "@type": "Organization", name: author },
    publisher: {
      "@type": "Organization",
      name: "AIHackr",
      logo: {
        "@type": "ImageObject",
        url: "https://aihackr.com/favicon.png",
      },
    },
    datePublished: publishedTime,
    dateModified: modifiedTime ?? publishedTime,
    mainEntityOfPage: url,
    wordCount,
    articleSection: category,
    keywords: keywords.split(",").map((s) => s.trim()),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "AIHackr",
        item: "https://aihackr.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://aihackr.com/blog",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: url,
      },
    ],
  };

  // Build a section-jump rail from the H2s in the body.
  const sectionLinks = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    const walk = (node: ReactNode) => {
      Children.forEach(node, (child) => {
        if (!isValidElement(child)) return;
        const el = child as ElementWithChildren;
        if (el.type === H2) {
          const text = extractText(getElementChildren(el));
          out.push({ id: slugifyHeading(text), label: text });
        }
        const inner = getElementChildren(el);
        if (inner) walk(inner);
      });
    };
    walk(body);
    return out;
  }, [body]);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={title}
        description={description}
        url={url}
        type="article"
        publishedTime={publishedTime}
        keywords={keywords}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-primary" />
              </div>
              <span className="font-display font-semibold text-lg">
                AIHackr
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/leaderboard"
              className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline"
            >
              Leaderboard
            </Link>
            <Link
              href="/stack"
              className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline"
            >
              Index
            </Link>
            <Link
              href="/blog"
              className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline"
            >
              Blog
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <Link
          href="/blog"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All posts
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-10">
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="min-w-0"
          >
            <header className="mb-8">
              <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {category}
                </Badge>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {displayDate}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {readingMinutes} min read
                </span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">By {author}</span>
              </div>
              <h1
                className="font-display text-3xl md:text-4xl font-bold mb-4 leading-tight"
                data-testid="text-post-title"
              >
                {title}
              </h1>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {description}
              </p>
            </header>

            <div
              className="max-w-none prose prose-invert prose-headings:font-display"
              data-testid="post-body"
            >
              {body}
            </div>

            <section
              className="mt-12 p-5 rounded-xl border border-primary/30 bg-primary/5"
              data-testid="related-rail"
            >
              <h3 className="font-display text-lg font-bold mb-3">
                Live data behind this post
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Every claim above is grounded in continuous scans on the AIHackr
                leaderboard. Use these jump-off points to verify or extend the
                analysis:
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Link href="/leaderboard">
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 transition-colors"
                    >
                      → AI Leaderboard
                    </Badge>
                  </Link>
                  <Link href="/stack">
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 transition-colors"
                    >
                      → Stack Index
                    </Badge>
                  </Link>
                </div>
                {related.providers && related.providers.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
                      Provider rollups
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {related.providers.map((p) => (
                        <Link key={p.slug} href={`/provider/${p.slug}`}>
                          <Badge
                            variant="outline"
                            className="cursor-pointer hover:bg-primary/10 transition-colors"
                          >
                            {p.name}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {related.companies && related.companies.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
                      Featured companies
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {related.companies.map((c) => (
                        <Link key={c.slug} href={`/stack/${c.slug}`}>
                          <Badge
                            variant="outline"
                            className="cursor-pointer hover:bg-primary/10 transition-colors"
                          >
                            {c.name}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {related.posts && related.posts.length > 0 && (
              <section className="mt-10">
                <h3 className="font-display text-lg font-bold mb-3">
                  Keep reading
                </h3>
                <div className="space-y-2">
                  {related.posts.map((p) => (
                    <Link key={p.slug} href={`/blog/${p.slug}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer group">
                        <span className="text-sm group-hover:text-primary transition-colors">
                          {p.title}
                        </span>
                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-12 text-center">
              <Link href="/leaderboard">
                <Button variant="outline" data-testid="button-cta-leaderboard">
                  See the live AI leaderboard{" "}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.article>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              {sectionLinks.length > 0 && (
                <nav data-testid="toc">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
                    On this page
                  </div>
                  <ul className="space-y-2 text-sm">
                    {sectionLinks.map((s) => (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          className="text-foreground/70 hover:text-primary transition-colors block leading-snug"
                        >
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground/90 mb-1">
                  About AIHackr
                </div>
                AI provider intelligence for SaaS — fingerprint the LLM,
                gateway, and integration method behind any product, with live
                evidence.
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-border mt-12 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>
            <Link href="/" className="text-primary hover:underline">
              AIHackr
            </Link>{" "}
            — AI provider intelligence for SaaS ·{" "}
            <Link href="/stack" className="hover:underline">
              Index
            </Link>{" "}
            ·{" "}
            <Link href="/leaderboard" className="hover:underline">
              Leaderboard
            </Link>{" "}
            ·{" "}
            <Link href="/blog" className="hover:underline">
              Blog
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- Backwards-compatible scaffold ---------------- */

export interface BlogPostScaffoldProps {
  slug: string;
  title: string;
  description: string;
  publishedTime: string;
  displayDate: string;
  category: string;
  keywords: string;
  /** Lead paragraph(s). Each paragraph rendered as <p>. */
  leads: string[];
  /** Section outline — each entry becomes an h2 + bulleted talking points. */
  sections: Array<{ heading: string; bullets: string[] }>;
  related: BlogPostLayoutProps["related"];
}

/**
 * Legacy thin scaffold kept for any page that still passes the old
 * leads + bullet-section shape. New posts should call BlogPostLayout
 * directly with rich `body` JSX.
 */
export function BlogPostScaffold(props: BlogPostScaffoldProps) {
  const body = (
    <>
      {props.leads.map((p, i) => (
        <Lead key={i}>{p}</Lead>
      ))}
      {props.sections.map((s, i) => (
        <section key={i}>
          <H2>{s.heading}</H2>
          <BulletList>
            {s.bullets.map((b, j) => (
              <LI key={j}>{b}</LI>
            ))}
          </BulletList>
        </section>
      ))}
    </>
  );
  return (
    <BlogPostLayout
      slug={props.slug}
      title={props.title}
      description={props.description}
      publishedTime={props.publishedTime}
      displayDate={props.displayDate}
      category={props.category}
      keywords={props.keywords}
      related={props.related}
      body={body}
    />
  );
}
