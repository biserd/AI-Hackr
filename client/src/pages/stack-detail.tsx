import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  XCircle,
  AlertCircle,
  Copy,
  Cloud,
  Workflow,
  Gauge,
  Zap,
  Shield,
  Eye,
  Info,
  TrendingUp,
  ArrowRight,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import { toast } from "sonner";
import type { TrackedCompany, Scan, ProviderRollup } from "@shared/schema";
import {
  isCdnProvider,
  computeVerdict,
  computeExecutiveSummary,
  computeIntelligenceScores,
  computeFindings,
  computeRecommendations,
  buildLlmMarginUrl,
  BADGE_TONE_CLASSES,
  type Verdict,
} from "@/lib/intelligence";

interface DetailResponse {
  company: TrackedCompany;
  latestScan: Scan | null;
  history: Scan[];
  similar: TrackedCompany[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

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

function formatInferenceHost(host: string | null | undefined): string | null {
  if (!host) return null;
  if (INFERENCE_HOST_LABELS[host]) return INFERENCE_HOST_LABELS[host];
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

// Per-field empty-state copy. Replaces bare "—" with copy that explains
// what the absence actually means — the brief is explicit that this is
// the difference between an intelligence profile and a failed scan.
const EMPTY_STATE_COPY: Record<string, string> = {
  Provider: "No browser-visible AI provider found",
  Model: "No model family exposed in public scan",
  Gateway: "No gateway confirmed from public evidence",
  Framework: "Frontend framework not fingerprinted",
  Hosting: "Hosting not detected",
  Payments: "No public payment provider detected",
  Auth: "No public auth provider detected",
  Analytics: "No public analytics detected",
  Support: "No public support platform detected",
};

// Keep tier color logic local — only used by the AI advanced attributes row.
function modelTierColor(tier: string): string {
  if (tier === "frontier") return "text-primary bg-primary/20 border-primary/30";
  if (tier === "balanced") return "text-secondary bg-secondary/20 border-secondary/30";
  if (tier === "efficiency") return "text-blue-500 bg-blue-500/20 border-blue-500/30";
  return "text-muted-foreground bg-muted border-border";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Component ───────────────────────────────────────────────────────────

export default function StackDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<DetailResponse>({
    queryKey: [`/api/stack/${slug}`],
    enabled: Boolean(slug),
  });

  const { data: rollupsResponse } = useQuery<{ providers: ProviderRollup[] }>({
    queryKey: ["/api/providers"],
    enabled: Boolean(slug),
  });
  const rollups = rollupsResponse?.providers;

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

  const { company, latestScan: scan, history, similar } = data;
  const isStub = !scan;

  // ── Intelligence reads ────────────────────────────────────────────────
  // Stub pages never get a verdict — we deliberately show the queue
  // callout instead so we don't claim anything about a site we haven't
  // scanned. Once a scan lands, the same lib used by /scan/:domain
  // computes the verdict, scores, findings and recs.
  const isCdn = !!(scan?.hosting && isCdnProvider(scan.hosting));
  const extraText = `${company.description ?? ""} ${company.category ?? ""}`;
  const verdict: Verdict | null = scan ? computeVerdict(scan, company.domain, isCdn, extraText) : null;
  const executiveSummary = scan && verdict ? computeExecutiveSummary(scan, company.domain, verdict) : "";
  const findings = scan ? computeFindings(scan, isCdn) : { found: [], missing: [] };
  const recommendations = scan && verdict ? computeRecommendations(verdict, scan, company.domain) : [];
  const scores = scan && verdict ? computeIntelligenceScores(scan, verdict) : [];
  const llmMarginUrl = scan ? buildLlmMarginUrl(scan, company.domain, "stack_profile") : "";

  // ── SEO + indexing ────────────────────────────────────────────────────
  // Per the brief: thin pages (no description, no category, no evidence,
  // verdict is just "pending") should be noindex. We're generous with
  // what counts as "indexable enough": any of (real description, real
  // verdict, ≥1 evidence item) is enough.
  const evidence = (scan?.evidence ?? {}) as Record<string, unknown>;
  const patterns = (evidence.patterns as string[] | undefined) ?? [];
  const networkDomains = (evidence.networkDomains as string[] | undefined) ?? [];
  const networkPaths = (evidence.networkPaths as string[] | undefined) ?? [];
  const pagesScanned = (evidence.pagesScanned as string[] | undefined) ?? [];
  const hasDescription = !!(company.description && company.description.trim().length > 20);
  const hasCategory = !!(company.category && company.category.trim().length > 0);
  const hasEvidence = patterns.length > 0 || networkDomains.length > 0 || (scan && (scan.framework || scan.hosting || scan.analytics));
  const hasVerdict = !!verdict && verdict.kind !== "scan_blocked";
  const indexable = hasDescription && hasCategory && (hasEvidence || hasVerdict);

  const seoTitle = scan?.aiProvider
    ? `What AI does ${company.name} use? It's ${scan.aiProvider}`
    : isStub
      ? `${company.name} AI Stack — Scan in queue · AIHackr`
      : verdict?.kind === "hidden_likely" || verdict?.kind === "behind_login_likely"
        ? `${company.name} AI Stack — provider hidden from public scan · AIHackr`
        : `${company.name} AI Stack — AIHackr Intelligence Report`;
  const seoDesc = scan?.aiProvider
    ? `${company.name} runs on ${scan.aiProvider}${scan.aiConfidence ? ` (${scan.aiConfidence} confidence)` : ""}${scan.aiGateway ? ` via ${scan.aiGateway}` : ""}. Full evidence trail, framework, hosting and stack changes — refreshed weekly.`
    : isStub
      ? `${company.name} (${company.domain}) is queued for an AIHackr scan. We'll publish the AI provider, model family, gateway, and full tech stack here within a week.`
      : verdict
        ? `${company.name} AI intelligence profile: ${verdict.title.toLowerCase()}. Full detection summary, evidence trail, and competitor comparison from AIHackr.`
        : `AIHackr's full AI provider intelligence report for ${company.name}.`;

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

  // Verdict states that warrant the "Why detection may be limited" card.
  const showLimitedDetectionCard =
    !!verdict &&
    (verdict.kind === "hidden_likely" ||
      verdict.kind === "behind_login_likely" ||
      verdict.kind === "insufficient_depth" ||
      verdict.kind === "scan_blocked" ||
      (isCdn && !scan?.aiProvider));

  // Embed badge: never show "Powered by Unknown". Show the badge only
  // when there's a meaningful signal to display — provider detected,
  // useful verdict, or queued-for-monitoring status.
  const showEmbedBadge =
    !!scan?.aiProvider || (verdict?.kind && verdict.kind !== "scan_blocked");
  const embedAltText = scan?.aiProvider
    ? `${company.name} runs on ${scan.aiProvider} — AIHackr`
    : verdict?.kind === "hidden_likely" || verdict?.kind === "behind_login_likely"
      ? `${company.name} AI provider not publicly visible — tracked by AIHackr`
      : `${company.name} AI stack monitored by AIHackr`;

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
      {!indexable && (
        <meta name="robots" content="noindex,follow" data-testid="meta-noindex" />
      )}
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
          {/* ─── Breadcrumb ───────────────────────────────────────── */}
          <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2" data-testid="breadcrumb">
            <Link href="/stack" className="hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
              Stack Index
            </Link>
            <span>·</span>
            <Link href={`/stack?category=${encodeURIComponent(company.category)}`} className="hover:text-foreground">
              {company.category}
            </Link>
          </nav>

          {/* ─── 1. Company Profile Header ─────────────────────────── */}
          <div className="rounded-2xl border border-dashed border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/5 p-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center font-display text-xl font-bold flex-shrink-0">
                  {company.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">AIHackr · AI Intelligence Profile</div>
                  <h1 className="font-display text-3xl font-bold" data-testid="text-company-name">{company.name}</h1>
                  {company.description && (
                    <p className="text-muted-foreground mt-1" data-testid="text-company-description">{company.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3 items-center">
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
                      <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-last-scanned">
                        <Calendar className="w-3 h-3" />
                        scanned {new Date(scan.scannedAt).toLocaleDateString()}
                      </span>
                    )}
                    {scan && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-scan-depth">
                        <Eye className="w-3 h-3" />
                        depth: {scan.scanPhases?.probe === "complete" ? "passive + render + probe" : scan.scanPhases?.render === "complete" ? "passive + render" : "passive"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
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
                {!isStub && (
                  <Link href={`/scan/${company.domain}`}>
                    <Button size="sm" className="w-full" data-testid="button-add-watchlist-header">
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      Watchlist
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            {pagesScanned.length > 1 && (
              <div className="mt-4 text-xs text-muted-foreground" data-testid="text-pages-scanned">
                <span className="font-medium">Pages scanned:</span>{" "}
                {pagesScanned.map((p, i) => (
                  <span key={p} className="inline-flex items-center">
                    <code className="px-1.5 py-0.5 rounded bg-muted text-foreground/80">{p}</code>
                    {i < pagesScanned.length - 1 && <span className="mx-1">·</span>}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ─── Stub callout (only when no scan landed yet) ───────── */}
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
                      We've added <span className="font-mono text-foreground">{company.domain}</span> to the AIHackr index
                      but our scanner hasn't fingerprinted its production stack yet. The next worker tick will pick it up —
                      most newly imported companies are scanned within an hour. Bookmark this page; the AI provider, model
                      family, gateway, framework, hosting, payments, auth and analytics will appear here automatically.
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

                    {(rollups?.length ?? 0) > 0 && (
                      <div className="mt-4 pt-4 border-t border-yellow-500/20">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                          Likely AI providers we'll check for
                        </div>
                        <div className="flex flex-wrap gap-1.5" data-testid="stub-provider-rollups">
                          {(rollups ?? []).slice(0, 10).map((p) => (
                            <Link key={p.slug} href={`/provider/${p.slug}`} data-testid={`link-provider-${p.slug}`}>
                              <Badge variant="outline" className="hover-elevate active-elevate-2 cursor-pointer text-xs">
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

          {/* ─── 2. AI Stack Verdict ───────────────────────────────── */}
          {!isStub && verdict && (
            <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  AI Stack Verdict
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-bold mb-3 leading-tight" data-testid="text-verdict-title">
                  {verdict.title}
                </h2>
                <p className="text-muted-foreground mb-4" data-testid="text-verdict-description">
                  {verdict.description}
                </p>
                <div className="flex flex-wrap gap-2 mb-5" data-testid="container-verdict-badges">
                  {verdict.badges.map((b, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2.5 py-1 rounded-full border ${BADGE_TONE_CLASSES[b.tone]}`}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-4 flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                      Best Next Action
                    </div>
                    <div className="text-sm font-medium" data-testid="text-best-next-action">
                      {verdict.bestNextAction}
                    </div>
                  </div>
                  <Link href={`/scan/${company.domain}`}>
                    <Button size="sm" data-testid="button-verdict-cta">
                      <Activity className="w-3.5 h-3.5 mr-1.5" />
                      Open scan workspace
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── 3. Detection Summary (5 scores) ───────────────────── */}
          {!isStub && scores.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  Detection Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" data-testid="container-intelligence-scores">
                  {scores.map((s) => (
                    <div key={s.label} data-testid={`score-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">{s.label}</div>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-2xl font-display font-bold">{s.value}</span>
                        <span className="text-xs text-muted-foreground">/100</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full ${
                            s.value >= 70 ? "bg-secondary" : s.value >= 40 ? "bg-yellow-500" : "bg-muted-foreground/40"
                          }`}
                          style={{ width: `${s.value}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground leading-snug">{s.caption}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── 4. AIHackr Detected (AI-specific cards) ───────────── */}
          {!isStub && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  AIHackr Detected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DetectionField
                    label="Provider"
                    value={scan?.aiProvider}
                    confidence={scan?.aiConfidence}
                    testId="detect-provider"
                  />
                  <DetectionField
                    label="Model"
                    value={scan?.inferredModel}
                    testId="detect-model"
                  />
                  <DetectionField
                    label="Gateway"
                    value={scan?.aiGateway}
                    testId="detect-gateway"
                  />
                </div>
                {(scan?.inferenceHost || scan?.modelTier || scan?.orchestrationFramework || scan?.isAgentic || scan?.aiTransport) && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border" data-testid="ai-advanced-attributes">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Cloud className="w-3 h-3" /> Inference Host
                      </div>
                      <div className="text-sm font-display font-semibold" data-testid="text-inference-host">
                        {formatInferenceHost(scan?.inferenceHost) || "Not fingerprinted from public assets"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Gauge className="w-3 h-3" /> Model Tier
                      </div>
                      <div className="text-sm font-display font-semibold" data-testid="text-model-tier">
                        {scan?.modelTier ? (
                          <Badge variant="outline" className={modelTierColor(scan.modelTier)}>
                            {capitalize(scan.modelTier)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Not classified</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Workflow className="w-3 h-3" /> Orchestration
                      </div>
                      <div className="text-sm font-display font-semibold" data-testid="text-orchestration-framework">
                        {scan?.orchestrationFramework
                          ? formatFramework(scan.orchestrationFramework)
                          : <span className="text-muted-foreground">None detected</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Agentic
                      </div>
                      <div className="text-sm font-display font-semibold" data-testid="text-is-agentic">
                        {scan?.isAgentic ? (
                          <Badge variant="outline" className="text-secondary bg-secondary/20 border-secondary/30">Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground bg-muted border-border">No</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6 pt-6 border-t border-border">
                  <TechCard icon={Code2} label="Framework" value={scan?.framework} confidence={scan?.frameworkConfidence} testId="tech-framework" />
                  <TechCard icon={Server} label="Hosting" value={scan?.hosting} confidence={scan?.hostingConfidence} testId="tech-hosting" />
                  <TechCard icon={CreditCard} label="Payments" value={scan?.payments} confidence={scan?.paymentsConfidence} testId="tech-payments" />
                  <TechCard icon={Lock} label="Auth" value={scan?.auth} confidence={scan?.authConfidence} testId="tech-auth" />
                  <TechCard icon={BarChart3} label="Analytics" value={scan?.analytics} confidence={scan?.analyticsConfidence} testId="tech-analytics" />
                  <TechCard icon={Sparkles} label="Support" value={scan?.support} confidence={scan?.supportConfidence} testId="tech-support" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── 5. Public Context (when verdict is hidden/behind login) ── */}
          {!isStub && verdict && (verdict.kind === "hidden_likely" || verdict.kind === "behind_login_likely" || verdict.kind === "insufficient_depth") && (
            <Card className="mb-6 border-blue-500/30 bg-blue-500/5" data-testid="card-public-context">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  Public Context
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {company.description
                    ? <><span className="text-foreground font-medium">{company.name}</span> publicly positions itself as: <span className="italic">{company.description.toLowerCase()}</span>. </>
                    : <><span className="text-foreground font-medium">{company.name}</span> is listed in the AIHackr index under <span className="font-medium">{company.category}</span>. </>}
                  AIHackr's public scan {scan?.hosting ? `confirms ${scan.hosting} edge protection and supporting infrastructure` : "ran successfully"}, but it did not expose direct browser-visible AI provider calls during this scan.
                </p>
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-blue-500/20">
                  This section reflects publicly disclosed positioning, not AIHackr-detected evidence. We do not make claims about provider, model, or gateway choices that the scanner did not directly observe.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ─── 6 + 7. What we found / What we did not find ─────── */}
          {!isStub && (findings.found.length > 0 || findings.missing.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {findings.found.length > 0 && (
                <Card data-testid="card-found">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-secondary" />
                      What we found
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {findings.found.map((f, i) => (
                        <li key={i} className="text-sm flex items-start gap-2" data-testid={`found-item-${i}`}>
                          <CheckCircle2 className="w-3.5 h-3.5 text-secondary flex-shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {findings.missing.length > 0 && (
                <Card data-testid="card-missing">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                      What we did not find
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {findings.missing.map((m, i) => (
                        <li key={i} className="text-sm flex items-start gap-2 text-muted-foreground" data-testid={`missing-item-${i}`}>
                          <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ─── 8. Why detection may be limited ─────────────────── */}
          {showLimitedDetectionCard && (
            <Card className="mb-6 border-yellow-500/30 bg-yellow-500/5" data-testid="card-limited-detection">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-yellow-500" />
                  Why detection may be limited
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Many mature AI products do not expose model provider calls directly in the browser. They often route prompts
                  through backend APIs, internal model routers, gateways, or authenticated product flows. A public scan can
                  identify visible signals, but may not reveal private server-to-server AI calls.
                </p>
                {isCdn && scan?.hosting && (
                  <p>
                    <span className="font-medium text-foreground">{scan.hosting}</span> sits in front of this site's origin,
                    which means we observe the edge layer, not the origin's outbound traffic. Provider calls from the origin to
                    OpenAI, Anthropic, or Google won't appear in our passive scan.
                  </p>
                )}
                {verdict?.kind === "behind_login_likely" && (
                  <p>
                    An authentication provider was detected on this site. AI features may only render after sign-in, which a
                    public scan cannot reach.
                  </p>
                )}
                {verdict?.kind === "insufficient_depth" && (
                  <p>
                    The passive scan only looked at landing-page HTML. An interactive probe is required to fire the actions
                    that would expose AI calls.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── 9. Detection Evidence (grouped) ─────────────────── */}
          {!isStub && (patterns.length > 0 || networkDomains.length > 0 || networkPaths.length > 0) && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-secondary" />
                  Detection Evidence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!scan?.aiProvider && (
                  <div className="text-xs text-muted-foreground italic" data-testid="text-evidence-disclaimer">
                    Supporting tech-stack evidence below — not AI-provider evidence.
                  </div>
                )}
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

          {/* ─── 10. AI Stack History ────────────────────────────── */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                AI Stack History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <>
                  <div className="space-y-2 mb-3" data-testid="container-history">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-center justify-between border-b border-border/50 last:border-0 pb-2 last:pb-0">
                        <div className="text-sm">
                          <span className="font-mono text-xs text-muted-foreground">
                            {new Date(h.scannedAt).toLocaleDateString()}
                          </span>
                          <span className="ml-3">
                            {h.aiProvider || <span className="text-muted-foreground italic">Provider not visible in public scan</span>}
                          </span>
                        </div>
                        {h.aiConfidence && (
                          <Badge variant="outline" className="text-xs">
                            {h.aiConfidence}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  {history.every((h) => !h.aiProvider) && (
                    <p className="text-xs text-muted-foreground pt-2 border-t border-border" data-testid="text-history-empty-state">
                      No meaningful AI stack changes detected yet. AIHackr will track future scans and highlight changes in
                      provider, gateway, model exposure, AI endpoints, and AI-related product copy.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-history">
                  No scan history yet. AIHackr will track future scans and highlight meaningful changes in provider, gateway,
                  model exposure, AI endpoints, and AI-related product copy.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ─── 11. Recommended Next Actions ────────────────────── */}
          {!isStub && recommendations.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-primary" />
                  Recommended Next Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2" data-testid="container-recommendations">
                  {recommendations.map((rec, i) => {
                    const cls = `flex items-start gap-3 p-3 rounded-lg border ${
                      rec.emphasis === "primary"
                        ? "border-primary/30 bg-primary/5"
                        : rec.emphasis === "secondary"
                          ? "border-secondary/30 bg-secondary/5"
                          : "border-border bg-card/50"
                    }`;
                    const inner = (
                      <>
                        <ArrowRight className={`w-4 h-4 mt-0.5 flex-shrink-0 ${rec.emphasis === "primary" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-sm flex-1">{rec.title}</span>
                        {rec.external && <ExternalLink className="w-3 h-3 text-muted-foreground" />}
                      </>
                    );
                    if (rec.href && rec.external) {
                      return (
                        <li key={i}>
                          <a href={rec.href} target="_blank" rel="noopener noreferrer" className={`${cls} hover-elevate active-elevate-2 cursor-pointer`} data-testid={`recommendation-${i}`}>
                            {inner}
                          </a>
                        </li>
                      );
                    }
                    if (rec.href) {
                      return (
                        <li key={i}>
                          <Link href={rec.href} className={`${cls} hover-elevate active-elevate-2 cursor-pointer block`} data-testid={`recommendation-${i}`}>
                            {inner}
                          </Link>
                        </li>
                      );
                    }
                    return (
                      <li key={i} className={cls} data-testid={`recommendation-${i}`}>{inner}</li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* ─── 12. Competitor Comparison CTA ───────────────────── */}
          {!isStub && (
            <Card className="mb-6 border-primary/30 bg-primary/5" data-testid="card-compare-cta">
              <CardContent className="pt-6 flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <h3 className="font-display font-bold text-lg mb-1">Compare {company.name} against competitors</h3>
                  <p className="text-sm text-muted-foreground">
                    A single scan shows what is visible today. A comparison shows whether this company's AI stack is more
                    exposed, more protected, cheaper, more advanced, or changing faster than others in its category.
                  </p>
                </div>
                <Link href={`/compare?domains=${encodeURIComponent(company.domain)}`}>
                  <Button data-testid="button-compare">
                    <TrendingUp className="w-4 h-4 mr-1.5" />
                    Compare competitors
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* ─── 13. Watchlist CTA ───────────────────────────────── */}
          {!isStub && (
            <Card className="mb-6 border-secondary/30 bg-secondary/5" data-testid="card-watchlist-cta">
              <CardContent className="pt-6 flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <h3 className="font-display font-bold text-lg mb-1">Monitor this AI stack over time</h3>
                  <p className="text-sm text-muted-foreground">
                    Get notified when AIHackr detects new AI endpoints, provider signals, gateway changes, model exposure,
                    pricing changes, or AI messaging changes.
                  </p>
                </div>
                <Link href={`/scan/${company.domain}`}>
                  <Button variant="default" data-testid="button-watchlist">
                    <Eye className="w-4 h-4 mr-1.5" />
                    Add to Watchlist
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* ─── 14. LLM Margin CTA ──────────────────────────────── */}
          {!isStub && (
            <Card className="mb-6 border-blue-500/30 bg-blue-500/5" data-testid="card-llm-margin-cta">
              <CardContent className="pt-6 flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <h3 className="font-display font-bold text-lg mb-1">
                    {scan?.aiProvider ? "Estimate the cost of this AI stack" : "Provider hidden? Model the cost scenarios"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {scan?.aiProvider
                      ? `Estimate the margin impact of this AI stack. Model cost-per-user, gross margin, power-user risk, and breakeven MAU in LLM Margin.`
                      : `Provider hidden? Model OpenAI, Anthropic, Gemini, and open-source cost scenarios to understand possible AI cost exposure.`}
                  </p>
                </div>
                <a href={llmMarginUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" data-testid="button-llm-margin">
                    Open LLM Margin
                    <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}

          {/* ─── 15. Embed Badge (only when meaningful) ──────────── */}
          {!isStub && showEmbedBadge && (
            <Card className="mb-6 border-secondary/30 bg-secondary/5">
              <CardHeader>
                <CardTitle className="text-base">Show off the stack</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Drop this badge anywhere — it always shows the freshest detection.
                </p>
                <div className="flex items-center gap-3">
                  <img src={`/badge/${company.slug}.svg`} alt={embedAltText} data-testid="img-badge" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `<a href="https://aihackr.com/stack/${company.slug}"><img src="https://aihackr.com/badge/${company.slug}.svg" alt="${embedAltText}"/></a>`
                      );
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
          )}

          {/* ─── Internal linking: Similar companies ─────────────── */}
          {similar.length > 0 && (
            <div className="mb-8">
              <h2 className="font-display text-xl font-bold mb-3">Similar in {company.category}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="container-similar">
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

          {/* ─── Internal linking: Provider rollups (always) ─────── */}
          {!isStub && (rollups?.length ?? 0) > 0 && (
            <div className="mb-8">
              <h2 className="font-display text-base font-semibold mb-3 text-muted-foreground">
                Browse by AI provider
              </h2>
              <div className="flex flex-wrap gap-1.5" data-testid="container-provider-links">
                {(rollups ?? []).slice(0, 12).map((p) => (
                  <Link key={p.slug} href={`/provider/${p.slug}`} data-testid={`link-rollup-${p.slug}`}>
                    <Badge variant="outline" className="hover-elevate active-elevate-2 cursor-pointer text-xs">
                      {p.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </main>

      <footer className="border-t border-border mt-12 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>
            <Link href="/leaderboard" className="hover:underline">AI Leaderboard</Link> ·{" "}
            <Link href="/stack" className="hover:underline">Full Index</Link> ·{" "}
            <Link href="/blog" className="hover:underline">Research</Link> ·{" "}
            <Link href="/compare" className="hover:underline">Compare</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function DetectionField({
  label,
  value,
  confidence,
  testId,
}: {
  label: string;
  value: string | null | undefined;
  confidence?: string | null;
  testId: string;
}) {
  if (value) {
    return (
      <div data-testid={testId}>
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
        <div className="text-2xl font-display font-bold flex items-center gap-2">{value}</div>
        {confidence && (
          <Badge variant="outline" className="mt-2 text-xs">
            {confidence} confidence
          </Badge>
        )}
      </div>
    );
  }
  return (
    <div data-testid={testId}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm text-muted-foreground italic leading-snug">
        {EMPTY_STATE_COPY[label] || "Not detected"}
      </div>
    </div>
  );
}

function TechCard({
  icon: Icon,
  label,
  value,
  confidence,
  testId,
}: {
  icon: typeof Code2;
  label: string;
  value: string | null | undefined;
  confidence?: string | null;
  testId?: string;
}) {
  return (
    <Card className="bg-muted/30 hover:border-primary/30 transition-colors" data-testid={testId}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
          <Icon className="w-3.5 h-3.5" />
          {label}
        </div>
        {value ? (
          <>
            <div className="font-display font-semibold text-base">{value}</div>
            {confidence && (
              <Badge variant="outline" className="mt-1.5 text-[10px]">
                {confidence}
              </Badge>
            )}
          </>
        ) : (
          <div className="text-xs text-muted-foreground italic leading-snug">
            {EMPTY_STATE_COPY[label] || "Not detected"}
          </div>
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
          <Link href="/compare" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Compare</Link>
          <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Blog</Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
