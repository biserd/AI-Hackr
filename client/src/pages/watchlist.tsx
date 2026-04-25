import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu,
  Plus,
  Trash2,
  Bell,
  BellOff,
  ExternalLink,
  Clock,
  Globe,
  LogOut,
  Settings,
  Loader2,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Pause,
  ChevronDown,
  ChevronRight,
  Slack,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Subscription, ChangeEvent } from "@shared/schema";

interface DetectedProvider {
  provider: string;
  displayName: string;
  confidence: "high" | "medium" | "low";
  confidenceScore?: number;
  modelHints?: string[];
}

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelative(date: Date | string | null) {
  if (!date) return "Never";
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

function ConfidencePill({ level }: { level: "high" | "medium" | "low" | string }) {
  const norm = (level || "").toLowerCase();
  const cls =
    norm === "high"
      ? "bg-green-500/15 text-green-500 border-green-500/30"
      : norm === "medium"
      ? "bg-yellow-500/15 text-yellow-500 border-yellow-500/30"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {norm.charAt(0).toUpperCase() + norm.slice(1)}
    </span>
  );
}

function ScanStatusPill({ sub }: { sub: Subscription }) {
  if (sub.scanStatus === "unreachable") {
    return (
      <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10">
        <AlertTriangle className="w-3 h-3 mr-1" /> Unreachable
      </Badge>
    );
  }
  if (sub.pausedUntil && new Date(sub.pausedUntil) > new Date()) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Pause className="w-3 h-3 mr-1" /> Paused
      </Badge>
    );
  }
  if (sub.scanStatus === "scanning") {
    return (
      <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Scanning
      </Badge>
    );
  }
  if (!sub.lastScannedAt) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Clock className="w-3 h-3 mr-1" /> Pending first scan
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">
      <CheckCircle2 className="w-3 h-3 mr-1" /> Active
    </Badge>
  );
}

function changeTypeLabel(t: string): string {
  switch (t) {
    case "provider_added":
      return "Added";
    case "provider_removed":
      return "Removed";
    case "confidence_upgraded":
      return "Upgraded";
    case "confidence_downgraded":
      return "Downgraded";
    case "model_hint_changed":
      return "Model change";
    default:
      return t.replace(/_/g, " ");
  }
}

export default function WatchlistPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [filterText, setFilterText] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent-change");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addLabel, setAddLabel] = useState("");

  const [editingSub, setEditingSub] = useState<Subscription | null>(null);

  const { data: subs = [], isLoading } = useQuery<Subscription[]>({
    queryKey: ["user", "subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/me/subscriptions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const isPro = user?.planTier === "pro";
  const atCap = !isPro && subs.length >= 5;

  const createMutation = useMutation({
    mutationFn: async (input: { url: string; displayLabel?: string }) => {
      const res = await fetch("/api/me/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw body;
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] });
      setAddOpen(false);
      setAddUrl("");
      setAddLabel("");
      toast.success("Added to watchlist");
    },
    onError: (err: any) => {
      if (err?.error === "free-plan-watchlist-cap") {
        toast.error(err.message || "Free plan capped at 5 domains");
      } else if (err?.error === "already-watching") {
        toast.error("You're already watching this domain");
      } else {
        toast.error(err?.message || "Failed to add");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Subscription> }) => {
      const res = await fetch(`/api/me/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/me/subscriptions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] });
      toast.success("Removed from watchlist");
    },
  });

  const scanNowMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/me/subscriptions/${id}/scan-now`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw body;
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] });
      toast.success("Scan triggered — refresh in ~30 sec");
    },
    onError: (err: any) => {
      if (err?.error === "limit-3-per-day") toast.error("You've hit the 3 manual scans/day Pro limit");
      else if (err?.error === "limit-1-per-week-upgrade-for-more") toast.error("Free plan: 1 manual scan/week. Upgrade for more.");
      else toast.error(err?.error || "Scan failed");
    },
  });

  // Apply filters & sort
  const filtered = useMemo(() => {
    let out = subs.slice();
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      out = out.filter((s) => s.domain.includes(q) || (s.displayLabel || "").toLowerCase().includes(q));
    }
    if (providerFilter !== "all") {
      out = out.filter((s) => {
        const provs = (s.providersDetected || []) as DetectedProvider[];
        return provs.some((p) => p.provider === providerFilter);
      });
    }
    if (statusFilter === "changed") {
      out = out.filter((s) => s.lastChangedAt && new Date(s.lastChangedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (statusFilter === "high-confidence") {
      out = out.filter((s) => {
        const provs = (s.providersDetected || []) as DetectedProvider[];
        return provs.some((p) => p.confidence === "high");
      });
    } else if (statusFilter === "errors") {
      out = out.filter((s) => s.scanStatus === "unreachable" || s.scanStatus === "error" || (s.consecutiveFailures ?? 0) > 0);
    } else if (statusFilter === "unreachable") {
      out = out.filter((s) => s.scanStatus === "unreachable");
    } else if (statusFilter === "paused") {
      out = out.filter((s) => s.pausedUntil && new Date(s.pausedUntil) > new Date());
    }

    out.sort((a, b) => {
      if (sortBy === "domain-az") return a.domain.localeCompare(b.domain);
      if (sortBy === "recent-change") {
        const ax = a.lastChangedAt ? new Date(a.lastChangedAt).getTime() : 0;
        const bx = b.lastChangedAt ? new Date(b.lastChangedAt).getTime() : 0;
        return bx - ax;
      }
      if (sortBy === "recent-scan") {
        const ax = a.lastScannedAt ? new Date(a.lastScannedAt).getTime() : 0;
        const bx = b.lastScannedAt ? new Date(b.lastScannedAt).getTime() : 0;
        return bx - ax;
      }
      return 0;
    });
    return out;
  }, [subs, filterText, providerFilter, statusFilter, sortBy]);

  // Build the unique-providers list for the filter dropdown
  const allProviders = useMemo(() => {
    const set = new Map<string, string>();
    subs.forEach((s) => {
      ((s.providersDetected || []) as DetectedProvider[]).forEach((p) => {
        if (!set.has(p.provider)) set.set(p.provider, p.displayName);
      });
    });
    return Array.from(set.entries());
  }, [subs]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUrl.trim()) return;
    createMutation.mutate({ url: addUrl.trim(), displayLabel: addLabel.trim() || undefined });
  };

  return (
    <div className="min-h-screen noise bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display text-xl font-bold">AIHackr</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" data-testid="link-dashboard">Dashboard</Button>
            </Link>
            <Link href="/watchlist">
              <Button variant="ghost" size="sm" className="bg-muted" data-testid="link-watchlist-active">Watchlist</Button>
            </Link>
            <Link href="/settings/alerts">
              <Button variant="ghost" size="sm" data-testid="link-alert-settings">
                <Settings className="w-4 h-4 mr-1" /> Alerts
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={async () => { await logout(); navigate("/"); }} data-testid="button-logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold mb-2" data-testid="text-watchlist-title">Watchlist</h1>
            <p className="text-muted-foreground">
              {subs.length} {subs.length === 1 ? "domain" : "domains"} monitored ·{" "}
              {isPro ? "24h cadence" : `7d cadence · ${5 - subs.length} of 5 free slots remaining`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {atCap && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 bg-yellow-500/10">
                Free plan limit reached
              </Badge>
            )}
            <Button onClick={() => setAddOpen(true)} disabled={atCap} data-testid="button-add-watchlist">
              <Plus className="w-4 h-4 mr-2" /> Add domain
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filter by domain or label"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-8 h-9"
                data-testid="input-filter-watchlist"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Provider</Label>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-44 h-9" data-testid="select-provider-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All providers</SelectItem>
                {allProviders.map(([key, name]) => (
                  <SelectItem key={key} value={key}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Quick filters</Label>
            <div className="flex flex-wrap gap-1.5" data-testid="chips-status-filter">
              {[
                { value: "all", label: "All" },
                { value: "changed", label: "Changed this week" },
                { value: "high-confidence", label: "High confidence" },
                { value: "errors", label: "Errors" },
              ].map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setStatusFilter(chip.value)}
                  className={`h-9 px-3 rounded-full border text-xs font-medium transition-colors ${
                    statusFilter === chip.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                  data-testid={`chip-status-${chip.value}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Sort by</Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-44 h-9" data-testid="select-sort-watchlist">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent-change">Recent change</SelectItem>
                <SelectItem value="recent-scan">Recently scanned</SelectItem>
                <SelectItem value="domain-az">Domain (A → Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <Eye className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-display text-lg font-semibold mb-2">
              {subs.length === 0 ? "No domains on your watchlist yet" : "No matches"}
            </h3>
            <p className="text-muted-foreground mb-4 text-sm">
              {subs.length === 0
                ? "Add a domain to get notified when its AI provider changes."
                : "Adjust your filters to see more."}
            </p>
            {subs.length === 0 && (
              <Button onClick={() => setAddOpen(true)} data-testid="button-add-first-watchlist">
                <Plus className="w-4 h-4 mr-2" /> Add your first domain
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <div className="col-span-2">Domain</div>
              <div className="col-span-2">Providers detected</div>
              <div className="col-span-1">Confidence</div>
              <div className="col-span-1">Last scanned</div>
              <div className="col-span-2">Last changed</div>
              <div className="col-span-2">Change summary</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            {filtered.map((sub) => {
              const providers = (sub.providersDetected || []) as DetectedProvider[];
              const isExpanded = expandedId === sub.id;
              return (
                <WatchlistRow
                  key={sub.id}
                  sub={sub}
                  providers={providers}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : sub.id)}
                  onScanNow={() => scanNowMutation.mutate(sub.id)}
                  scanning={scanNowMutation.isPending && scanNowMutation.variables === sub.id}
                  onEdit={() => setEditingSub(sub)}
                  onDelete={() => {
                    if (confirm(`Remove ${sub.domain} from watchlist?`)) deleteMutation.mutate(sub.id);
                  }}
                  onToggleNotify={(checked) =>
                    updateMutation.mutate({ id: sub.id, updates: { notifyOnChange: checked } })
                  }
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Add domain dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent data-testid="dialog-add-watchlist">
          <DialogHeader>
            <DialogTitle>Add domain to watchlist</DialogTitle>
            <DialogDescription>
              We'll scan it on the {isPro ? "Pro 24-hour cadence" : "free 7-day cadence"} and email you when the AI stack changes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAdd} className="space-y-4">
            <div>
              <Label htmlFor="add-url">Domain or URL *</Label>
              <Input
                id="add-url"
                placeholder="competitor.com"
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                required
                data-testid="input-add-url"
              />
            </div>
            <div>
              <Label htmlFor="add-label">Label (optional)</Label>
              <Input
                id="add-label"
                placeholder="e.g. Top competitor"
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                data-testid="input-add-label"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || !addUrl.trim()} data-testid="button-confirm-add">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add to watchlist"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {editingSub && (
        <EditDialog
          sub={editingSub}
          onClose={() => setEditingSub(null)}
          onSave={(updates) => {
            updateMutation.mutate({ id: editingSub.id, updates });
            setEditingSub(null);
          }}
          isPro={isPro}
        />
      )}
    </div>
  );
}

function WatchlistRow({
  sub,
  providers,
  isExpanded,
  onToggle,
  onScanNow,
  scanning,
  onEdit,
  onDelete,
  onToggleNotify,
}: {
  sub: Subscription;
  providers: DetectedProvider[];
  isExpanded: boolean;
  onToggle: () => void;
  onScanNow: () => void;
  scanning: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleNotify: (checked: boolean) => void;
}) {
  const highestConfidence: "high" | "medium" | "low" | null = providers.reduce<"high" | "medium" | "low" | null>(
    (acc, p) => {
      const rank = (lvl: "high" | "medium" | "low" | null) =>
        lvl === "high" ? 3 : lvl === "medium" ? 2 : lvl === "low" ? 1 : 0;
      return rank(p.confidence as "high" | "medium" | "low") > rank(acc) ? (p.confidence as "high" | "medium" | "low") : acc;
    },
    null
  );
  const changeSummary = (() => {
    if (!sub.lastChangedAt) return "No changes yet";
    const lastChange = new Date(sub.lastChangedAt).getTime();
    const within7d = Date.now() - lastChange < 7 * 24 * 60 * 60 * 1000;
    if (within7d) return `Changed ${formatRelative(sub.lastChangedAt)}`;
    return `Stable since ${formatRelative(sub.lastChangedAt)}`;
  })();

  return (
    <div className="border-b border-border last:border-0" data-testid={`row-watchlist-${sub.id}`}>
      <div className="grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-muted/20 transition-colors">
        <div className="col-span-3 flex items-center gap-2">
          <button
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground p-0.5"
            data-testid={`button-expand-${sub.id}`}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="font-medium truncate">{sub.displayLabel || sub.domain}</div>
            <div className="text-xs text-muted-foreground truncate">{sub.domain}</div>
          </div>
        </div>
        <div className="col-span-2" data-testid={`cell-providers-${sub.id}`}>
          {providers.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">None detected yet</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {providers.slice(0, 2).map((p) => (
                <span key={p.provider} className="text-xs font-medium">{p.displayName}</span>
              ))}
              {providers.length > 2 && (
                <span className="text-xs text-muted-foreground">+{providers.length - 2}</span>
              )}
            </div>
          )}
        </div>
        <div className="col-span-1" data-testid={`cell-confidence-${sub.id}`}>
          {highestConfidence ? (
            <ConfidencePill level={highestConfidence} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
        <div className="col-span-1 text-sm text-muted-foreground" data-testid={`cell-last-scanned-${sub.id}`}>
          {formatRelative(sub.lastScannedAt)}
        </div>
        <div className="col-span-2 text-sm text-foreground" data-testid={`cell-last-changed-${sub.id}`}>
          {sub.lastChangedAt ? formatRelative(sub.lastChangedAt) : "—"}
        </div>
        <div className="col-span-2 text-sm text-muted-foreground" data-testid={`cell-change-summary-${sub.id}`}>
          {changeSummary}
        </div>
        <div className="col-span-1">
          <ScanStatusPill sub={sub} />
        </div>
        <div className="col-span-1 flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onScanNow}
            disabled={scanning}
            title="Scan now"
            data-testid={`button-scan-now-${sub.id}`}
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} title="Edit" data-testid={`button-edit-${sub.id}`}>
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-muted-foreground hover:text-red-500"
            title="Remove"
            data-testid={`button-delete-${sub.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isExpanded && <RowExpansion sub={sub} onToggleNotify={onToggleNotify} />}
    </div>
  );
}

function RowExpansion({ sub, onToggleNotify }: { sub: Subscription; onToggleNotify: (b: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data: changes = [], isLoading } = useQuery<ChangeEvent[]>({
    queryKey: ["sub-changes", sub.id],
    queryFn: async () => {
      const res = await fetch(`/api/me/subscriptions/${sub.id}/changes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (changeId: string) => {
      const res = await fetch(`/api/me/subscriptions/${sub.id}/changes/${changeId}/dismiss`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Marked as false positive");
      queryClient.invalidateQueries({ queryKey: ["sub-changes", sub.id] });
    },
    onError: () => {
      toast.error("Could not dismiss change");
    },
  });

  const isDismissed = (c: ChangeEvent) =>
    !!c.dismissedUntil && new Date(c.dismissedUntil) > new Date();

  return (
    <div className="px-4 pb-4 pt-2 bg-muted/10 border-t border-border" data-testid={`expansion-${sub.id}`}>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent change history</h4>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes detected yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {changes.slice(0, 8).map((c) => (
                <div
                  key={c.id}
                  className="text-sm flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0"
                  data-testid={`change-row-${c.id}`}
                >
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {changeTypeLabel(c.changeType)}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground">{c.changeSummary || c.provider || "Change detected"}</div>
                    <div className="text-xs text-muted-foreground">{formatRelative(c.detectedAt)}</div>
                    {isDismissed(c) && (
                      <span
                        className="inline-block mt-0.5 text-[10px] uppercase tracking-wide text-amber-600 font-semibold"
                        data-testid={`badge-dismissed-${c.id}`}
                      >
                        Dismissed (false positive)
                      </span>
                    )}
                    {c.alertSuppressed && !isDismissed(c) && (
                      <span className="inline-block mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground italic">
                        Suppressed
                      </span>
                    )}
                  </div>
                  {!isDismissed(c) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      disabled={dismissMutation.isPending && dismissMutation.variables === c.id}
                      onClick={() => dismissMutation.mutate(c.id)}
                      title="Mark as false positive (suppress repeat alerts for 30 days)"
                      data-testid={`button-dismiss-${c.id}`}
                    >
                      {dismissMutation.isPending && dismissMutation.variables === c.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "False positive"
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick controls</h4>
          <div className="flex items-center justify-between">
            <Label htmlFor={`notify-${sub.id}`} className="text-sm">Email alerts</Label>
            <Switch
              id={`notify-${sub.id}`}
              checked={sub.notifyOnChange ?? true}
              onCheckedChange={onToggleNotify}
              data-testid={`switch-notify-${sub.id}`}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            <div>Threshold: <span className="text-foreground font-medium">{(sub.alertThreshold || "any_change").replace(/_/g, " ")}</span></div>
            <div className="mt-1">Slack: <span className="text-foreground font-medium">{sub.slackEnabled ? "On" : "Off"}</span></div>
            <div className="mt-1">Next scan: {sub.nextScanAt ? formatRelative(sub.nextScanAt) : "—"}</div>
          </div>
          <Link href={`/scan/${sub.domain}`}>
            <Button variant="outline" size="sm" className="w-full" data-testid={`link-view-scan-${sub.id}`}>
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> View latest scan
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function EditDialog({
  sub,
  onClose,
  onSave,
  isPro,
}: {
  sub: Subscription;
  onClose: () => void;
  onSave: (updates: Partial<Subscription>) => void;
  isPro: boolean;
}) {
  type AlertThresholdValue = "any_change" | "high_confidence_only" | "provider_added_removed" | "no_alerts";
  const [label, setLabel] = useState(sub.displayLabel || "");
  const [threshold, setThreshold] = useState<AlertThresholdValue>(
    (sub.alertThreshold as AlertThresholdValue) || "any_change"
  );
  const [notify, setNotify] = useState(sub.notifyOnChange ?? true);
  const [slackEnabled, setSlackEnabled] = useState(!!sub.slackEnabled);
  const [pauseChoice, setPauseChoice] = useState(
    sub.pausedUntil && new Date(sub.pausedUntil) > new Date() ? "paused-7d" : "active"
  );

  const handleSave = () => {
    let pausedUntil: Date | null = null;
    if (pauseChoice === "paused-7d") pausedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (pauseChoice === "paused-30d") pausedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    onSave({
      displayLabel: label,
      alertThreshold: threshold,
      notifyOnChange: notify,
      slackEnabled,
      pausedUntil,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="dialog-edit-watchlist">
        <DialogHeader>
          <DialogTitle>Edit {sub.domain}</DialogTitle>
          <DialogDescription>Tune alerts and pausing for this domain.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} data-testid="input-edit-label" />
          </div>
          <div>
            <Label>Alert threshold</Label>
            <Select value={threshold} onValueChange={(v) => setThreshold(v as AlertThresholdValue)}>
              <SelectTrigger data-testid="select-edit-threshold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any_change">Any change</SelectItem>
                <SelectItem value="high_confidence_only">High-confidence only</SelectItem>
                <SelectItem value="provider_added_removed">Provider added/removed only</SelectItem>
                <SelectItem value="no_alerts">No alerts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Email alerts</Label>
            <Switch checked={notify} onCheckedChange={setNotify} data-testid="switch-edit-notify" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Slack alerts {!isPro && <span className="text-xs text-muted-foreground ml-1">(Pro)</span>}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Configure your webhook in Alert Settings.</p>
            </div>
            <Switch checked={slackEnabled} onCheckedChange={setSlackEnabled} disabled={!isPro} data-testid="switch-edit-slack" />
          </div>
          <div>
            <Label>Pause monitoring</Label>
            <Select value={pauseChoice} onValueChange={setPauseChoice}>
              <SelectTrigger data-testid="select-edit-pause"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused-7d">Pause for 7 days</SelectItem>
                <SelectItem value="paused-30d">Pause for 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} data-testid="button-save-edit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
