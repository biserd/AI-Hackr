import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu,
  Bell,
  Mail,
  Slack,
  Clock,
  Globe,
  LogOut,
  Loader2,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface AlertSettings {
  emailAlertsEnabled: boolean;
  slackAlertsEnabled: boolean;
  slackWebhookUrl: string | null;
  slackWebhookConfigured: boolean;
  alertFrequencyCap: string;
  globalAlertThreshold: string;
  minConfidenceToAlert: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  timezone: string;
  alertDigestMode: string;
  digestEnabled: boolean;
  alertsThisWeek: number;
}

const TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function SettingsAlerts() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<AlertSettings>({
    queryKey: ["alert-settings"],
    queryFn: async () => {
      const res = await fetch("/api/me/alert-settings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user,
  });

  const [draft, setDraft] = useState<AlertSettings | null>(null);
  const [webhookInput, setWebhookInput] = useState("");
  const [webhookDirty, setWebhookDirty] = useState(false);

  useEffect(() => {
    if (settings && !draft) {
      setDraft(settings);
    }
  }, [settings, draft]);

  const isPro = user?.planTier === "pro";

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<AlertSettings & { slackWebhookUrl: string | null }>) => {
      const res = await fetch("/api/me/alert-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw body;
      return body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["alert-settings"] });
      setDraft(data);
      setWebhookDirty(false);
      setWebhookInput("");
      toast.success("Settings saved");
    },
    onError: (err: any) => toast.error(err?.error || "Failed to save"),
  });

  const slackTestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/me/alert-settings/slack-test", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw body;
      return body;
    },
    onSuccess: () => toast.success("Sent a test message — check your Slack channel"),
    onError: (err: any) => toast.error(err?.error || "Slack delivery failed"),
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  if (authLoading || !user || isLoading || !draft) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const update = <K extends keyof AlertSettings>(key: K, value: AlertSettings[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const handleSaveAll = () => {
    if (!draft) return;
    const payload: any = { ...draft };
    delete payload.slackWebhookConfigured;
    delete payload.alertsThisWeek;
    if (webhookDirty) {
      payload.slackWebhookUrl = webhookInput.trim() || null;
    } else {
      delete payload.slackWebhookUrl;
    }
    saveMutation.mutate(payload);
  };

  return (
    <div className="min-h-screen noise bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display text-xl font-bold">AIHackr</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">Dashboard</Button>
            </Link>
            <Link href="/watchlist">
              <Button variant="ghost" size="sm">Watchlist</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={async () => { await logout(); navigate("/"); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <Link href="/watchlist">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Watchlist
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-2">Alert Settings</h1>
          <p className="text-muted-foreground">Control how AIHackr notifies you about AI provider changes.</p>
          {!isPro && (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 bg-yellow-500/10">
                Free plan
              </Badge>
              <span className="text-xs text-muted-foreground">
                {draft.alertsThisWeek}/5 alerts used this week
              </span>
            </div>
          )}
        </div>

        {/* Email channel */}
        <section className="bg-card border border-border rounded-xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <div>
                <h2 className="font-semibold">Email alerts</h2>
                <p className="text-xs text-muted-foreground">Sent to {user.email}</p>
              </div>
            </div>
            <Switch
              checked={draft.emailAlertsEnabled}
              onCheckedChange={(v) => update("emailAlertsEnabled", v)}
              data-testid="switch-email-enabled"
            />
          </div>
        </section>

        {/* Slack channel */}
        <section className="bg-card border border-border rounded-xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Slack className="w-5 h-5 text-primary" />
              <div>
                <h2 className="font-semibold">
                  Slack alerts {!isPro && <Badge variant="outline" className="ml-2">Pro</Badge>}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {draft.slackWebhookConfigured ? "Webhook configured" : "Add a Slack incoming webhook URL"}
                </p>
              </div>
            </div>
            <Switch
              checked={draft.slackAlertsEnabled}
              onCheckedChange={(v) => update("slackAlertsEnabled", v)}
              disabled={!isPro}
              data-testid="switch-slack-enabled"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slack-webhook" className="text-sm">Incoming webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="slack-webhook"
                type="url"
                placeholder={draft.slackWebhookConfigured ? "Webhook configured · enter to replace" : "https://hooks.slack.com/services/…"}
                value={webhookInput}
                onChange={(e) => { setWebhookInput(e.target.value); setWebhookDirty(true); }}
                disabled={!isPro}
                data-testid="input-slack-webhook"
              />
              <Button
                variant="outline"
                onClick={() => slackTestMutation.mutate()}
                disabled={!draft.slackWebhookConfigured || slackTestMutation.isPending}
                data-testid="button-test-slack"
              >
                {slackTestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send test"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Create one in Slack: <strong>Apps → Incoming Webhooks → Add to Slack</strong>.
            </p>
          </div>
        </section>

        {/* Thresholds */}
        <section className="bg-card border border-border rounded-xl p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold">When to alert</h2>
              <p className="text-xs text-muted-foreground">Default thresholds (per-domain overrides apply)</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Threshold</Label>
              <Select
                value={draft.globalAlertThreshold}
                onValueChange={(v) => update("globalAlertThreshold", v)}
              >
                <SelectTrigger data-testid="select-global-threshold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any_change">Any change</SelectItem>
                  <SelectItem value="high_confidence_only">High-confidence only</SelectItem>
                  <SelectItem value="provider_added_removed">Provider added/removed only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Minimum confidence</Label>
              <Select
                value={draft.minConfidenceToAlert}
                onValueChange={(v) => update("minConfidenceToAlert", v)}
              >
                <SelectTrigger data-testid="select-min-confidence"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Frequency cap</Label>
              <Select
                value={draft.alertFrequencyCap}
                onValueChange={(v) => update("alertFrequencyCap", v)}
              >
                <SelectTrigger data-testid="select-frequency-cap"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="max_1_per_day">Max 1 per day</SelectItem>
                  <SelectItem value="max_1_per_week">Max 1 per week</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bundling</Label>
              <Select
                value={draft.alertDigestMode}
                onValueChange={(v) => update("alertDigestMode", v)}
              >
                <SelectTrigger data-testid="select-digest-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">One email per change</SelectItem>
                  <SelectItem value="daily_bundle">Daily bundle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Quiet hours */}
        <section className="bg-card border border-border rounded-xl p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold">Quiet hours</h2>
              <p className="text-xs text-muted-foreground">Suppress alerts during these hours in your timezone.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Start hour</Label>
              <Select
                value={draft.quietHoursStart != null ? String(draft.quietHoursStart) : "off"}
                onValueChange={(v) => update("quietHoursStart", v === "off" ? null : (parseInt(v) as any))}
              >
                <SelectTrigger data-testid="select-quiet-start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>{h.toString().padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>End hour</Label>
              <Select
                value={draft.quietHoursEnd != null ? String(draft.quietHoursEnd) : "off"}
                onValueChange={(v) => update("quietHoursEnd", v === "off" ? null : (parseInt(v) as any))}
              >
                <SelectTrigger data-testid="select-quiet-end"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>{h.toString().padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={draft.timezone} onValueChange={(v) => update("timezone", v)}>
                <SelectTrigger data-testid="select-timezone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Weekly digest */}
        <section className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <div>
                <h2 className="font-semibold">Weekly digest</h2>
                <p className="text-xs text-muted-foreground">Sent every Monday at 8 AM in your timezone.</p>
              </div>
            </div>
            <Switch
              checked={draft.digestEnabled}
              onCheckedChange={(v) => update("digestEnabled", v)}
              data-testid="switch-digest-enabled"
            />
          </div>
        </section>

        <div className="flex justify-end gap-2 pb-12">
          <Link href="/watchlist">
            <Button variant="ghost" data-testid="button-cancel-settings">Cancel</Button>
          </Link>
          <Button onClick={handleSaveAll} disabled={saveMutation.isPending} data-testid="button-save-settings">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
            Save changes
          </Button>
        </div>
      </main>
    </div>
  );
}
