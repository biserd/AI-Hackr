import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import {
  Cpu,
  Bot,
  Code2,
  Server,
  CreditCard,
  Lock,
  BarChart3,
  ArrowLeft,
  ExternalLink,
  Calendar,
  Sparkles,
  History,
  CheckCircle2,
  AlertCircle,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import { toast } from "sonner";
import type { TrackedCompany, Scan } from "@shared/schema";

interface DetailResponse {
  company: TrackedCompany;
  latestScan: Scan | null;
  history: Scan[];
  similar: TrackedCompany[];
}

function confidenceColor(c: string | null | undefined): string {
  if (c === "High") return "text-secondary bg-secondary/20 border-secondary/30";
  if (c === "Medium") return "text-yellow-500 bg-yellow-500/20 border-yellow-500/30";
  if (c === "Low") return "text-orange-500 bg-orange-500/20 border-orange-500/30";
  return "text-muted-foreground bg-muted border-border";
}

export default function StackDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { data, isLoading } = useQuery<DetailResponse>({
    queryKey: [`/api/stack/${slug}`],
    enabled: Boolean(slug),
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading the report…</p>
      </div>
    );
  }

  const { company, latestScan, history, similar } = data;
  const scan = latestScan;
  const provider = scan?.aiProvider || "Pending detection";
  const conf = scan?.aiConfidence;

  const seoTitle = scan?.aiProvider
    ? `What AI does ${company.name} use? It's ${scan.aiProvider}`
    : `${company.name} AI Stack — AIHackr Intelligence Report`;
  const seoDesc = scan?.aiProvider
    ? `${company.name} runs on ${scan.aiProvider}${scan.aiConfidence ? ` (${scan.aiConfidence} confidence)` : ""}${scan.aiGateway ? ` via ${scan.aiGateway}` : ""}. Full evidence trail, framework, hosting and stack changes — refreshed weekly.`
    : `AIHackr's full AI provider intelligence report for ${company.name}: framework, hosting, payments, auth, analytics, plus the AI provider and model family.`;

  const techArticleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: seoTitle,
    description: seoDesc,
    author: { "@type": "Organization", name: "AIHackr" },
    publisher: {
      "@type": "Organization",
      name: "AIHackr",
      logo: { "@type": "ImageObject", url: "https://aihackr.com/favicon.png" },
    },
    datePublished: scan?.scannedAt ? new Date(scan.scannedAt).toISOString() : undefined,
    dateModified: scan?.scannedAt ? new Date(scan.scannedAt).toISOString() : undefined,
    mainEntityOfPage: `https://aihackr.com/stack/${company.slug}`,
    about: {
      "@type": "SoftwareApplication",
      name: company.name,
      url: company.url,
      applicationCategory: company.category,
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "AIHackr", item: "https://aihackr.com" },
      { "@type": "ListItem", position: 2, name: "Stack Index", item: "https://aihackr.com/stack" },
      { "@type": "ListItem", position: 3, name: company.name, item: `https://aihackr.com/stack/${company.slug}` },
    ],
  };

  const evidence = (scan?.evidence ?? {}) as Record<string, unknown>;
  const patterns = (evidence.patterns as string[] | undefined) ?? [];
  const networkDomains = (evidence.networkDomains as string[] | undefined) ?? [];
  const networkPaths = (evidence.networkPaths as string[] | undefined) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={seoTitle}
        description={seoDesc}
        url={`https://aihackr.com/stack/${company.slug}`}
        type="article"
        publishedTime={scan?.scannedAt ? new Date(scan.scannedAt).toISOString() : undefined}
        keywords={`${company.name} AI provider, what AI does ${company.name} use, ${company.name} tech stack, ${company.name} LLM, ${scan?.aiProvider || "AI"} customers`}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Nav />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Breadcrumb */}
          <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
            <Link href="/stack" className="hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
              Stack Index
            </Link>
            <span>·</span>
            <Link href={`/stack?category=${encodeURIComponent(company.category)}`} className="hover:text-foreground">
              {company.category}
            </Link>
          </nav>

          {/* Hero card */}
          <div className="rounded-2xl border border-dashed border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/5 p-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center font-display text-xl font-bold flex-shrink-0">
                  {company.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">AIHackr · AI Intelligence Report</div>
                  <h1 className="font-display text-3xl font-bold" data-testid="text-company-name">{company.name}</h1>
                  <p className="text-muted-foreground mt-1">{company.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <a
                      href={company.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1 text-primary hover:underline"
                      data-testid="link-company-site"
                    >
                      {company.domain}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <Badge variant="outline" className="text-xs">{company.category}</Badge>
                    {scan?.scannedAt && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        scanned {new Date(scan.scannedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`https://aihackr.com/stack/${company.slug}`);
                  toast.success("Link copied");
                }}
                data-testid="button-copy-link"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copy link
              </Button>
            </div>
          </div>

          {/* Headline answer */}
          <Card className="mb-6 border-primary/30">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Primary AI Provider</div>
                  <div className="text-2xl font-display font-bold flex items-center gap-2" data-testid="text-ai-provider">
                    <Bot className="w-5 h-5 text-primary" />
                    {provider}
                  </div>
                  {conf && (
                    <Badge variant="outline" className={`mt-2 ${confidenceColor(conf)}`}>
                      {conf} confidence
                    </Badge>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Inferred Model</div>
                  <div className="text-2xl font-display font-bold" data-testid="text-inferred-model">
                    {scan?.inferredModel || "—"}
                  </div>
                  {scan?.aiTransport && <div className="text-xs text-muted-foreground mt-1">Transport: {scan.aiTransport}</div>}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">AI Gateway / Path</div>
                  <div className="text-2xl font-display font-bold" data-testid="text-ai-gateway">
                    {scan?.aiGateway || "Direct API"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tech stack grid */}
          <h2 className="font-display text-xl font-bold mb-3 mt-8">Surrounding Stack</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            <TechCard icon={Code2} label="Framework" value={scan?.framework} confidence={scan?.frameworkConfidence} />
            <TechCard icon={Server} label="Hosting" value={scan?.hosting} confidence={scan?.hostingConfidence} />
            <TechCard icon={CreditCard} label="Payments" value={scan?.payments} confidence={scan?.paymentsConfidence} />
            <TechCard icon={Lock} label="Auth" value={scan?.auth} confidence={scan?.authConfidence} />
            <TechCard icon={BarChart3} label="Analytics" value={scan?.analytics} confidence={scan?.analyticsConfidence} />
            <TechCard icon={Sparkles} label="Support" value={scan?.support} confidence={scan?.supportConfidence} />
          </div>

          {/* Evidence */}
          {(patterns.length > 0 || networkDomains.length > 0 || networkPaths.length > 0) && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-secondary" />
                  Detection Evidence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {patterns.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Signals matched</div>
                    <div className="flex flex-wrap gap-1.5">
                      {patterns.slice(0, 30).map((p, i) => (
                        <code key={i} className="text-xs px-2 py-0.5 rounded bg-muted/50 border border-border font-mono text-muted-foreground">
                          {p}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
                {networkDomains.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">External domains</div>
                    <div className="flex flex-wrap gap-1.5">
                      {networkDomains.slice(0, 20).map((d, i) => (
                        <code key={i} className="text-xs px-2 py-0.5 rounded bg-primary/10 border border-primary/20 font-mono text-primary">
                          {d}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI stack history */}
          {history.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  AI Stack History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between border-b border-border/50 last:border-0 pb-2 last:pb-0">
                      <div className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground">
                          {new Date(h.scannedAt).toLocaleDateString()}
                        </span>
                        <span className="ml-3">{h.aiProvider || "Unknown"}</span>
                      </div>
                      {h.aiConfidence && (
                        <Badge variant="outline" className={`text-xs ${confidenceColor(h.aiConfidence)}`}>
                          {h.aiConfidence}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Embed/badge */}
          <Card className="mb-8 border-secondary/30 bg-secondary/5">
            <CardHeader>
              <CardTitle className="text-base">Show off the stack</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Drop this badge anywhere — it always shows the freshest detection.
              </p>
              <div className="flex items-center gap-3">
                <img src={`/badge/${company.slug}.svg`} alt={`${company.name} AI badge`} data-testid="img-badge" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`<a href="https://aihackr.com/stack/${company.slug}"><img src="https://aihackr.com/badge/${company.slug}.svg" alt="${company.name} runs on ${provider} — AIHackr"/></a>`);
                    toast.success("Embed code copied");
                  }}
                  data-testid="button-copy-embed"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy embed
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Similar */}
          {similar.length > 0 && (
            <div className="mb-8">
              <h2 className="font-display text-xl font-bold mb-3">Similar in {company.category}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {similar.map((s) => (
                  <Link key={s.slug} href={`/stack/${s.slug}`}>
                    <Card className="cursor-pointer hover:border-primary/50 transition-colors" data-testid={`card-similar-${s.slug}`}>
                      <CardContent className="pt-4 pb-4">
                        <div className="font-display font-semibold">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.domain}</div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!scan && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="pt-5 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  This company is in the queue but hasn't been scanned yet. Check back within a day.
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>

      <footer className="border-t border-border mt-12 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>
            <Link href="/leaderboard" className="hover:underline">AI Leaderboard</Link> · <Link href="/stack" className="hover:underline">Full Index</Link> · <Link href="/blog" className="hover:underline">Research</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

function TechCard({
  icon: Icon,
  label,
  value,
  confidence,
}: {
  icon: typeof Code2;
  label: string;
  value: string | null | undefined;
  confidence?: string | null;
}) {
  return (
    <Card className="bg-muted/30 hover:border-primary/30 transition-colors">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
          <Icon className="w-3.5 h-3.5" />
          {label}
        </div>
        <div className="font-display font-semibold text-base">{value || "—"}</div>
        {confidence && (
          <Badge variant="outline" className={`mt-1.5 text-[10px] ${confidenceColor(confidence)}`}>
            {confidence}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function Nav() {
  return (
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
          <Link href="/stack" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Index</Link>
          <Link href="/leaderboard" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Leaderboard</Link>
          <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Blog</Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
