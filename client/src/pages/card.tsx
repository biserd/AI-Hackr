import { useEffect, useState, useCallback } from "react";
import { useRoute } from "wouter";
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
  Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { toast } from "sonner";
import type { Scan } from "@shared/schema";
import { useScan } from "@/hooks/use-scan";

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

function isCdnProvider(hosting: string): boolean {
  const cdnProviders = ["Cloudflare", "Fastly", "Akamai", "CloudFront", "KeyCDN", "StackPath", "Bunny CDN"];
  return cdnProviders.some(cdn => hosting.toLowerCase().includes(cdn.toLowerCase()));
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

export default function CardPage() {
  const [, params] = useRoute("/card/:id");
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [probeLoading, setProbeLoading] = useState(false);
  const { triggerProbeScan } = useScan();

  const fetchScan = useCallback(async (id: string, isPolling = false) => {
    try {
      const response = await fetch(`/api/scan/${id}`);
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

  // Initial fetch
  useEffect(() => {
    if (params?.id) {
      fetchScan(params.id);
    }
  }, [params?.id, fetchScan]);

  // Poll for updates while phases are in progress
  useEffect(() => {
    if (!scan || !params?.id) return;
    
    const phases = scan.scanPhases as ScanPhases | null;
    const isInProgress = phases && (
      phases.render === "pending" || 
      phases.render === "running" ||
      phases.probe === "pending" ||
      phases.probe === "running"
    );
    
    if (!isInProgress) return;
    
    const interval = setInterval(() => {
      fetchScan(params.id, true);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [scan, params?.id, fetchScan]);

  const handleProbeScan = async () => {
    if (!scan) return;
    setProbeLoading(true);
    const success = await triggerProbeScan(scan.id);
    if (success) {
      // Start polling by re-fetching
      fetchScan(scan.id, true);
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
  const isCdn = scan.hosting && isCdnProvider(scan.hosting);
  
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

        {/* Shareable Stack Card */}
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
                <div className="text-xs text-muted-foreground">AIHackr Stack Card</div>
                <div className="font-semibold">{hostname}</div>
              </div>
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <span className="px-2 py-0.5 rounded bg-muted">{isCdn ? scan.hosting : (scan.framework || "Unknown")}</span>
                {scan.analytics && <span className="px-2 py-0.5 rounded bg-muted">{scan.analytics}</span>}
                <span className="px-2 py-0.5 rounded bg-muted">{scan.aiProvider ? scan.aiProvider : "No AI signal"}</span>
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
                )}
              </div>
            )}
            
            <a href={scan.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
              {scan.url}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Summary Bar */}
          <div className="p-4 bg-muted/30 border-b border-border">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <SummaryItem
                label="AI Provider"
                value={scan.aiProvider || "No public signal"}
                status={probeRan ? "complete" : (scan.aiProvider ? "detected" : "pending")}
                icon={Bot}
              />
              <SummaryItem
                label="Framework"
                value={scan.framework || "Unknown"}
                status={renderRan ? "complete" : (scan.framework ? "detected" : "pending")}
                icon={Code2}
              />
              <SummaryItem
                label={isCdn ? "Origin (inferred)" : "Hosting"}
                value={isCdn ? (originHost.origin || "Unknown") : (scan.hosting || "Unknown")}
                status={isCdn ? (originHost.origin ? "detected" : "pending") : (scan.hosting ? "complete" : "pending")}
                icon={Server}
                subtitle={isCdn ? `behind ${scan.hosting}` : undefined}
                tooltip={isCdn && originHost.evidence ? originHost.evidence : undefined}
                confidence={isCdn ? originHost.confidence : undefined}
              />
              <SummaryItem
                label="Services"
                value={`${thirdPartyCount} detected`}
                status="detected"
                icon={Globe}
              />
              <SummaryItem
                label="Overall confidence"
                value={scan.aiConfidence || scan.frameworkConfidence || "Medium"}
                status="complete"
                icon={Sparkles}
                subtitle={getConfidenceReason(scan, originHost)}
              />
            </div>
          </div>

          {/* Stack Grid */}
          <div className="p-8">
            <h2 className="font-display text-lg font-semibold mb-6">Tech Stack</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {scan.framework && (
                <TechCard
                  icon={Code2}
                  label="Framework"
                  value={scan.framework}
                  confidence={scan.frameworkConfidence}
                />
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
                <TechCard
                  icon={CreditCard}
                  label="Payments"
                  value={scan.payments}
                  confidence={scan.paymentsConfidence}
                />
              )}
              {scan.auth && (
                <TechCard
                  icon={Lock}
                  label="Auth"
                  value={scan.auth}
                  confidence={scan.authConfidence}
                />
              )}
              {scan.analytics && (
                <TechCard
                  icon={BarChart3}
                  label="Analytics"
                  value={scan.analytics}
                  confidence={scan.analyticsConfidence}
                />
              )}
              {scan.support && (
                <TechCard
                  icon={Users}
                  label="Support"
                  value={scan.support}
                  confidence={scan.supportConfidence}
                />
              )}
            </div>

            {/* AI Stack - Always visible */}
            <div className={`p-6 rounded-xl mb-6 ${scan.aiProvider ? "bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30" : "bg-muted/30 border border-border"}`}>
              <div className="flex items-center gap-2 mb-4">
                <Bot className={`w-6 h-6 ${scan.aiProvider ? "text-primary" : "text-muted-foreground"}`} />
                <span className="font-semibold text-lg">AI Stack</span>
                {scan.aiProvider ? (
                  <span className="ml-auto text-xs px-3 py-1 rounded-full bg-secondary/20 text-secondary font-medium">
                    {scan.aiConfidence || "Medium"} Confidence
                  </span>
                ) : probeRan ? (
                  <span className="ml-auto text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                    Probe Complete
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div className="flex justify-between p-2 rounded bg-background/50">
                  <span className="text-muted-foreground">Provider</span>
                  <span className={`font-medium ${scan.aiProvider ? "text-primary" : "text-muted-foreground"}`}>
                    {scan.aiProvider || "No public signal"}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded bg-background/50">
                  <span className="text-muted-foreground">Gateway</span>
                  <span className={`font-medium ${scan.aiGateway ? "text-primary" : "text-muted-foreground"}`}>
                    {scan.aiGateway || "Not observed"}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded bg-background/50">
                  <span className="text-muted-foreground">Streaming</span>
                  <span className="font-medium text-muted-foreground">
                    {scan.aiTransport || "Not observed"}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded bg-background/50">
                  <span className="text-muted-foreground">Chat UI</span>
                  <span className="font-medium text-muted-foreground">
                    {scan.evidence?.probeDiagnostics?.chatUiFound ? "Found" : "Not found"}
                  </span>
                </div>
              </div>
              {scan.inferredModel && (
                <div className="flex justify-between p-2 rounded bg-background/50 text-sm mb-4">
                  <span className="text-muted-foreground">Inferred Model</span>
                  <span className="font-medium text-primary">{scan.inferredModel}</span>
                </div>
              )}
              {!scan.aiProvider && (
                <div className="text-xs text-muted-foreground/80 p-3 rounded bg-background/30 border border-border">
                  <MessageSquare className="w-3 h-3 inline mr-1" />
                  This app may call AI server-side only, behind a proxy, or only after login.
                  {!probeRan && " Run AI Probe for deeper detection."}
                </div>
              )}
            </div>

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
                <h3 className="font-display text-lg font-semibold">Detection Evidence</h3>
                
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

          {/* In-Report CTAs */}
          <div className="px-8 py-6 border-t border-border bg-muted/10">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm" data-testid="button-compare">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Compare vs competitor
                </Button>
              </Link>
              <Button variant="secondary" size="sm" disabled data-testid="button-monitor">
                <Clock className="w-4 h-4 mr-2" />
                Monitor weekly (Pro)
              </Button>
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
