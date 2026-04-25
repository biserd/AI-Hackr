import { Link } from "wouter";
import { motion } from "framer-motion";
import { Cpu, Calendar, ArrowLeft, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";

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
  /** Section outline — each entry becomes an h2 + bulleted talking points placeholder. */
  sections: Array<{ heading: string; bullets: string[] }>;
  /** Internal links the post should drive — companies and providers it ties back to. */
  related: {
    companies?: Array<{ name: string; slug: string }>;
    providers?: Array<{ name: string; slug: string }>;
    posts?: Array<{ title: string; slug: string }>;
  };
}

/**
 * Lightweight blog scaffold — a structured stub for each of the 12 SEO posts
 * in the Task #3 content moat. The body is intentionally brief: each section
 * is a heading + bullet-list outline rather than a full draft. Editorial
 * copy will be filled in after the first scan cycle has produced data to
 * cite. The scaffold ships every post with the SEO + JSON-LD plumbing,
 * internal-link block, and visual chrome already wired up.
 */
export function BlogPostScaffold(props: BlogPostScaffoldProps) {
  const { slug, title, description, publishedTime, displayDate, category, keywords, leads, sections, related } = props;
  const url = `https://aihackr.com/blog/${slug}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    author: { "@type": "Organization", name: "AIHackr" },
    publisher: {
      "@type": "Organization",
      name: "AIHackr",
      logo: { "@type": "ImageObject", url: "https://aihackr.com/favicon.png" },
    },
    datePublished: publishedTime,
    dateModified: publishedTime,
    mainEntityOfPage: url,
  };

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

      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-primary" />
              </div>
              <span className="font-display font-semibold text-lg">AIHackr</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/leaderboard" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Leaderboard</Link>
            <Link href="/stack" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Index</Link>
            <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Blog</Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          All posts
        </Link>

        <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <header className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-xs">{category}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {displayDate}
              </span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-4" data-testid="text-post-title">{title}</h1>
            <p className="text-muted-foreground text-lg">{description}</p>
          </header>

          <div className="prose prose-invert max-w-none">
            {leads.map((p, i) => (
              <p key={i} className="text-foreground/90 leading-relaxed mb-4">{p}</p>
            ))}

            {sections.map((s, i) => (
              <section key={i} className="mt-8">
                <h2 className="font-display text-xl font-bold mb-3">{s.heading}</h2>
                <ul className="list-disc list-outside pl-5 space-y-1.5 text-foreground/80">
                  {s.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </section>
            ))}

            <section className="mt-10 p-5 rounded-xl border border-primary/30 bg-primary/5">
              <h3 className="font-display text-lg font-bold mb-3">Live data behind this post</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Every claim above is derived from continuous scans tracked on the AIHackr leaderboard. Use these jump-off points to verify or extend the analysis:
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Link href="/leaderboard">
                    <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors">→ AI Leaderboard</Badge>
                  </Link>
                  <Link href="/stack">
                    <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors">→ Stack Index</Badge>
                  </Link>
                </div>
                {related.providers && related.providers.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Provider rollups</div>
                    <div className="flex flex-wrap gap-2">
                      {related.providers.map((p) => (
                        <Link key={p.slug} href={`/provider/${p.slug}`}>
                          <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors">{p.name}</Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {related.companies && related.companies.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Featured companies</div>
                    <div className="flex flex-wrap gap-2">
                      {related.companies.map((c) => (
                        <Link key={c.slug} href={`/stack/${c.slug}`}>
                          <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors">{c.name}</Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {related.posts && related.posts.length > 0 && (
              <section className="mt-10">
                <h3 className="font-display text-lg font-bold mb-3">Keep reading</h3>
                <div className="space-y-2">
                  {related.posts.map((p) => (
                    <Link key={p.slug} href={`/blog/${p.slug}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer group">
                        <span className="text-sm group-hover:text-primary transition-colors">{p.title}</span>
                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="mt-12 text-center">
            <Link href="/leaderboard">
              <Button variant="outline" data-testid="button-cta-leaderboard">
                See the live AI leaderboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </motion.article>
      </main>

      <footer className="border-t border-border mt-12 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>
            <Link href="/" className="text-primary hover:underline">AIHackr</Link> — AI provider intelligence for SaaS · <Link href="/stack" className="hover:underline">Index</Link> · <Link href="/leaderboard" className="hover:underline">Leaderboard</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
