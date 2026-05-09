import { useEffect, useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Code2,
  Server,
  CreditCard,
  Lock,
  BarChart3,
  Users,
  Cpu,
  Share2,
  ExternalLink,
  Loader2,
  ArrowLeft,
  Copy,
  Check,
  Zap,
  Timer,
  Gauge,
  Activity,
  Cloud,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Globe,
  Bot,
  Sparkles,
  Clock,
  Link2,
  Plus,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import type { Scan } from "@shared/schema";
import { useScan } from "@/hooks/use-scan";
import { useAuth } from "@/hooks/use-auth";
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
  type VerdictBadge,
  type IntelligenceScore,
  type Recommendation,
} from "@/lib/intelligence";

type ScanPhases = {
  passive: "pending" | "running" | "complete" | "failed";
  render: "pending" | "running" | "complete" | "failed" | "skipped";
  probe: "pending" | "running" | "complete" | "failed" | "locked";
};

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

function formatPattern(pattern: string): string {
  const parts = pattern.split(": ");
  if (parts.length >= 2) {
    const type = parts[0];
    const value = parts.slice(1).join(": ").replace(/\\\./g, ".").replace(/\.\*/g, "*");
    const typeLabels: Record<string, string> = {
      "header": "Header",
      "html": "HTML",
      "script_src": "Script",
      "meta": "Meta",
      "dns": "DNS"
    };
    return `${typeLabels[type] || type}: ${value.length > 30 ? value.slice(0, 30) + "..." : value}`;
  }
  return pattern.length > 35 ? pattern.slice(0, 35) + "..." : pattern;
}

function detectOriginHost(domains: string[], patterns?: string[]): { origin: string | null; confidence: string; evidence: string } {
  const hostingProviders = [
    { pattern: "replit", name: "Replit", evidenceHint: "replit.com asset" },
    { pattern: "vercel", name: "Vercel", evidenceHint: "vercel.app domain" },
    { pattern: "netlify", name: "Netlify", evidenceHint: "netlify.app domain" },
    { pattern: "heroku", name: "Heroku", evidenceHint: "herokuapp.com domain" },
    { pattern: "railway", name: "Railway", evidenceHint: "railway.app domain" },
    { pattern: "render.com", name: "Render", evidenceHint: "render.com domain" },
    { pattern: "fly.io", name: "Fly.io", evidenceHint: "fly.io domain" },
    { pattern: "amazonaws", name: "AWS", evidenceHint: "amazonaws.com domain" },
    { pattern: "cloudfront", name: "AWS CloudFront", evidenceHint: "cloudfront.net domain" },
  ];
  
  // Check network domains
  for (const domain of domains) {
    for (const provider of hostingProviders) {
      if (domain.toLowerCase().includes(provider.pattern)) {
        return { origin: provider.name, confidence: "Medium", evidence: `Observed ${provider.evidenceHint} in network activity` };
      }
    }
  }
  
  // Fallback: check patterns for origin hints
  if (patterns) {
    for (const pattern of patterns) {
      for (const provider of hostingProviders) {
        if (pattern.toLowerCase().includes(provider.pattern)) {
          return { origin: provider.name, confidence: "Low", evidence: `Found ${provider.pattern} in page patterns` };
        }
      }
    }
  }
  
  return { origin: null, confidence: "Low", evidence: "" };
}

function filterPlatformNoise(paths: string[], domains: string[], siteDomain: string): { paths: string[]; domains: string[] } {
  const noisePatterns = [
    "/cdn-cgi/",
    "/beacon.min.js",
    "/fonts.",
    "/gtag/",
    "/gtm.js",
    "/analytics.js",
  ];
  
  const filteredPaths = paths.filter(p => !noisePatterns.some(noise => p.includes(noise)));
  const filteredDomains = domains.filter(d => d !== siteDomain && !d.endsWith(siteDomain));
  
  return { paths: filteredPaths, domains: filteredDomains };
}

type ServiceGroup = {
  name: string;
  domains: string[];
  category: string;
};

function groupThirdPartyServices(scan: Scan, siteDomain: string): ServiceGroup[] {
  const vendorPatterns: { pattern: string; name: string; category: string }[] = [
    { pattern: "googletagmanager", name: "Google Tag Manager", category: "Analytics" },
    { pattern: "google-analytics", name: "Google Analytics", category: "Analytics" },
    { pattern: "analytics.google", name: "Google Analytics", category: "Analytics" },
    { pattern: "fonts.googleapis", name: "Google Fonts", category: "Fonts" },
    { pattern: "fonts.gstatic", name: "Google Fonts", category: "Fonts" },
    { pattern: "cloudflareinsights", name: "Cloudflare Insights", category: "Performance" },
    { pattern: "cdn.cloudflare", name: "Cloudflare CDN", category: "CDN" },
    { pattern: "replit", name: "Replit", category: "Hosting" },
    { pattern: "stripe", name: "Stripe", category: "Payments" },
    { pattern: "intercom", name: "Intercom", category: "Support" },
    { pattern: "crisp", name: "Crisp", category: "Support" },
    { pattern: "hotjar", name: "Hotjar", category: "Analytics" },
    { pattern: "segment", name: "Segment", category: "Analytics" },
    { pattern: "mixpanel", name: "Mixpanel", category: "Analytics" },
    { pattern: "amplitude", name: "Amplitude", category: "Analytics" },
    { pattern: "sentry", name: "Sentry", category: "Monitoring" },
    { pattern: "auth0", name: "Auth0", category: "Auth" },
    { pattern: "clerk", name: "Clerk", category: "Auth" },
  ];
  
  const domains = scan.evidence?.networkDomains || [];
  const grouped = new Map<string, string[]>();
  const categorized = new Map<string, string>();
  
  domains.forEach(domain => {
    if (domain.includes(siteDomain)) return;
    
    let matched = false;
    for (const v of vendorPatterns) {
      if (domain.toLowerCase().includes(v.pattern)) {
        const existing = grouped.get(v.name) || [];
        if (!existing.includes(domain)) existing.push(domain);
        grouped.set(v.name, existing);
        categorized.set(v.name, v.category);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const existing = grouped.get("Other") || [];
      existing.push(domain);
      grouped.set("Other", existing);
      categorized.set("Other", "Other");
    }
  });
  
  return Array.from(grouped.entries()).map(([name, domains]) => ({
    name,
    domains,
    category: categorized.get(name) || "Other",
  }));
}

function countThirdPartyServices(scan: Scan): number {
  try {
    const siteDomain = new URL(scan.url).hostname;
    const groups = groupThirdPartyServices(scan, siteDomain);
    return groups.length;
  } catch {
    return 0;
  }
}

function getConfidenceReason(scan: Scan, originHost: { origin: string | null; confidence: string }): string {
  const reasons: string[] = [];
  if (!scan.framework) reasons.push("framework not detected");
  if (originHost.confidence === "Low" || originHost.confidence === "Medium") reasons.push("origin inferred");
  if (!scan.aiProvider) reasons.push("no AI signal");
  
  if (reasons.length === 0) return "All detections confirmed";
  return reasons.slice(0, 2).join(", ");
}

// ════════════════════════════════════════════════════════════════════════════
// Intelligence-report helpers used to live here. They were extracted to
// `@/lib/intelligence` so /scan/:domain (this page) and /stack/:slug share
// one source of truth for the verdict, scores, findings and recommendations.
// The four human-readable artifacts a paying customer expects from a
// competitive-intelligence product are still:
//
//   1. A verdict (one-line answer + best next action)
//   2. An executive summary (one paragraph of plain-English interpretation)
//   3. A "what we found / what we didn't find" pair of lists
//   4. A set of context-aware recommended next actions
//
// We intentionally branch off two cheap-to-compute signals:
//   - whether scan.aiProvider is set
//   - whether the *brand itself* appears AI-positioned (hostname heuristic),
//     used to distinguish a hidden AI stack from a truly non-AI site
// ════════════════════════════════════════════════════════════════════════════

// (Types and helpers that previously lived here are now in
// `@/lib/intelligence` — this is the legacy marker preserved only so any
// future grep for "Six unknown-state buckets" still lands on the right
// module. See client/src/lib/intelligence.ts for the active code.)

export default function CardPage() {
  const [, cardParams] = useRoute("/card/:id");
  const [, domainParams] = useRoute("/scan/:domain");
  const [location] = useLocation();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [probeLoading, setProbeLoading] = useState(false);
  const { triggerProbeScan } = useScan();
  // Probe scan is Pro-only — we read plan tier here so every probe button on
  // this page can swap into a "Run AI Probe (Pro)" upgrade prompt for free
  // users instead of letting them click a button that the API will reject.
  const { user } = useAuth();
  const isPro = user?.planTier === "pro";

  const fetchScan = useCallback(async (identifier: string, byDomain = false, isPolling = false) => {
    try {
      const endpoint = byDomain 
        ? `/api/scan/domain/${encodeURIComponent(identifier)}`
        : `/api/scan/${identifier}`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error("Scan not found");
      }
      const data = await response.json();
      setScan(data);
      if (!isPolling) setLoading(false);
    } catch (err) {
      if (!isPolling) {
        setError(err instanceof Error ? err.message : "Failed to load scan");
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch - check if we're using domain or ID route
  useEffect(() => {
    if (domainParams?.domain) {
      fetchScan(decodeURIComponent(domainParams.domain), true);
    } else if (cardParams?.id) {
      fetchScan(cardParams.id, false);
    }
  }, [cardParams?.id, domainParams?.domain, fetchScan]);

  // Poll for updates while phases are in progress
  useEffect(() => {
    if (!scan) return;
    
    const phases = scan.scanPhases as ScanPhases | null;
    const isInProgress = phases && (
      phases.render === "pending" || 
      phases.render === "running" ||
      phases.probe === "pending" ||
      phases.probe === "running"
    );
    
    if (!isInProgress) return;
    
    const interval = setInterval(() => {
      if (domainParams?.domain) {
        fetchScan(decodeURIComponent(domainParams.domain), true, true);
      } else if (cardParams?.id) {
        fetchScan(cardParams.id, false, true);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [scan, cardParams?.id, domainParams?.domain, fetchScan]);

  const handleProbeScan = async () => {
    if (!scan) return;
    setProbeLoading(true);
    const success = await triggerProbeScan(scan.id);
    if (success) {
      // Start polling by re-fetching using whichever route the user landed on.
      if (domainParams?.domain) {
        fetchScan(decodeURIComponent(domainParams.domain), true, true);
      } else if (cardParams?.id) {
        fetchScan(cardParams.id, false, true);
      }
    }
    setProbeLoading(false);
  };

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const getPhaseIcon = (status: string) => {
    switch (status) {
      case "complete": return <Check className="w-3 h-3" />;
      case "running": return <Loader2 className="w-3 h-3 animate-spin" />;
      case "pending": return <RefreshCw className="w-3 h-3" />;
      case "failed": return <span className="text-xs">!</span>;
      case "locked": return <Lock className="w-3 h-3" />;
      default: return null;
    }
  };

  const getPhaseColor = (status: string) => {
    switch (status) {
      case "complete": return "bg-secondary/20 text-secondary border-secondary/30";
      case "running": return "bg-primary/20 text-primary border-primary/30 animate-pulse";
      case "pending": return "bg-muted text-muted-foreground border-border";
      case "failed": return "bg-destructive/20 text-destructive border-destructive/30";
      case "locked": return "bg-muted/50 text-muted-foreground/50 border-border";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading scan results...</p>
        </div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">Scan not found</h1>
          <p className="text-muted-foreground mb-6">{error || "This scan doesn't exist or has been removed."}</p>
          <Link href="/">
            <Button>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const hostname = getHostname(scan.url);
  const initials = hostname.slice(0, 2).toUpperCase();
  
  // Compute derived values
  const phases = scan.scanPhases as ScanPhases | null;
  const probeRan = phases?.probe === "complete";
  const renderRan = phases?.render === "complete";
  const thirdPartyCount = countThirdPartyServices(scan);
  const originHost = detectOriginHost(
    scan.evidence?.networkDomains || [],
    scan.evidence?.patterns
  );
  const isCdn = !!(scan.hosting && isCdnProvider(scan.hosting));
  const watchlistDomain = scan.domain || hostname.replace(/^www\./, "");

  // Intelligence-report derivations (verdict, summary, findings, recs).
  // These are pure functions of the scan, so we compute them inline rather
  // than memoizing — a re-render is dominated by framer-motion, not by these.
  const verdict = computeVerdict(scan, hostname, isCdn);
  const executiveSummary = computeExecutiveSummary(scan, hostname, verdict);
  const findings = computeFindings(scan, isCdn);
  const recommendations = computeRecommendations(verdict, scan, hostname);
  const intelligenceScores = computeIntelligenceScores(scan, verdict);
  const llmMarginUrl = buildLlmMarginUrl(scan, hostname);
  const chatUiFound = !!scan.evidence?.probeDiagnostics?.chatUiFound;
  const canRunProbe = phases?.probe === "locked" && phases?.render === "complete";

  // Format timestamp
  const scanDate = new Date(scan.scannedAt);
  const formattedTime = scanDate.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="min-h-screen bg-background py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div {...fadeIn} className="mb-8 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Home
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()} data-testid="button-rescan">
            <RefreshCw className="mr-2 w-4 h-4" />
            Rescan
          </Button>
        </motion.div>

        {/* Shareable AI Intelligence Report */}
        <motion.div
          {...fadeIn}
          transition={{ delay: 0.05 }}
          className="mb-4 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
                {initials}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">AIHackr · AI Intelligence Report</div>
                <div className="font-semibold">{hostname}</div>
              </div>
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <span className="px-2 py-0.5 rounded bg-muted">{isCdn ? scan.hosting : (scan.framework || "Framework not fingerprinted")}</span>
                {scan.analytics && <span className="px-2 py-0.5 rounded bg-muted">{scan.analytics}</span>}
                <span className="px-2 py-0.5 rounded bg-muted">{scan.aiProvider ? scan.aiProvider : "Browser-visible AI not found"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={copyShareLink} data-testid="button-copy-link">
                {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                <span className="hidden sm:inline ml-1">{copied ? "Copied!" : "Copy link"}</span>
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          {...fadeIn}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card overflow-hidden"
        >
          {/* Header with Phase Progress */}
          <div className="p-6 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                {initials}
              </div>
              <div className="flex-1">
                <h1 className="font-display text-xl font-bold">{hostname}</h1>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{formattedTime}</span>
                </div>
              </div>
            </div>
            
            {/* Phase Progress */}
            {phases && (
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getPhaseColor(phases.passive)}`}>
                  {getPhaseIcon(phases.passive)}
                  <span>Passive</span>
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getPhaseColor(phases.render)}`}>
                  {getPhaseIcon(phases.render)}
                  <span>Render</span>
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getPhaseColor(phases.probe)}`}>
                  {getPhaseIcon(phases.probe)}
                  <span>Probe</span>
                </span>
                
                {phases.probe === "locked" && phases.render === "complete" && (
                  isPro ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleProbeScan}
                      disabled={probeLoading}
                      className="ml-2 text-xs h-7 bg-secondary/10 border-secondary/30 text-secondary hover:bg-secondary/20"
                      data-testid="button-run-probe"
                    >
                      {probeLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                      Run AI Probe
                    </Button>
                  ) : (
                    <Link href="/login">
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2 text-xs h-7 bg-muted border-border text-muted-foreground hover:bg-muted/80"
                        data-testid="button-run-probe-upsell"
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        Run AI Probe (Pro)
                      </Button>
                    </Link>
                  )
                )}
              </div>
            )}
            
            <a href={scan.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
              {scan.url}
              <ExternalLink className="w-3 h-3" />
            </a>

            {/* Multi-page scan transparency: when the passive scan visited */}
            {/* more than just "/", show which paths contributed signals so */}
            {/* the user understands why the report covers what it covers. */}
            {(() => {
              const pages = (scan.evidence as { pagesScanned?: string[] } | null)?.pagesScanned;
              if (!pages || pages.length <= 1) return null;
              return (
                <div className="mt-2 text-xs text-muted-foreground" data-testid="text-pages-scanned">
                  <span className="font-medium">Pages scanned:</span>{" "}
                  {pages.map((p, i) => (
                    <span key={p} className="inline-flex items-center">
                      <code className="px-1.5 py-0.5 rounded bg-muted text-foreground/80">{p}</code>
                      {i < pages.length - 1 && <span className="mx-1">·</span>}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ─── 1. AI STACK VERDICT ─────────────────────────────────────── */}
          <div className="p-6 md:p-8 border-b border-border bg-gradient-to-br from-primary/10 via-background to-secondary/10">
            <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              AI Stack Verdict
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-3 leading-tight" data-testid="text-verdict-title">
              {verdict.title}
            </h2>
            <p className="text-sm md:text-base text-muted-foreground mb-5 leading-relaxed max-w-3xl">
              {verdict.description}
            </p>
            <div className="flex flex-wrap gap-2 mb-5" data-testid="container-verdict-badges">
              {verdict.badges.map((b, i) => (
                <span
                  key={i}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium ${BADGE_TONE_CLASSES[b.tone]}`}
                >
                  {b.label}
                </span>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-background/70 border border-border backdrop-blur-sm">
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Best next action
                </div>
                <div className="text-sm font-medium" data-testid="text-best-next-action">
                  {verdict.bestNextAction}
                </div>
              </div>
              {canRunProbe && verdict.kind !== "detected" ? (
                isPro ? (
                  <Button
                    onClick={handleProbeScan}
                    disabled={probeLoading}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    data-testid="button-verdict-probe"
                  >
                    {probeLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                    Run AI Probe
                  </Button>
                ) : (
                  <Link href="/login">
                    <Button
                      variant="outline"
                      className="border-primary/40 text-primary hover:bg-primary/10"
                      data-testid="button-verdict-probe-upsell"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Run AI Probe (Pro)
                    </Button>
                  </Link>
                )
              ) : (
                // For the "detected" state we steer to the new side-by-side
                // comparison page rather than the broad leaderboard, since
                // the user's mental model after seeing a verdict is "vs whom?".
                <Link href={`/compare?domains=${encodeURIComponent(hostname)}`}>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-verdict-compare">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Compare competitors
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* ─── 2. EXECUTIVE SUMMARY ────────────────────────────────────── */}
          <div className="p-6 md:p-8 border-b border-border">
            <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              Executive Summary
            </div>
            <p className="text-sm md:text-base leading-relaxed text-foreground/90" data-testid="text-executive-summary">
              {executiveSummary}
            </p>
          </div>

          {/* ─── 2b. INTELLIGENCE SCORES ─────────────────────────────────── */}
          {/* Five separate scores instead of one combined number — see */}
          {/* computeIntelligenceScores for the rationale. */}
          <div className="p-6 md:p-8 border-b border-border">
            <div className="flex items-center gap-2 mb-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
              Intelligence scores
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="grid-intelligence-scores">
              {intelligenceScores.map((s) => (
                <div
                  key={s.label}
                  className="p-3 rounded-lg border border-border bg-muted/20"
                  data-testid={`score-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    {s.label}
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold tabular-nums">{s.value}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.value >= 70 ? "bg-secondary" : s.value >= 40 ? "bg-primary" : "bg-muted-foreground/40"}`}
                      style={{ width: `${s.value}%` }}
                    />
                  </div>
                  <div className="mt-2 text-[11px] leading-snug text-muted-foreground">
                    {s.caption}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground/80">
              Five separate reads instead of one blended score, so you can tell apart "we don't know yet" from "we know there's no AI here".
            </p>
          </div>

          {/* ─── 3. WHAT WE FOUND / DID NOT FIND ─────────────────────────── */}
          <div className="p-6 md:p-8 border-b border-border grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-4 text-sm font-semibold">
                <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-secondary" />
                </div>
                What we found
              </div>
              <ul className="space-y-2" data-testid="list-found">
                {findings.found.map((item, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <Check className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4 text-sm font-semibold">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground text-sm leading-none">−</span>
                </div>
                What we did not find
              </div>
              {findings.missing.length > 0 ? (
                <ul className="space-y-2" data-testid="list-missing">
                  {findings.missing.map((item, i) => (
                    <li key={i} className="text-sm flex items-start gap-2 text-muted-foreground">
                      <span className="text-muted-foreground/70 mt-0.5 shrink-0">−</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  All scanned AI signal categories returned a positive match.
                </p>
              )}
              {findings.missing.length > 0 && (
                <p className="text-xs text-muted-foreground/80 mt-4 p-3 rounded-lg bg-muted/30 border border-border">
                  These are absences, not failures. AI may still be running server-side, behind login, or via backend
                  APIs that public scans cannot see. Run an AI Probe to test deeper interactions.
                </p>
              )}
            </div>
          </div>

          {/* ─── 4. AI STACK DETAILS ─────────────────────────────────────── */}
          <div className="p-6 md:p-8 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <Bot className={`w-5 h-5 ${scan.aiProvider ? "text-primary" : "text-muted-foreground"}`} />
              <h3 className="font-display text-lg font-semibold">AI Stack Details</h3>
              {scan.aiProvider ? (
                <span className="ml-auto text-xs px-3 py-1 rounded-full bg-secondary/20 text-secondary font-medium">
                  {scan.aiConfidence || "Medium"} confidence
                </span>
              ) : probeRan ? (
                <span className="ml-auto text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                  Probe complete
                </span>
              ) : null}
            </div>
            <div className={`p-4 md:p-5 rounded-xl ${scan.aiProvider ? "bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20" : "bg-muted/30 border border-border"}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <DetailRow
                  label="Provider"
                  value={scan.aiProvider || "No browser-visible AI provider found"}
                  highlight={!!scan.aiProvider}
                  tooltip={!scan.aiProvider ? "AI may still be running server-side, behind login, or via backend APIs. Public scans cannot see private server-to-server calls." : undefined}
                />
                <DetailRow
                  label="Gateway"
                  value={scan.aiGateway || "No AI gateway endpoint observed"}
                  highlight={!!scan.aiGateway}
                />
                <DetailRow
                  label="Streaming"
                  value={scan.aiTransport || "No SSE / WebSocket streaming signal observed"}
                  highlight={!!scan.aiTransport}
                />
                <DetailRow
                  label="Chat UI"
                  value={chatUiFound ? "Detected on rendered page" : "No public chat UI detected"}
                  highlight={chatUiFound}
                />
                <DetailRow
                  label="Frontend framework"
                  value={scan.framework || "Frontend framework not fingerprinted"}
                  highlight={!!scan.framework}
                />
                <DetailRow
                  label={isCdn ? "Origin (inferred)" : "Hosting"}
                  value={isCdn ? (originHost.origin || `Origin protected by ${scan.hosting}`) : (scan.hosting || "Hosting not fingerprinted")}
                  highlight={isCdn ? !!originHost.origin : !!scan.hosting}
                  subtitle={isCdn ? `behind ${scan.hosting}` : undefined}
                />
                {scan.inferredModel && (
                  <DetailRow label="Inferred model" value={scan.inferredModel} highlight wide />
                )}
                {scan.inferenceHost && (
                  <DetailRow label="Inference host" value={scan.inferenceHost} highlight />
                )}
                {scan.orchestrationFramework && (
                  <DetailRow label="Orchestration" value={scan.orchestrationFramework} highlight />
                )}
              </div>
            </div>
          </div>

          {/* ─── 5. RECOMMENDED NEXT ACTIONS ─────────────────────────────── */}
          <div className="p-6 md:p-8 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="font-display text-lg font-semibold">Recommended next actions</h3>
            </div>
            <ol className="space-y-2" data-testid="list-recommendations">
              {recommendations.map((rec, i) => {
                const inner = (
                  <div className="flex items-center gap-3 p-3 md:p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-colors group">
                    <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${rec.emphasis === "primary" ? "bg-primary text-primary-foreground" : rec.emphasis === "secondary" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground border border-border"}`}>
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium flex-1">{rec.title}</span>
                    {rec.href && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>
                );
                if (!rec.href) {
                  return <li key={i}>{inner}</li>;
                }
                if (rec.external) {
                  return (
                    <li key={i}>
                      <a href={rec.href} target="_blank" rel="noopener noreferrer" data-testid={`link-recommendation-${i}`}>
                        {inner}
                      </a>
                    </li>
                  );
                }
                return (
                  <li key={i}>
                    <Link href={rec.href} data-testid={`link-recommendation-${i}`}>
                      {inner}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* ─── 6. COMPETITIVE COMPARISON CTA ───────────────────────────── */}
          <div className="p-6 md:p-8 border-b border-border">
            <div className="rounded-2xl p-6 md:p-7 bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 border border-primary/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/20 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg md:text-xl font-bold mb-1.5">
                    Compare this SaaS against competitors
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    A single scan tells you what we found. A comparison shows whether this company's AI stack is
                    cheaper, more advanced, more protected, or more exposed than similar products.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/leaderboard">
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-compare-competitors">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Compare competitors
                      </Button>
                    </Link>
                    <Link href="/stack">
                      <Button variant="outline" data-testid="button-browse-stack">
                        Browse tracked SaaS
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── 7. LLM MARGIN CTA ───────────────────────────────────────── */}
          <div className="p-6 md:p-8 border-b border-border">
            <div className="rounded-2xl p-6 md:p-7 bg-gradient-to-br from-secondary/10 via-secondary/5 to-primary/10 border border-secondary/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-secondary/20 flex items-center justify-center">
                  <Gauge className="w-6 h-6 text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg md:text-xl font-bold mb-1.5">
                    Estimate AI cost impact
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {scan.aiProvider
                      ? "Detected provider signals can be used to estimate the margin impact of this AI stack. Model cost-per-user, gross margin, and breakeven MAU in LLM Margin."
                      : "Provider hidden? Model common OpenAI, Anthropic, Gemini, and open-source scenarios in LLM Margin to understand possible cost exposure."}
                  </p>
                  <a href={llmMarginUrl} target="_blank" rel="noopener noreferrer" data-testid="link-llm-margin">
                    <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {scan.aiProvider ? "Estimate margin impact" : "Model cost scenarios"}
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Probe Scan Metrics (kept where present) ─────────────────── */}
          <div className="p-6 md:p-8 pt-0">

            {/* Probe Scan Metrics */}
            {scan.scanMode === "probe" && (scan.ttft || scan.tps) && (
              <div className="p-6 rounded-xl bg-gradient-to-r from-secondary/20 to-primary/20 border border-secondary/30 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-6 h-6 text-secondary" />
                  <span className="font-semibold text-lg">Performance Metrics</span>
                  <span className="ml-auto text-xs px-3 py-1 rounded-full bg-primary/20 text-primary font-medium">
                    Probe Scan
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {scan.ttft && (
                    <div className="p-4 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Timer className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Time to First Token</span>
                      </div>
                      <span className="text-xl font-bold font-mono">{scan.ttft}</span>
                    </div>
                  )}
                  {scan.tps && (
                    <div className="p-4 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Gauge className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Tokens Per Second</span>
                      </div>
                      <span className="text-xl font-bold font-mono">{scan.tps}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Evidence */}
            {scan.evidence && (
              <div className="mt-8 space-y-6">
                <div>
                  <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Detection Evidence
                  </h3>
                  {!scan.aiProvider && (
                    <p className="text-xs text-muted-foreground mt-1">
                      These signals explain why we detected commodity tech, but they do not confirm an underlying AI provider.
                    </p>
                  )}
                </div>
                
                {/* Detection Signals */}
                {scan.evidence.patterns && scan.evidence.patterns.length > 0 && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Detection Signals</span>
                      <span className="ml-auto text-xs text-muted-foreground">{scan.evidence.patterns.length} patterns matched</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {scan.evidence.patterns.slice(0, 12).map((pattern, i) => (
                        <span key={i} className="px-2 py-1 rounded bg-background text-xs font-mono border border-border">
                          {formatPattern(pattern)}
                        </span>
                      ))}
                      {scan.evidence.patterns.length > 12 && (
                        <span className="px-2 py-1 text-xs text-muted-foreground">+{scan.evidence.patterns.length - 12} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Network Activity - Enhanced */}
                {((scan.evidence.networkDomains && scan.evidence.networkDomains.length > 0) ||
                  (scan.evidence.networkPaths && scan.evidence.networkPaths.length > 0)) && (() => {
                  const { paths, domains } = filterPlatformNoise(
                    scan.evidence.networkPaths || [],
                    scan.evidence.networkDomains || [],
                    hostname
                  );
                  const totalRequests = scan.evidence?.probeDiagnostics?.totalRequests || paths.length + domains.length * 2;
                  
                  // Separate first-party and third-party paths
                  const thirdPartyPaths = paths.filter(p => 
                    p.includes("/g/collect") || p.includes("/api.") || p.includes("analytics") || p.includes("gtm")
                  );
                  const firstPartyPaths = paths.filter(p => !thirdPartyPaths.includes(p));
                  
                  return (paths.length > 0 || domains.length > 0) && (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Server className="w-4 h-4 text-secondary" />
                        <span className="text-sm font-medium">Network Activity</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {totalRequests} requests · {domains.length} external domains
                        </span>
                      </div>
                      <div className="space-y-4">
                        {domains.length > 0 && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-2">External Domains</div>
                            <div className="flex flex-wrap gap-1">
                              {domains.slice(0, 8).map((domain, i) => (
                                <span key={i} className="px-2 py-0.5 rounded bg-primary/10 text-xs font-mono text-primary">
                                  {domain}
                                </span>
                              ))}
                              {domains.length > 8 && (
                                <span className="px-2 py-0.5 text-xs text-muted-foreground">+{domains.length - 8}</span>
                              )}
                            </div>
                          </div>
                        )}
                        {firstPartyPaths.length > 0 && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-2">First-party Paths</div>
                            <div className="flex flex-wrap gap-1">
                              {firstPartyPaths.slice(0, 4).map((path, i) => (
                                <span key={i} className="px-2 py-0.5 rounded bg-secondary/10 text-xs font-mono text-secondary">
                                  {path.length > 35 ? path.slice(0, 35) + "..." : path}
                                </span>
                              ))}
                              {firstPartyPaths.length > 4 && (
                                <span className="px-2 py-0.5 text-xs text-muted-foreground">+{firstPartyPaths.length - 4}</span>
                              )}
                            </div>
                          </div>
                        )}
                        {thirdPartyPaths.length > 0 && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-2">Third-party Paths</div>
                            <div className="flex flex-wrap gap-1">
                              {thirdPartyPaths.slice(0, 3).map((path, i) => (
                                <span key={i} className="px-2 py-0.5 rounded bg-muted text-xs font-mono">
                                  {path.length > 35 ? path.slice(0, 35) + "..." : path}
                                </span>
                              ))}
                              {thirdPartyPaths.length > 3 && (
                                <span className="px-2 py-0.5 text-xs text-muted-foreground">+{thirdPartyPaths.length - 3}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Window Hints */}
                {scan.evidence.windowHints && scan.evidence.windowHints.length > 0 && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Code2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Runtime Detection</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {scan.evidence.windowHints.map((hint, i) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-primary/20 text-xs font-mono text-primary">
                          {hint}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* WebSocket Connections */}
                {scan.evidence.websockets && scan.evidence.websockets.length > 0 && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-medium">WebSocket Connections</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {scan.evidence.websockets.map((ws, i) => (
                        <span key={i} className="px-2 py-1 rounded bg-yellow-500/10 text-xs font-mono text-yellow-600">
                          {ws}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Probe Coverage Diagnostics */}
                {probeRan && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Probe Coverage</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                      <div className="p-2 rounded bg-background/50 text-center">
                        <div className="text-secondary font-medium">
                          {scan.evidence?.probeDiagnostics?.pageLoaded !== false ? "Yes" : "No"}
                        </div>
                        <div className="text-muted-foreground">Page loaded</div>
                      </div>
                      <div className="p-2 rounded bg-background/50 text-center">
                        <div className="font-medium">
                          {scan.evidence?.probeDiagnostics?.elementsAttempted || 0}
                        </div>
                        <div className="text-muted-foreground">Candidates found</div>
                      </div>
                      <div className="p-2 rounded bg-background/50 text-center">
                        <div className="font-medium">
                          {scan.evidence?.probeDiagnostics?.elementsClicked || 0}
                        </div>
                        <div className="text-muted-foreground">Clicked</div>
                      </div>
                      <div className="p-2 rounded bg-background/50 text-center">
                        <div className={`font-medium ${scan.evidence?.probeDiagnostics?.chatUiFound ? "text-secondary" : ""}`}>
                          {scan.evidence?.probeDiagnostics?.chatUiFound ? "Yes" : "No"}
                        </div>
                        <div className="text-muted-foreground">Chat UI found</div>
                      </div>
                      <div className="p-2 rounded bg-background/50 text-center">
                        <div className="font-medium">
                          {scan.evidence?.probeDiagnostics?.totalRequests || (scan.evidence?.networkDomains?.length || 0) * 3}
                        </div>
                        <div className="text-muted-foreground">Requests</div>
                      </div>
                    </div>
                    {(scan.evidence?.probeDiagnostics?.elementsAttempted === 0) && (
                      <div className="mt-3 text-xs text-muted-foreground/80 p-2 rounded bg-background/30 border border-border">
                        No chat UI candidates found. Try probing a specific path like /chat or /assistant.
                      </div>
                    )}
                  </div>
                )}

                {/* Third-Party Services - Grouped by Vendor */}
                {(() => {
                  const serviceGroups = groupThirdPartyServices(scan, hostname);
                  return serviceGroups.length > 0 && (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Services detected ({serviceGroups.length})</span>
                      </div>
                      <div className="space-y-2">
                        {serviceGroups.filter(g => g.name !== "Other").map((group, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded bg-background/50">
                            <span className="text-xs text-muted-foreground w-20">{group.category}</span>
                            <span className="text-sm font-medium">{group.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {group.domains.length > 1 ? `${group.domains.length} domains` : group.domains[0]}
                            </span>
                          </div>
                        ))}
                        {serviceGroups.find(g => g.name === "Other") && (
                          <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                            +{serviceGroups.find(g => g.name === "Other")?.domains.length || 0} other domains
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ─── 9. COMMODITY TECH STACK (demoted to bottom) ─────────────── */}
          {(scan.framework || scan.hosting || scan.payments || scan.auth || scan.analytics || scan.support) && (
            <div className="p-6 md:p-8 border-t border-border bg-muted/10">
              <div className="flex items-center gap-2 mb-1">
                <Cloud className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-display text-lg font-semibold">Commodity tech stack</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-5">
                Supporting tech-stack evidence, not AI-provider evidence. Useful context, but not the headline result.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {scan.framework && (
                  <TechCard icon={Code2} label="Framework" value={scan.framework} confidence={scan.frameworkConfidence} />
                )}
                {scan.hosting && (
                  <TechCard
                    icon={isCdnProvider(scan.hosting) ? Cloud : Server}
                    label={isCdnProvider(scan.hosting) ? "CDN / Edge" : "Hosting"}
                    value={scan.hosting}
                    confidence={scan.hostingConfidence}
                  />
                )}
                {scan.payments && (
                  <TechCard icon={CreditCard} label="Payments" value={scan.payments} confidence={scan.paymentsConfidence} />
                )}
                {scan.auth && (
                  <TechCard icon={Lock} label="Auth" value={scan.auth} confidence={scan.authConfidence} />
                )}
                {scan.analytics && (
                  <TechCard icon={BarChart3} label="Analytics" value={scan.analytics} confidence={scan.analyticsConfidence} />
                )}
                {scan.support && (
                  <TechCard icon={Users} label="Support" value={scan.support} confidence={scan.supportConfidence} />
                )}
              </div>
            </div>
          )}

          {/* ─── Paid upgrade teasers + watchlist ────────────────────────── */}
          <div className="px-6 md:px-8 py-6 border-t border-border bg-gradient-to-br from-primary/5 to-secondary/5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="font-semibold text-sm mb-1">Get notified when this AI stack changes</div>
                <p className="text-xs text-muted-foreground max-w-md">
                  Add {hostname} to your Watchlist for re-scans, provider migration alerts, exportable reports, and
                  authenticated probes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AddToWatchlistButton domain={watchlistDomain} url={scan.url} />
                <Link href="/leaderboard">
                  <Button variant="outline" size="sm" data-testid="button-bottom-compare">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Compare competitors
                  </Button>
                </Link>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> Run authenticated probe</div>
              <div className="flex items-center gap-1.5"><Eye className="w-3 h-3" /> Monitor this SaaS</div>
              <div className="flex items-center gap-1.5"><BarChart3 className="w-3 h-3" /> Compare competitors</div>
              <div className="flex items-center gap-1.5"><ExternalLink className="w-3 h-3" /> Export report</div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Cpu className="w-3 h-3" />
              <span>Generated by AIHackr</span>
            </div>
            <Link href="/">
              <Button variant="link" size="sm" className="text-xs">
                Scan your own site
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight,
  subtitle,
  tooltip,
  wide,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  subtitle?: string;
  tooltip?: string;
  wide?: boolean;
}) {
  return (
    <div className={`group relative flex items-center justify-between gap-3 p-2.5 rounded-lg bg-background/60 border border-border/50 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="text-right min-w-0">
        <div className={`text-sm font-medium truncate ${highlight ? "text-primary" : "text-muted-foreground"}`}>
          {value}
        </div>
        {subtitle && <div className="text-[11px] text-muted-foreground/60">{subtitle}</div>}
      </div>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity max-w-xs w-max z-10 pointer-events-none">
          {tooltip}
        </div>
      )}
    </div>
  );
}

function TechCard({
  icon: Icon,
  label,
  value,
  confidence,
}: {
  icon: any;
  label: string;
  value: string;
  confidence: string | null;
}) {
  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border hover:border-primary/30 transition-colors">
      <Icon className="w-5 h-5 text-primary mb-2" />
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="font-medium text-sm mb-1">{value}</div>
      {confidence && (
        <div
          className={`text-xs ${confidence === "High" ? "text-secondary" : confidence === "Medium" ? "text-yellow-500" : "text-muted-foreground"}`}
        >
          {confidence} confidence
        </div>
      )}
    </div>
  );
}

function SummaryItem({
  label,
  value,
  status,
  icon: Icon,
  subtitle,
  tooltip,
  confidence,
}: {
  label: string;
  value: string;
  status: "complete" | "detected" | "pending";
  icon: any;
  subtitle?: string;
  tooltip?: string;
  confidence?: string;
}) {
  const statusColors = {
    complete: "text-secondary",
    detected: "text-primary",
    pending: "text-muted-foreground",
  };
  
  const statusIcons = {
    complete: <Check className="w-3 h-3" />,
    detected: <Check className="w-3 h-3" />,
    pending: <RefreshCw className="w-3 h-3" />,
  };
  
  const confidenceColors: Record<string, string> = {
    High: "text-secondary",
    Medium: "text-yellow-500",
    Low: "text-orange-500",
  };
  
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50 group relative">
      <Icon className={`w-4 h-4 ${statusColors[status]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {label}
          {confidence && (
            <span className={`text-[10px] ${confidenceColors[confidence] || "text-muted-foreground"}`}>
              ({confidence})
            </span>
          )}
        </div>
        <div className={`text-sm font-medium truncate ${statusColors[status]}`}>{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground/60">{subtitle}</div>}
      </div>
      <span className={statusColors[status]}>{statusIcons[status]}</span>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
          {tooltip}
        </div>
      )}
    </div>
  );
}

type AlertThreshold = "any_change" | "provider_added_removed" | "high_confidence_only";

function AddToWatchlistButton({ domain, url }: { domain: string; url: string }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [domainInput, setDomainInput] = useState(domain);
  const [label, setLabel] = useState("");
  const [alertThreshold, setAlertThreshold] = useState<AlertThreshold>("any_change");

  // Re-prefill the domain field whenever the modal opens or the source
  // domain changes (e.g. user re-scans on a different URL).
  useEffect(() => {
    if (open) setDomainInput(domain);
  }, [open, domain]);

  const submitDomain = (domainInput.trim() || domain).toLowerCase().replace(/^www\./, "");
  const submitUrl = (() => {
    // If the user edited the domain to something different, build a URL from
    // it. Otherwise keep the original URL we scanned (so we preserve any
    // protocol / path information).
    const cleanOriginalDomain = domain.toLowerCase().replace(/^www\./, "");
    if (submitDomain && submitDomain !== cleanOriginalDomain) {
      return `https://${submitDomain}`;
    }
    return url;
  })();

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/me/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: submitUrl,
          displayLabel: label.trim() || submitDomain,
          alertThreshold,
        }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw body;
      return body;
    },
    onSuccess: () => {
      toast.success(`${submitDomain} added to your watchlist`);
      setOpen(false);
      setTimeout(() => navigate("/watchlist"), 700);
    },
    onError: (err: unknown) => {
      const e = (err ?? {}) as { error?: string; message?: string };
      if (e.error === "free-plan-watchlist-cap") {
        toast.error(e.message || "Free plan capped at 5 domains. Upgrade to Pro.");
      } else if (e.error === "already-watching") {
        toast.message(`${submitDomain} is already on your watchlist`, {
          action: { label: "Open watchlist", onClick: () => navigate("/watchlist") },
        });
      } else {
        toast.error(e.message || "Failed to add to watchlist");
      }
    },
  });

  const handleClick = () => {
    if (!user) {
      toast.message("Sign in to monitor this domain", {
        action: { label: "Sign in", onClick: () => navigate("/login") },
      });
      return;
    }
    setOpen(true);
  };

  const isValidDomain = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(submitDomain);

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={handleClick}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        data-testid="button-add-to-watchlist"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add to Watchlist
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="dialog-add-to-watchlist">
          <DialogHeader>
            <DialogTitle>Monitor {domain}</DialogTitle>
            <DialogDescription>
              We'll re-scan this domain on a regular cadence and email you the moment its AI provider stack changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="watchlist-domain">Domain</Label>
              <Input
                id="watchlist-domain"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="example.com"
                data-testid="input-watchlist-domain"
              />
              <p className="text-xs text-muted-foreground mt-1">
                We'll re-scan this exact domain. You can edit if you'd rather monitor a different host.
              </p>
              {!isValidDomain && (
                <p
                  className="text-xs text-destructive mt-1"
                  data-testid="text-domain-invalid"
                >
                  Enter a valid domain like example.com
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="watchlist-label">Label (optional)</Label>
              <Input
                id="watchlist-label"
                placeholder={`e.g. "${submitDomain.split(".")[0]} — top competitor"`}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                data-testid="input-watchlist-label"
              />
            </div>
            <div>
              <Label htmlFor="watchlist-threshold">Alert me when</Label>
              <Select
                value={alertThreshold}
                onValueChange={(v) => setAlertThreshold(v as AlertThreshold)}
              >
                <SelectTrigger id="watchlist-threshold" data-testid="select-watchlist-threshold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any_change" data-testid="option-threshold-any">
                    Any change is detected
                  </SelectItem>
                  <SelectItem value="provider_added_removed" data-testid="option-threshold-swap">
                    A provider is added or removed
                  </SelectItem>
                  <SelectItem value="high_confidence_only" data-testid="option-threshold-high">
                    Only high-confidence changes
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                You can change this anytime per domain in your watchlist.
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              Free plan: weekly re-scans and 5 domain slots. Pro: 24-hour re-scans, unlimited domains, Slack alerts, manual scan-now.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !isValidDomain}
              data-testid="button-confirm-watchlist"
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <><Eye className="w-4 h-4 mr-2" /> Add to Watchlist</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
