import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, X, Cpu, ExternalLink, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type CompareRow =
  | {
      domain: string;
      scanFailed: false;
      aiProvider: string | null;
      aiConfidence: string | null;
      aiGateway: string | null;
      aiTransport: string | null;
      inferenceHost: string | null;
      modelTier: string | null;
      orchestrationFramework: string | null;
      isAgentic: boolean;
      framework: string | null;
      hosting: string | null;
      analytics: string | null;
      auth: string | null;
      surfaces: string;
    }
  | { domain: string; scanFailed: true; reason: string };

type CompareResponse = {
  domains: string[];
  rows: CompareRow[];
  plan: "free" | "pro";
  cap: number;
  scannedAt: string;
};

function recommendedAction(row: CompareRow): string {
  if (row.scanFailed) return "Retry — site may be blocking automated scans";
  if (row.aiProvider) return `Watch for migrations off ${row.aiProvider}`;
  return "Run AI Probe to test deeper interactions";
}

function parseDomainsFromQuery(): string[] {
  if (typeof window === "undefined") return [];
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("domains");
  if (!raw) return [];
  return raw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export default function ComparePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isPro = user?.planTier === "pro";
  const cap = isPro ? 10 : 3;

  const [inputs, setInputs] = useState<string[]>(() => {
    const fromQuery = parseDomainsFromQuery();
    if (fromQuery.length >= 2) return fromQuery;
    return ["", ""];
  });
  const [result, setResult] = useState<CompareResponse | null>(null);

  // Update meta tags for the comparison page so it stops inheriting the
  // generic site title in browser tabs and link previews.
  useEffect(() => {
    document.title = "Competitor AI Stack Comparison · AIHackr";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Compare the AI providers, gateways, and tech stacks of up to 10 SaaS competitors side by side.",
      );
    }
  }, []);

  const compareMutation = useMutation({
    mutationFn: async (domains: string[]): Promise<CompareResponse> => {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw body;
      return body as CompareResponse;
    },
    onSuccess: (data) => {
      setResult(data);
      // Sync URL so the comparison is shareable/bookmarkable.
      const url = new URL(window.location.href);
      url.searchParams.set("domains", data.domains.join(","));
      window.history.replaceState({}, "", url.toString());
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.error || "Comparison failed");
    },
  });

  // Auto-run if at least 2 valid-looking domains came in via the URL.
  useEffect(() => {
    const fromQuery = parseDomainsFromQuery();
    if (fromQuery.length >= 2 && !result && !compareMutation.isPending) {
      compareMutation.mutate(fromQuery.slice(0, cap));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validInputs = useMemo(
    () => inputs.map((i) => i.trim()).filter((i) => i.length > 0),
    [inputs],
  );

  const canRun = validInputs.length >= 2 && !compareMutation.isPending;

  const watchAllMutation = useMutation({
    mutationFn: async (domains: string[]) => {
      const results = await Promise.allSettled(
        domains.map((d) =>
          fetch("/api/me/subscriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: `https://${d}` }),
            credentials: "include",
          }).then(async (r) => {
            if (!r.ok && r.status !== 409) throw await r.json();
          }),
        ),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }) => {
      if (fail === 0) toast.success(`Added ${ok} domains to your watchlist`);
      else toast.success(`Added ${ok} of ${ok + fail} (some already watched or capped)`);
      navigate("/watchlist");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not add to watchlist");
    },
  });

  function setInputAt(i: number, val: string) {
    setInputs((prev) => prev.map((x, idx) => (idx === i ? val : x)));
  }

  function addRow() {
    if (inputs.length >= cap) {
      toast.message(
        isPro
          ? `Comparison supports up to ${cap} domains.`
          : `Free plan compares up to ${cap} domains. Upgrade to Pro for 10.`,
      );
      return;
    }
    setInputs((prev) => [...prev, ""]);
  }

  function removeRow(i: number) {
    setInputs((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-home">
            <ArrowLeft className="w-4 h-4 mr-1" /> Home
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-compare">
            Competitor AI stack comparison
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Enter up to {cap} competitor domains. We'll fingerprint each one's AI provider, gateway, and broader stack and lay them out side by side.
          {!isPro && (
            <>
              {" "}
              <Link href="/login" className="text-primary hover:underline">Upgrade to Pro</Link> for 10 domains and the interactive AI probe.
            </>
          )}
        </p>

        {/* Domain inputs */}
        <div className="mt-8 space-y-3" data-testid="form-compare">
          {inputs.map((val, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-6 tabular-nums">{i + 1}.</span>
              <Input
                value={val}
                onChange={(e) => setInputAt(i, e.target.value)}
                placeholder="e.g. notion.so"
                data-testid={`input-domain-${i}`}
                className="flex-1"
              />
              {inputs.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(i)}
                  data-testid={`button-remove-${i}`}
                  aria-label="Remove domain"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addRow}
              disabled={inputs.length >= cap}
              data-testid="button-add-domain"
            >
              <Plus className="w-4 h-4 mr-1" /> Add domain ({inputs.length}/{cap})
            </Button>
            <Button
              onClick={() => compareMutation.mutate(validInputs.slice(0, cap))}
              disabled={!canRun}
              data-testid="button-run-compare"
            >
              {compareMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning {validInputs.length}…
                </>
              ) : (
                <>Run comparison</>
              )}
            </Button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold" data-testid="heading-results">
                  Results
                </h2>
                <p className="text-xs text-muted-foreground">
                  Scanned {result.rows.length} domains · {new Date(result.scannedAt).toLocaleString()}
                </p>
              </div>
              {user && (
                <Button
                  variant="outline"
                  onClick={() => watchAllMutation.mutate(result.domains)}
                  disabled={watchAllMutation.isPending}
                  data-testid="button-watch-all"
                >
                  {watchAllMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Bell className="w-4 h-4 mr-2" />
                  )}
                  Watch all
                </Button>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm" data-testid="table-compare">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Domain</th>
                    <th className="px-3 py-2 font-medium">AI provider</th>
                    <th className="px-3 py-2 font-medium">Confidence</th>
                    <th className="px-3 py-2 font-medium">Gateway</th>
                    <th className="px-3 py-2 font-medium">Inference host</th>
                    <th className="px-3 py-2 font-medium">Tier</th>
                    <th className="px-3 py-2 font-medium">Orchestration</th>
                    <th className="px-3 py-2 font-medium">Stack</th>
                    <th className="px-3 py-2 font-medium">Recommended action</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr
                      key={row.domain}
                      className="border-t border-border align-top hover:bg-muted/20"
                      data-testid={`row-compare-${row.domain}`}
                    >
                      <td className="px-3 py-3 font-medium whitespace-nowrap">
                        <a
                          href={`https://${row.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:text-primary"
                          data-testid={`link-domain-${row.domain}`}
                        >
                          {row.domain}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      {row.scanFailed ? (
                        <td colSpan={7} className="px-3 py-3 text-yellow-600 dark:text-yellow-400 text-xs">
                          Scan failed: {row.reason}
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-3" data-testid={`cell-provider-${row.domain}`}>
                            {row.aiProvider || <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {row.aiConfidence || <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {row.aiGateway || <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {row.inferenceHost || <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {row.modelTier || <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {row.orchestrationFramework || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground text-xs">
                            {[row.framework, row.hosting].filter(Boolean).join(" · ") || "—"}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {recommendedAction(row)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Comparison uses passive scans — fast and shareable. For deeper coverage on any one domain, open its scan
              report and run an AI Probe (Pro).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
