import { useState } from "react";
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
  Search,
  Loader2,
  History,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useScan } from "@/hooks/use-scan";
import type { Scan, Subscription } from "@shared/schema";

function formatDate(date: Date | string | null) {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(date: Date | string) {
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

export default function Dashboard() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { scanUrl, isScanning } = useScan();

  const [newUrl, setNewUrl] = useState("");
  const [scanInputUrl, setScanInputUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"scans" | "tracking">("scans");

  const { data: scans = [], isLoading: scansLoading } = useQuery<Scan[]>({
    queryKey: ["user", "scans"],
    queryFn: async () => {
      const res = await fetch("/api/me/scans", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch scans");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery<Subscription[]>({
    queryKey: ["user", "subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/me/subscriptions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subscriptions");
      return res.json();
    },
    enabled: !!user,
  });

  const createSubscription = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch("/api/me/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create subscription");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] });
      setNewUrl("");
    },
  });

  const updateSubscription = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Subscription> }) => {
      const res = await fetch(`/api/me/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update subscription");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] });
    },
  });

  const deleteSubscription = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/me/subscriptions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete subscription");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] });
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleAddSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUrl.trim()) {
      createSubscription.mutate(newUrl.trim());
    }
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (scanInputUrl.trim() && !isScanning) {
      scanUrl(scanInputUrl.trim());
      setScanInputUrl("");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen noise bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen noise bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display text-xl font-bold">AIHackr</span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Track competitors and view your scan history</p>
          </div>
          <form onSubmit={handleScan} className="flex gap-2">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter URL to scan..."
                value={scanInputUrl}
                onChange={(e) => setScanInputUrl(e.target.value)}
                className="pl-9 w-64"
                disabled={isScanning}
                data-testid="input-scan-url"
              />
            </div>
            <Button 
              type="submit" 
              disabled={!scanInputUrl.trim() || isScanning}
              className="bg-primary text-primary-foreground"
              data-testid="button-scan"
            >
              {isScanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Scan
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="flex gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab("scans")}
            className={`px-4 py-3 font-medium text-sm transition-colors relative ${
              activeTab === "scans" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-scans"
          >
            <History className="w-4 h-4 inline-block mr-2" />
            Scan History
            {activeTab === "scans" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("tracking")}
            className={`px-4 py-3 font-medium text-sm transition-colors relative ${
              activeTab === "tracking" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-tracking"
          >
            <Eye className="w-4 h-4 inline-block mr-2" />
            Competitor Tracking
            <span className="ml-2 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
              {subscriptions.length}
            </span>
            {activeTab === "tracking" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {activeTab === "scans" && (
          <div className="space-y-4">
            {scansLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : scans.length === 0 ? (
              <div className="text-center py-12 bg-card border border-border rounded-xl">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-display text-lg font-semibold mb-2">No scans yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start by scanning a URL to see its tech stack
                </p>
                <Link href="/">
                  <Button data-testid="button-scan-now">
                    <Search className="w-4 h-4 mr-2" />
                    Scan a URL
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {scans.map((scan) => (
                  <Link 
                    key={scan.id} 
                    href={`/scan/${scan.domain || new URL(scan.url).hostname.replace(/^www\./, "")}`}
                    className="block"
                  >
                    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer" data-testid={`scan-row-${scan.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Globe className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{scan.domain || new URL(scan.url).hostname}</p>
                            <p className="text-sm text-muted-foreground">
                              {scan.framework || "Unknown"} • {scan.hosting || "Unknown hosting"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(scan.scannedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "tracking" && (
          <div className="space-y-6">
            <form onSubmit={handleAddSubscription} className="flex gap-2">
              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="competitor.com"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="pl-10 h-12"
                  disabled={createSubscription.isPending}
                  data-testid="input-competitor-url"
                />
              </div>
              <Button 
                type="submit" 
                disabled={!newUrl.trim() || createSubscription.isPending}
                className="h-12"
                data-testid="button-add-competitor"
              >
                {createSubscription.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Track
                  </>
                )}
              </Button>
            </form>

            {subsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="text-center py-12 bg-card border border-border rounded-xl">
                <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-display text-lg font-semibold mb-2">No competitors tracked</h3>
                <p className="text-muted-foreground">
                  Add a competitor URL above to start tracking their tech stack changes
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {subscriptions.map((sub) => (
                  <div 
                    key={sub.id} 
                    className="bg-card border border-border rounded-xl p-4"
                    data-testid={`subscription-row-${sub.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <Globe className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{sub.domain}</p>
                          <p className="text-sm text-muted-foreground">
                            Last scanned: {formatDate(sub.lastScannedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {sub.notifyOnChange ? (
                            <Bell className="w-4 h-4 text-primary" />
                          ) : (
                            <BellOff className="w-4 h-4 text-muted-foreground" />
                          )}
                          <Switch
                            checked={sub.notifyOnChange ?? true}
                            onCheckedChange={(checked) => 
                              updateSubscription.mutate({ id: sub.id, updates: { notifyOnChange: checked } })
                            }
                            data-testid={`switch-notify-${sub.id}`}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSubscription.mutate(sub.id)}
                          disabled={deleteSubscription.isPending}
                          className="text-muted-foreground hover:text-red-500"
                          data-testid={`button-delete-${sub.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
