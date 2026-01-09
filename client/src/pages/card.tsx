import { useEffect, useState } from "react";
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
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { Scan } from "@shared/schema";

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

export default function CardPage() {
  const [, params] = useRoute("/card/:id");
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (params?.id) {
      fetchScan(params.id);
    }
  }, [params?.id]);

  const fetchScan = async (id: string) => {
    try {
      const response = await fetch(`/api/scan/${id}`);
      if (!response.ok) {
        throw new Error("Scan not found");
      }
      const data = await response.json();
      setScan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scan");
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="min-h-screen bg-background py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div {...fadeIn} className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </motion.div>

        <motion.div
          {...fadeIn}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card overflow-hidden"
        >
          {/* Header */}
          <div className="p-8 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-xl">
                {initials}
              </div>
              <div className="flex-1">
                <h1 className="font-display text-2xl font-bold mb-1">{hostname}</h1>
                <p className="text-sm text-muted-foreground">
                  Scanned {new Date(scan.scannedAt).toLocaleDateString()}
                </p>
              </div>
              <Button onClick={copyShareLink} variant="outline" data-testid="button-share">
                {copied ? (
                  <>
                    <Check className="mr-2 w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="mr-2 w-4 h-4" />
                    Share
                  </>
                )}
              </Button>
            </div>
            <a
              href={scan.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              {scan.url}
              <ExternalLink className="w-3 h-3" />
            </a>
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
                  icon={Server}
                  label="Hosting"
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

            {/* AI Stack */}
            {scan.aiProvider && (
              <div className="p-6 rounded-xl bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu className="w-6 h-6 text-primary" />
                  <span className="font-semibold text-lg">AI Stack</span>
                  <span className="ml-auto text-xs px-3 py-1 rounded-full bg-secondary/20 text-secondary font-medium">
                    {scan.aiConfidence || "Medium"} Confidence
                  </span>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-medium">{scan.aiProvider}</span>
                  </div>
                  {scan.aiTransport && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transport</span>
                      <span className="font-medium">{scan.aiTransport}</span>
                    </div>
                  )}
                  {scan.aiGateway && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gateway</span>
                      <span className="font-medium">{scan.aiGateway}</span>
                    </div>
                  )}
                  {scan.inferredModel && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Inferred Model</span>
                      <span className="font-medium">{scan.inferredModel}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

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

                {/* Network Activity */}
                {((scan.evidence.networkDomains && scan.evidence.networkDomains.length > 0) ||
                  (scan.evidence.networkPaths && scan.evidence.networkPaths.length > 0)) && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Server className="w-4 h-4 text-secondary" />
                      <span className="text-sm font-medium">Network Activity</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {scan.evidence.networkDomains && scan.evidence.networkDomains.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-2">External Domains</div>
                          <div className="flex flex-wrap gap-1">
                            {scan.evidence.networkDomains.slice(0, 8).map((domain, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-primary/10 text-xs font-mono text-primary">
                                {domain}
                              </span>
                            ))}
                            {scan.evidence.networkDomains.length > 8 && (
                              <span className="px-2 py-0.5 text-xs text-muted-foreground">+{scan.evidence.networkDomains.length - 8}</span>
                            )}
                          </div>
                        </div>
                      )}
                      {scan.evidence.networkPaths && scan.evidence.networkPaths.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-2">API Paths</div>
                          <div className="flex flex-wrap gap-1">
                            {scan.evidence.networkPaths.slice(0, 6).map((path, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-secondary/10 text-xs font-mono text-secondary">
                                {path.length > 40 ? path.slice(0, 40) + "..." : path}
                              </span>
                            ))}
                            {scan.evidence.networkPaths.length > 6 && (
                              <span className="px-2 py-0.5 text-xs text-muted-foreground">+{scan.evidence.networkPaths.length - 6}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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

                {/* Legacy domains display */}
                {scan.evidence.domains && scan.evidence.domains.length > 0 && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Third-Party Services</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {scan.evidence.domains.map((domain, i) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-muted text-xs font-mono">
                          {domain}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
