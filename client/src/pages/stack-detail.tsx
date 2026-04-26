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
  Cloud,
  Workflow,
  Gauge,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import { toast } from "sonner";
import type { TrackedCompany, Scan, ProviderRollup } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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

// Map the scanner's enum-ish snake_case host codes onto the human labels we
// want on the page. Anything not in this map (e.g. a future provider like
// "groq_direct") falls back to a Title-Cased version so we never render the
// raw enum to users.
const INFERENCE_HOST_LABELS: Record<string, string> = {
  aws_bedrock: "AWS Bedrock",
  azure_openai: "Azure OpenAI",
  vertex_ai: "Google Vertex AI",
  google_agent_platform: "Google Agent Platform",
  openai_direct: "OpenAI (direct)",
  anthropic_direct: "Anthropic (direct)",
  google_direct: "Google (direct)",
  xai_direct: "xAI (direct)",
  mistral_direct: "Mistral (direct)",
  self_hosted: "Self-hosted",
  unknown: "Unknown",
};

function formatInferenceHost(host: string | null | undefined): string {
  if (!host) return "—";
  if (INFERENCE_HOST_LABELS[host]) return INFERENCE_HOST_LABELS[host];
  // Future-proof fallback: turn "foo_bar_baz" into "Foo Bar Baz".
  return host.split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

const FRAMEWORK_LABELS: Record<string, string> = {
  langchain: "LangChain",
  langgraph: "LangGraph",
  llamaindex: "LlamaIndex",
  crewai: "CrewAI",
  autogen: "AutoGen",
  semantic_kernel: "Semantic Kernel",
  mcp: "MCP",
};

function formatFramework(name: string): string {
  return FRAMEWORK_LABELS[name] || name;
}

function modelTierColor(tier: string): string {
  if (tier === "frontier") return "text-primary bg-primary/20 border-primary/30";
  if (tier === "balanced") return "text-secondary bg-secondary/20 border-secondary/30";
  if (tier === "efficiency") return "text-blue-500 bg-blue-500/20 border-blue-500/30";
  return "text-muted-foreground bg-muted border-border";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function StackDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<DetailResponse>({
    queryKey: [`/api/stack/${slug}`],
    enabled: Boolean(slug),
  });

  // Provider rollups — used on stub pages so the long-tail page still has
  // useful, contextual internal links into /provider/:slug. Only fetched
  // when needed (the stub render branch reads it).
  // /api/providers returns {providers: ProviderRollup[]} — unwrap to the array.
  const { data: rollupsResponse } = useQuery<{ providers: ProviderRollup[] }>({
    queryKey: ["/api/providers"],
    enabled: Boolean(slug),
  });
  const rollups = rollupsResponse?.providers;

  // Visitor-facing "bump my scan to the front of the queue" — POST to
  // /api/stack/:slug/bump-scan, then invalidate so the page refreshes
  // when the worker lands the scan.
  const bumpScan = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/stack/${slug}/bump-scan`, { method: "POST" });
      if (!res.ok) throw new Error("Bump failed");
      return res.json();
    },
    onSuccess: (r) => {
      if (r.alreadyScanned) {
        toast.success("This company has already been scanned — refresh to see it.");
      } else {
        toast.success("Bumped! The next worker tick (within 5 min) will scan this site.");
      }
      queryClient.invalidateQueries({ queryKey: [`/api/stack/${slug}`] });
    },
    onError: (err: Error) => toast.error(err.message),
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
  const isStub = !scan;
  const provider = scan?.aiProvider || "Pending detection";
  const conf = scan?.aiConfidence;

  // SEO copy diverges meaningfully when there's no scan yet — we never
  // claim a provider in the title/description for stub pages, otherwise
  // search engines would index a falsely-confident answer.
  const seoTitle = scan?.aiProvider
    ? `What AI does ${company.name} use? It's ${scan.aiProvider}`
    : isStub
      ? `${company.name} AI Stack — Scan in queue · AIHackr`
      : `${company.name} AI Stack — AIHackr Intelligence Report`;
  const seoDesc = scan?.aiProvider
    ? `${company.name} runs on ${scan.aiProvider}${scan.aiConfidence ? ` (${scan.aiConfidence} confidence)` : ""}${scan.aiGateway ? ` via ${scan.aiGateway}` : ""}. Full evidence trail, framework, hosting and stack changes — refreshed weekly.`
    : isStub
      ? `${company.name} (${company.domain}) is queued for an AIHackr scan. We'll publish the AI provider, model family, gateway, and full tech stack here within a week.`
      : `AIHackr's full AI provider intelligence report for ${company.name}: framework, hosting, payments, auth, analytics, plus the AI provider and model family.`;

  // Stub rows use the import/created timestamp as `dateModified` so search
  // engines see *something* — but we deliberately leave `headline`/`about`
  // free of provider claims until a scan completes.
  const dateForSchema = scan?.scannedAt
    ? new Date(scan.scannedAt).toISOString()
    : (company.importedAt ?? company.createdAt)
      ? new Date(company.importedAt ?? company.createdAt).toISOString()
      : undefined;

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
    datePublished: dateForSchema,
    dateModified: dateForSchema,
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

          {/* Stub callout — shown only when no scan has landed yet. We
              deliberately do NOT render fake provider/model/gateway cells
              for stub rows so search engines don't pick up a false claim. */}
          {isStub && (
            <Card className="mb-6 border-yellow-500/40 bg-yellow-500/5" data-testid="card-stub-callout">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="font-display text-lg font-bold mb-1" data-testid="text-stub-heading">
                      Scan in queue for {company.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      We've added <span className="font-mono text-foreground">{company.domain}</span> to the AIHackr index but
                      our scanner hasn't fingerprinted its production stack yet. The next worker tick will pick it up — most
                      newly imported companies are scanned within an hour. Bookmark this page; the AI provider, model family,
                      gateway, framework, hosting, payments, auth and analytics will appear here automatically.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => bumpScan.mutate()}
                        disabled={bumpScan.isPending}
                        data-testid="button-stub-bump-scan"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        {bumpScan.isPending ? "Bumping…" : "Request a priority scan"}
                      </Button>
                      <Link href="/leaderboard">
                        <Button variant="outline" size="sm" data-testid="button-stub-leaderboard">
                          See the live leaderboard
                        </Button>
                      </Link>
                      <Link href={`/stack?category=${encodeURIComponent(company.category)}`}>
                        <Button variant="outline" size="sm" data-testid="button-stub-category">
                          Browse {company.category}
                        </Button>
                      </Link>
                    </div>

                    {/* Provider rollup chips — internal links to /provider/:slug
                        so the long-tail stub page still has useful semantic links
                        for crawlers and visitors curious which provider this site
                        is most likely on. */}
                    {(rollups?.length ?? 0) > 0 && (
                      <div className="mt-4 pt-4 border-t border-yellow-500/20">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                          Likely AI providers we'll check for
                        </div>
                        <div className="flex flex-wrap gap-1.5" data-testid="stub-provider-rollups">
                          {(rollups ?? []).slice(0, 10).map((p) => (
                            <Link
                              key={p.slug}
                              href={`/provider/${p.slug}`}
                              data-testid={`link-provider-${p.slug}`}
                            >
                              <Badge
                                variant="outline"
                                className="hover-elevate active-elevate-2 cursor-pointer text-xs"
                              >
                                {p.name}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Headline answer — only shown once we have a real scan */}
          {!isStub && (
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

                {/* Advanced AI attributes — inference host, model tier, orchestration,
                    and agentic flag. Only renders if at least one signal landed,
                    so we don't show a row of em-dashes on lightly-instrumented sites. */}
                {(scan?.inferenceHost || scan?.modelTier || scan?.orchestrationFramework || scan?.isAgentic) && (
                  <div
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border"
                    data-testid="ai-advanced-attributes"
                  >
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Cloud className="w-3 h-3" /> Inference Host
                      </div>
                      <div className="text-base font-display font-semibold" data-testid="text-inference-host">
                        {formatInferenceHost(scan?.inferenceHost)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Gauge className="w-3 h-3" /> Model Tier
                      </div>
                      <div className="text-base font-display font-semibold" data-testid="text-model-tier">
                        {scan?.modelTier ? (
                          <Badge variant="outline" className={modelTierColor(scan.modelTier)}>
                            {capitalize(scan.modelTier)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Workflow className="w-3 h-3" /> Orchestration
                      </div>
                      <div className="text-base font-display font-semibold" data-testid="text-orchestration-framework">
                        {scan?.orchestrationFramework
                          ? formatFramework(scan.orchestrationFramework)
                          : "None detected"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Agentic
                      </div>
                      <div className="text-base font-display font-semibold" data-testid="text-is-agentic">
                        {scan?.isAgentic ? (
                          <Badge variant="outline" className="text-secondary bg-secondary/20 border-secondary/30">
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground bg-muted border-border">
                            No
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tech stack grid — only once a scan has filled it in */}
          {!isStub && (
            <>
              <h2 className="font-display text-xl font-bold mb-3 mt-8">Surrounding Stack</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                <TechCard icon={Code2} label="Framework" value={scan?.framework} confidence={scan?.frameworkConfidence} />
                <TechCard icon={Server} label="Hosting" value={scan?.hosting} confidence={scan?.hostingConfidence} />
                <TechCard icon={CreditCard} label="Payments" value={scan?.payments} confidence={scan?.paymentsConfidence} />
                <TechCard icon={Lock} label="Auth" value={scan?.auth} confidence={scan?.authConfidence} />
                <TechCard icon={BarChart3} label="Analytics" value={scan?.analytics} confidence={scan?.analyticsConfidence} />
                <TechCard icon={Sparkles} label="Support" value={scan?.support} confidence={scan?.supportConfidence} />
              </div>
            </>
          )}

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
