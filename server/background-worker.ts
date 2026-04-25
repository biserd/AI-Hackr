/**
 * AIHackr Watchlist Background Worker
 *
 * Implements the playbook spec (Part 2 §2.3 + §3 + §4):
 * - Per-plan re-scan cadence with ±2h jitter
 * - Pro-priority head-of-queue
 * - Provider-aware diff with confidence bands and 0.60 floor
 * - 2-consecutive-scan rule for provider removal
 * - 4-hour retry, 3 attempts, then "unreachable" badge + one-time email
 * - Alert delivery with dedup, quiet hours, frequency cap, dismissal
 * - Weekly digest scheduling (Monday 8 AM in user TZ)
 */

import { storage, db } from "./storage";
import { scanUrl } from "./scanner";
import {
  sendStackChangeAlertEmail,
  sendSiteUnreachableEmail,
  sendWeeklyDigestEmail,
  type ProviderStateForEmail,
  type DigestChangeRow,
  type DigestWatchlistRow,
} from "./email";
import { sendStackChangeSlack } from "./slack";
import { subscriptions, scans, users, changeEvents, userSettings } from "@shared/schema";
import { eq, and, gte, isNotNull, lt } from "drizzle-orm";
import type { Subscription, Scan, ChangeEvent, User, UserSettings, InsertScan } from "@shared/schema";

// ─── Cadence constants ───────────────────────────────────
const FREE_CADENCE_MS = 7 * 24 * 60 * 60 * 1000;       // 7 days
const PRO_CADENCE_MS = 24 * 60 * 60 * 1000;            // 24 hours
const JITTER_MS = 2 * 60 * 60 * 1000;                  // ±2 hours
const RETRY_DELAY_MS = 4 * 60 * 60 * 1000;             // 4 hours
const MAX_RETRIES = 3;
const PENDING_REMOVAL_THRESHOLD = 2;                   // 2 consecutive missing scans
const CONFIDENCE_FLOOR = 0.6;
const ALERT_DEDUP_MS = 24 * 60 * 60 * 1000;            // 24 hours
const FREE_WEEKLY_ALERT_CAP = 5;
const WORKER_TICK_MS = 10 * 60 * 1000;                 // poll every 10 min
const APP_URL = process.env.APP_URL || "https://aihackr.com";

// ─── Helpers ─────────────────────────────────────────────

function normalizeDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function nextScanTime(planTier: string, base: Date = new Date()): Date {
  const cadence = planTier === "pro" ? PRO_CADENCE_MS : FREE_CADENCE_MS;
  const jitter = (Math.random() * 2 - 1) * JITTER_MS;
  return new Date(base.getTime() + cadence + jitter);
}

/** Map a string confidence ("High"/"Medium"/"Low") OR a 0-1 score to a band + score. */
function normalizeConfidence(confidence: string | null | undefined): { band: "high" | "medium" | "low" | "none"; score: number } {
  if (!confidence) return { band: "none", score: 0 };
  const c = confidence.toString().toLowerCase();
  if (c === "high") return { band: "high", score: 0.85 };
  if (c === "medium") return { band: "medium", score: 0.65 };
  if (c === "low") return { band: "low", score: 0.4 };
  // numeric?
  const num = parseFloat(c);
  if (!isNaN(num)) return scoreToBand(num);
  return { band: "none", score: 0 };
}

function scoreToBand(score: number): { band: "high" | "medium" | "low" | "none"; score: number } {
  if (score >= 0.8) return { band: "high", score };
  if (score >= 0.5) return { band: "medium", score };
  if (score > 0) return { band: "low", score };
  return { band: "none", score: 0 };
}

function bandRank(band: "high" | "medium" | "low" | "none"): number {
  return { high: 3, medium: 2, low: 1, none: 0 }[band];
}

interface DetectedProvider {
  provider: string;
  displayName: string;
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  modelHints?: string[];
  firstDetectedAt?: string;
  lastSeenAt?: string;
}

function buildDisplayName(provider: string): string {
  const map: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic (Claude)",
    google: "Google (Gemini)",
    gemini: "Google (Gemini)",
    azure: "Azure OpenAI",
    "azure_openai": "Azure OpenAI",
    cohere: "Cohere",
    mistral: "Mistral",
    bedrock: "AWS Bedrock",
  };
  const key = provider.toLowerCase().replace(/[\s-]+/g, "_");
  return map[key] || provider;
}

function modelHintsFromScan(scan: { aiProvider?: string | null; aiGateway?: string | null; aiTransport?: string | null; inferredModel?: string | null }): string[] {
  return scan.inferredModel ? [scan.inferredModel] : [];
}

/**
 * Convert a scan result into the DetectedProvider list stored on the
 * watchlist entry. Today the scanner emits a single primary AI provider;
 * this helper is structured so we can return multiple in the future.
 */
function buildDetectedProviders(scan: { aiProvider?: string | null; aiConfidence?: string | null; inferredModel?: string | null }, prior?: DetectedProvider[] | null): DetectedProvider[] {
  if (!scan.aiProvider) return [];
  const { band, score } = normalizeConfidence(scan.aiConfidence);
  if (band === "none") return [];
  const provider = scan.aiProvider.toLowerCase();
  const priorEntry = (prior || []).find((p) => p.provider === provider);
  return [
    {
      provider,
      displayName: buildDisplayName(scan.aiProvider),
      confidence: band as "high" | "medium" | "low",
      confidenceScore: score,
      modelHints: modelHintsFromScan(scan),
      firstDetectedAt: priorEntry?.firstDetectedAt || new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
  ];
}

// ─── Diff engine (playbook §2.3) ─────────────────────────

interface DiffResult {
  changes: Array<Omit<ChangeEvent, "id" | "detectedAt"> & { providerDisplayName: string }>;
  updatedPendingRemovals: Record<string, number>;
  /** Providers to report as the new "providersDetected" stored state.
   * For a removal still in pending, we keep the prior provider entry. */
  providersToStore: DetectedProvider[];
}

function computeDiff(
  priorRaw: DetectedProvider[],
  nextRaw: DetectedProvider[],
  pendingRemovals: Record<string, number>,
  newScanId: string,
  oldScanId: string | null
): DiffResult {
  const changes: DiffResult["changes"] = [];
  const updatedPending: Record<string, number> = { ...pendingRemovals };
  const providersToStore: DetectedProvider[] = [];

  // Apply 0.60 confidence floor: providers below the floor are NOT considered "present" for
  // add/remove state transitions. Storing only above-floor providers ensures that when a
  // provider later crosses above 0.60 it correctly emits `provider_added`, and when one
  // drops below the floor the pending-removal counter starts.
  const prior = priorRaw.filter((p) => (p.confidenceScore ?? 0) >= CONFIDENCE_FLOOR);
  const next = nextRaw.filter((p) => (p.confidenceScore ?? 0) >= CONFIDENCE_FLOOR);

  const priorMap = new Map(prior.map((p) => [p.provider, p]));
  const nextMap = new Map(next.map((p) => [p.provider, p]));

  // Provider added (already filtered to ≥ floor)
  for (const p of next) {
    if (!priorMap.has(p.provider)) {
      changes.push({
        subscriptionId: "", // filled by caller
        oldScanId: oldScanId,
        newScanId,
        changeType: "provider_added",
        changeSummary: `Added ${p.displayName} (${p.confidence} confidence)`,
        changes: { added: [p.displayName], removed: [], modified: [] },
        notificationSent: false,
        notificationSentAt: null,
        provider: p.provider,
        providerDisplayName: p.displayName,
        priorConfidence: "none",
        newConfidence: p.confidence,
        severity: "major",
        alertedAt: null,
        alertSuppressed: false,
        dismissedUntil: null,
        modelHints: p.modelHints?.length ? { from: [], to: p.modelHints } : null,
      });
    }
    providersToStore.push(p);
    // any provider that came back resets its pending counter
    if (updatedPending[p.provider]) delete updatedPending[p.provider];
  }

  // Provider removed (2-consecutive-scan rule). Prior is already filtered to ≥ floor.
  for (const p of prior) {
    if (!nextMap.has(p.provider)) {
      const newCount = (updatedPending[p.provider] || 0) + 1;
      updatedPending[p.provider] = newCount;
      if (newCount >= PENDING_REMOVAL_THRESHOLD) {
        changes.push({
          subscriptionId: "",
          oldScanId,
          newScanId,
          changeType: "provider_removed",
          changeSummary: `Removed ${p.displayName} (was ${p.confidence} confidence)`,
          changes: { added: [], removed: [p.displayName], modified: [] },
          notificationSent: false,
          notificationSentAt: null,
          provider: p.provider,
          providerDisplayName: p.displayName,
          priorConfidence: p.confidence,
          newConfidence: "none",
          severity: "major",
          alertedAt: null,
          alertSuppressed: false,
          dismissedUntil: null,
          modelHints: null,
        });
        delete updatedPending[p.provider]; // clear after firing
        // do NOT add to providersToStore
      } else {
        // Still pending — keep the prior entry visible
        providersToStore.push(p);
      }
    }
  }

  // Confidence band shifts for shared providers
  for (const p of next) {
    const prev = priorMap.get(p.provider);
    if (prev) {
      const prevBand = prev.confidence;
      const newBand = p.confidence;
      if (prevBand !== newBand) {
        const upgraded = bandRank(newBand) > bandRank(prevBand);
        changes.push({
          subscriptionId: "",
          oldScanId,
          newScanId,
          changeType: upgraded ? "confidence_upgraded" : "confidence_downgraded",
          changeSummary: `${p.displayName}: ${prevBand} → ${newBand} confidence`,
          changes: { added: [], removed: [], modified: [{ tech: p.provider, from: prevBand, to: newBand }] },
          notificationSent: false,
          notificationSentAt: null,
          provider: p.provider,
          providerDisplayName: p.displayName,
          priorConfidence: prevBand,
          newConfidence: newBand,
          severity: "minor",
          alertedAt: null,
          alertSuppressed: false,
          dismissedUntil: null,
          modelHints: null,
        });
      }

      // Model hint changes (minor)
      const priorHints = JSON.stringify((prev.modelHints || []).slice().sort());
      const nextHints = JSON.stringify((p.modelHints || []).slice().sort());
      if (priorHints !== nextHints && nextHints !== "[]") {
        changes.push({
          subscriptionId: "",
          oldScanId,
          newScanId,
          changeType: "model_hint_changed",
          changeSummary: `${p.displayName} model hints changed`,
          changes: { added: [], removed: [], modified: [{ tech: `${p.provider}:model`, from: prev.modelHints?.[0] || "—", to: p.modelHints?.[0] || "—" }] },
          notificationSent: false,
          notificationSentAt: null,
          provider: p.provider,
          providerDisplayName: p.displayName,
          priorConfidence: p.confidence,
          newConfidence: p.confidence,
          severity: "minor",
          alertedAt: null,
          alertSuppressed: false,
          dismissedUntil: null,
          modelHints: { from: prev.modelHints || [], to: p.modelHints || [] },
        });
      }
    }
  }

  return { changes, updatedPendingRemovals: updatedPending, providersToStore };
}

// ─── Alert delivery gating ───────────────────────────────

function isWithinQuietHours(settings: UserSettings, now: Date = new Date()): boolean {
  if (settings.quietHoursStart == null || settings.quietHoursEnd == null) return false;
  // Compute hour in user's timezone.
  let hour: number;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: settings.timezone || "UTC" });
    const parts = fmt.formatToParts(now).find((p) => p.type === "hour");
    hour = parts ? parseInt(parts.value, 10) : now.getUTCHours();
  } catch {
    hour = now.getUTCHours();
  }
  const start = settings.quietHoursStart;
  const end = settings.quietHoursEnd;
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  // wraps midnight (e.g., 22 → 7)
  return hour >= start || hour < end;
}

/** Decide whether a given change passes the user-level + entry-level filters. */
function shouldSendAlert(opts: {
  change: ChangeEvent & { providerDisplayName?: string | null };
  entry: Subscription;
  settings: UserSettings;
  isPro: boolean;
}): { ok: boolean; reason?: string } {
  const { change, entry, settings, isPro } = opts;

  // Entry alerts on at all?
  if (!entry.notifyOnChange) return { ok: false, reason: "entry-alerts-off" };
  if (entry.alertThreshold === "no_alerts") return { ok: false, reason: "entry-no-alerts" };

  // Per-domain threshold semantics:
  //   entry.alertThreshold === null   → inherit user's globalAlertThreshold
  //   entry.alertThreshold === <any>  → explicit override (including "any_change",
  //                                     "high_confidence_only", "provider_added_removed")
  // This lets a user set global=high_confidence_only but still pin a single
  // domain to any_change, or vice versa.
  const effectiveThreshold = entry.alertThreshold ?? settings.globalAlertThreshold;

  if (effectiveThreshold === "high_confidence_only") {
    const conf = (change.newConfidence || "").toLowerCase();
    if (conf !== "high") return { ok: false, reason: "below-high-confidence" };
  }
  if (effectiveThreshold === "provider_added_removed") {
    if (change.changeType !== "provider_added" && change.changeType !== "provider_removed") {
      return { ok: false, reason: "not-provider-add-remove" };
    }
  }

  // Min confidence to alert
  const minConf = (settings.minConfidenceToAlert || "medium").toLowerCase();
  const minRank = { low: 1, medium: 2, high: 3 }[minConf as "low" | "medium" | "high"] || 2;
  const rankMap: Record<string, number> = { low: 1, medium: 2, high: 3, none: 0 };
  const newRank = rankMap[(change.newConfidence || "none").toLowerCase()] || 0;
  // For provider_removed the new confidence is "none" — we always allow major changes through min filter
  if (change.severity === "minor" && newRank < minRank) {
    return { ok: false, reason: "below-min-confidence" };
  }

  // Free-plan weekly cap
  if (!isPro) {
    if ((settings.alertsThisWeek || 0) >= FREE_WEEKLY_ALERT_CAP) {
      return { ok: false, reason: "free-weekly-cap" };
    }
  }

  // Quiet hours
  if (isWithinQuietHours(settings)) return { ok: false, reason: "quiet-hours" };

  return { ok: true };
}

/**
 * Per-user frequency cap (configured in user_settings.alertFrequencyCap).
 * - "immediate"        → no extra throttle
 * - "max_1_per_day"    → suppress if any alert was delivered in the last 24h
 * - "max_1_per_week"   → suppress if any alert was delivered in the last 7d
 *
 * Implemented at delivery time (not in shouldSendAlert) so the change-event row
 * is still recorded; only the email/Slack send is suppressed.
 */
async function passesFrequencyCap(userId: string, settings: UserSettings): Promise<{ ok: boolean; reason?: string }> {
  const cap = settings.alertFrequencyCap || "immediate";
  if (cap === "immediate") return { ok: true };
  const windowMs = cap === "max_1_per_day" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - windowMs);
  const recentlyAlerted = await storage.hasUserAlertSince(userId, since);
  if (recentlyAlerted) return { ok: false, reason: `frequency-cap-${cap}` };
  return { ok: true };
}

// ─── Scan execution ──────────────────────────────────────

async function performScan(sub: Subscription & { planTier: string }, isManual: boolean = false): Promise<{ ok: boolean; scan?: Scan; reason?: string }> {
  // Atomic claim: bail out cleanly if another scanner (immediate-scan trigger or
  // another worker tick using a stale due-list) already owns this row.
  const claimed = await storage.claimSubscriptionForScan(sub.id);
  if (!claimed) {
    console.log(`[Worker] Skipping ${sub.domain}: scan already in progress`);
    return { ok: false, reason: "already-scanning" };
  }

  let scanResult;
  try {
    scanResult = await scanUrl(sub.url);
  } catch (err) {
    console.error(`[Worker] Scan failed for ${sub.domain}:`, err);
    await handleScanFailure(sub);
    return { ok: false, reason: "scan-error" };
  }

  // Save the scan record
  const insert: InsertScan = {
    url: scanResult.url,
    domain: normalizeDomain(scanResult.url),
    userId: sub.userId,
    framework: scanResult.framework || null,
    frameworkConfidence: scanResult.frameworkConfidence || null,
    hosting: scanResult.hosting || null,
    hostingConfidence: scanResult.hostingConfidence || null,
    payments: scanResult.payments || null,
    paymentsConfidence: scanResult.paymentsConfidence || null,
    auth: scanResult.auth || null,
    authConfidence: scanResult.authConfidence || null,
    analytics: scanResult.analytics || null,
    analyticsConfidence: scanResult.analyticsConfidence || null,
    support: scanResult.support || null,
    supportConfidence: scanResult.supportConfidence || null,
    aiProvider: scanResult.aiProvider || null,
    aiConfidence: scanResult.aiConfidence || null,
    aiTransport: scanResult.aiTransport || null,
    aiGateway: scanResult.aiGateway || null,
    scanPhases: { passive: "complete", render: "skipped", probe: "locked" },
    scanMode: "passive",
    evidence: scanResult.evidence || null,
  };
  const savedScan = await storage.createScan(insert);

  // Compute diff
  const priorProviders = (sub.providersDetected || []) as DetectedProvider[];
  const nextProviders = buildDetectedProviders(savedScan, priorProviders);
  const pendingRemovals = (sub.pendingRemovals || {}) as Record<string, number>;
  const diff = computeDiff(priorProviders, nextProviders, pendingRemovals, savedScan.id, sub.lastScanId || null);

  // Persist detected providers + reset failure counter
  await storage.updateSubscription(sub.id, {
    lastScannedAt: new Date(),
    lastScanId: savedScan.id,
    scanStatus: "complete",
    consecutiveFailures: 0,
    unreachableNotifiedAt: null,
    nextScanAt: nextScanTime(sub.planTier),
    providersDetected: diff.providersToStore,
    pendingRemovals: diff.updatedPendingRemovals,
    lastChangedAt: diff.changes.length > 0 ? new Date() : sub.lastChangedAt,
  });

  // Record changes + deliver alerts
  for (const change of diff.changes) {
    const event = await storage.createChangeEvent({
      ...change,
      subscriptionId: sub.id,
    });
    await deliverAlert(sub, event);
  }

  return { ok: true, scan: savedScan };
}

async function handleScanFailure(sub: Subscription): Promise<void> {
  const failures = (sub.consecutiveFailures || 0) + 1;
  const isUnreachable = failures >= MAX_RETRIES;
  const planTier = (await storage.getUser(sub.userId))?.planTier || "free";

  await storage.updateSubscription(sub.id, {
    consecutiveFailures: failures,
    scanStatus: isUnreachable ? "unreachable" : "error",
    nextScanAt: isUnreachable
      ? nextScanTime(planTier) // back to normal cadence
      : new Date(Date.now() + RETRY_DELAY_MS),
  });

  // One-time unreachable email
  if (isUnreachable && !sub.unreachableNotifiedAt) {
    const user = await storage.getUser(sub.userId);
    if (user?.email) {
      console.log(`[Worker] Site unreachable: ${sub.domain} — notifying ${user.email}`);
      await sendSiteUnreachableEmail(user.email, sub.domain);
      await storage.updateSubscription(sub.id, { unreachableNotifiedAt: new Date() });
    }
  }
}

// ─── Alert delivery ──────────────────────────────────────

async function deliverAlert(sub: Subscription, change: ChangeEvent): Promise<void> {
  const user = await storage.getUser(sub.userId);
  if (!user) return;
  const isPro = user.planTier === "pro";

  // Ensure user_settings exists
  let settings = await storage.getUserSettings(sub.userId);
  if (!settings) {
    settings = await storage.upsertUserSettings(sub.userId, {});
  }

  // Reset weekly cap if needed (rolling 7-day window)
  if (!settings.weekResetAt || new Date(settings.weekResetAt).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) {
    settings = await storage.upsertUserSettings(sub.userId, {
      alertsThisWeek: 0,
      weekResetAt: new Date(),
    });
  }

  // Dedup: rolling 24-hour window keyed by (subscription, provider, changeType).
  //
  // Design note: we deliberately use a rolling 24h window (based on the most
  // recent `alertedAt` timestamp on a sibling change_event) rather than a
  // calendar-day "(entry, provider, changeType, date)" composite key. Two
  // reasons:
  //   1) Calendar-day buckets emit 2 alerts within minutes when a flap straddles
  //      midnight (e.g. 23:59 UTC then 00:01 UTC the next day) — a rolling
  //      window naturally suppresses that.
  //   2) For users in different timezones, "date" is ambiguous; rolling 24h is
  //      timezone-neutral and matches our quiet-hours / weekly-cap semantics
  //      which are also wall-clock-based off the user's stored timezone.
  // If a per-day composite key is ever needed for the playbook's "exact" wording,
  // it can be layered on top of this without changing the dedup intent.
  // In daily-bundle mode, alertedAt is deliberately deferred until the bundle
  // flush — so a pure alertedAt-based lookup would miss identical events that
  // are queued in the current pending bundle. Pass includePendingBundle so the
  // dedup check also catches non-suppressed pending events in the window.
  const includePendingBundle = settings.alertDigestMode === "daily_bundle";
  const recent = await storage.findRecentAlert(
    sub.id,
    change.provider || "",
    change.changeType,
    ALERT_DEDUP_MS,
    // Exclude the just-persisted current event so it cannot match itself in
    // the include-pending lookup (the event is created upstream by computeDiff
    // before deliverAlert runs and lives within the dedup window).
    { includePendingBundle, excludeChangeEventId: change.id }
  );
  if (recent) {
    console.log(`[Alerts] Suppressed (dedup) for ${sub.domain} ${change.changeType} ${change.provider}`);
    await db.update(changeEvents).set({ alertSuppressed: true }).where(eq(changeEvents.id, change.id));
    return;
  }

  // False-positive dismissal
  if (change.provider) {
    const dismissed = await storage.hasActiveDismissal(sub.id, change.provider, change.newConfidence);
    if (dismissed) {
      console.log(`[Alerts] Suppressed (dismissed) for ${sub.domain} ${change.provider}`);
      await db.update(changeEvents).set({ alertSuppressed: true }).where(eq(changeEvents.id, change.id));
      return;
    }
  }

  const decision = shouldSendAlert({ change, entry: sub, settings, isPro });
  if (!decision.ok) {
    console.log(`[Alerts] Suppressed (${decision.reason}) for ${sub.domain} ${change.changeType}`);
    await db.update(changeEvents).set({ alertSuppressed: true }).where(eq(changeEvents.id, change.id));
    return;
  }

  // Per-user frequency cap (immediate / max_1_per_day / max_1_per_week)
  const freq = await passesFrequencyCap(sub.userId, settings);
  if (!freq.ok) {
    console.log(`[Alerts] Suppressed (${freq.reason}) for ${sub.domain} ${change.changeType}`);
    await db.update(changeEvents).set({ alertSuppressed: true }).where(eq(changeEvents.id, change.id));
    return;
  }

  // Build before/after provider lists for the email
  const toEmailState = (p: DetectedProvider): ProviderStateForEmail => ({
    provider: p.provider,
    displayName: p.displayName,
    confidence: p.confidence,
    modelHints: p.modelHints,
  });
  const before: ProviderStateForEmail[] = (sub.providersDetected ?? []).map(toEmailState);
  // After = current (already updated on the entry by performScan)
  const updatedSub = await storage.getSubscription(sub.id);
  const after: ProviderStateForEmail[] = (updatedSub?.providersDetected ?? []).map(toEmailState);

  const evidenceSignals = await buildEvidenceSignals(sub, change);

  let emailOk = false;
  let slackOk = false;

  // Daily-bundle mode: defer the email; the bundle cron will send a single
  // grouped email per user. Slack still fires immediately because Slack is
  // intended as a real-time channel.
  const deferEmailForBundle =
    settings.alertDigestMode === "daily_bundle" &&
    settings.emailAlertsEnabled &&
    user.notificationsEnabled !== false;

  if (settings.emailAlertsEnabled && user.notificationsEnabled !== false && !deferEmailForBundle) {
    emailOk = await sendStackChangeAlertEmail({
      to: user.email,
      domain: sub.domain,
      change,
      beforeProviders: before,
      afterProviders: after,
      evidenceSignals,
      scanUrl: `${APP_URL}/scan/${sub.domain}`,
      priorScanAt: sub.lastScannedAt,
    });
  } else if (deferEmailForBundle) {
    console.log(
      `[Alerts] Deferred email for daily bundle: ${sub.domain} ${change.changeType} ${change.provider}`
    );
  }

  if (isPro && sub.slackEnabled && settings.slackAlertsEnabled && settings.slackWebhookUrl) {
    slackOk = await sendStackChangeSlack({
      webhookUrl: settings.slackWebhookUrl,
      domain: sub.domain,
      change,
      beforeProviders: before,
      afterProviders: after,
      scanUrl: `${APP_URL}/scan/${sub.domain}`,
    });
  }

  // If the email is being deferred for a daily bundle, do NOT mark the event
  // as alerted yet — the bundle cron must still pick it up. Slack delivery is
  // intentionally fire-and-forget in real time and does not consume the
  // bundle-eligibility window.
  if (deferEmailForBundle) {
    if (slackOk && !isPro) {
      // Free users don't have Slack, but keep the cap accounting consistent
      // for safety if that invariant ever changes.
      await storage.upsertUserSettings(sub.userId, {
        alertsThisWeek: (settings.alertsThisWeek || 0) + 1,
        weekResetAt: settings.weekResetAt || new Date(),
      });
    }
    return;
  }

  if (emailOk || slackOk) {
    await storage.markChangeEventAlerted(change.id);
    if (!isPro) {
      await storage.upsertUserSettings(sub.userId, {
        alertsThisWeek: (settings.alertsThisWeek || 0) + 1,
        weekResetAt: settings.weekResetAt || new Date(),
      });
    }
  }
}

async function buildEvidenceSignals(sub: Subscription, change: ChangeEvent): Promise<string[]> {
  const out: string[] = [];
  // Prefer the new_scan_id from the change event itself — that's the scan
  // that actually triggered this alert. Fall back to sub.lastScanId only if
  // the event is missing it (defensive; should not happen for diff-emitted
  // events). Using change.newScanId yields evidence text that matches the
  // exact scan whose state caused the provider_added/removed/transition.
  const scanId = change.newScanId || sub.lastScanId;
  if (!scanId) return out;
  const scan = await storage.getScan(scanId);
  if (!scan) return out;
  const ev = (scan.evidence ?? null) as {
    scripts?: string[];
    networkDomains?: string[];
    patterns?: string[];
  } | null;
  if (!ev) return out;
  if (Array.isArray(ev.scripts) && ev.scripts.length) out.push(`Scripts detected: ${ev.scripts.slice(0, 2).join(", ")}`);
  if (Array.isArray(ev.networkDomains) && ev.networkDomains.length) {
    const aiDomain = ev.networkDomains.find((d: string) =>
      /openai|anthropic|googleapis|azure|cohere|mistral|bedrock/.test(d)
    );
    if (aiDomain) out.push(`Network call to ${aiDomain}`);
  }
  if (Array.isArray(ev.patterns) && ev.patterns.length) out.push(`API endpoint pattern: ${ev.patterns[0]}`);
  if (scan.aiTransport) out.push(`Transport: ${scan.aiTransport}`);
  if (scan.aiGateway) out.push(`AI gateway: ${scan.aiGateway}`);
  if (out.length === 0) out.push("Confidence derived from passive HTML + header analysis");
  return out.slice(0, 4);
}

// ─── Manual scan-now (Pro feature: 3 per rolling 24h) ────
//
// Per playbook done-criteria: manual rescan is a Pro-only feature
// capped at 3 per rolling 24h. Free users see the button as an
// upsell prompt but the API rejects with `error: "pro-only"`.

const MANUAL_SCAN_LIMIT_PRO = 3;

/**
 * Run a one-shot scan for a freshly-added subscription, bypassing the manual-scan
 * rate limit (this is the "first scan on add" baseline, not a user-initiated rescan).
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function triggerImmediateScan(subscriptionId: string): Promise<void> {
  try {
    const sub = await storage.getSubscription(subscriptionId);
    if (!sub) return;
    const user = await storage.getUser(sub.userId);
    if (!user) return;
    await performScan({ ...sub, planTier: user.planTier }, /* isManual */ true);
  } catch (err) {
    console.error(`[Worker] triggerImmediateScan failed for ${subscriptionId}:`, err);
  }
}

export async function manualScanNow(subscriptionId: string): Promise<{ ok: boolean; reason?: string; scan?: Scan }> {
  const sub = await storage.getSubscription(subscriptionId);
  if (!sub) return { ok: false, reason: "not-found" };
  const user = await storage.getUser(sub.userId);
  if (!user) return { ok: false, reason: "no-user" };
  const isPro = user.planTier === "pro";

  // Pro-only feature: free users get the upsell prompt in UI, API rejects.
  if (!isPro) {
    return { ok: false, reason: "pro-only" };
  }

  // Reset counter if 24h window elapsed.
  const now = new Date();
  const windowMs = 24 * 60 * 60 * 1000;
  const resetAt = sub.manualScanResetAt ? new Date(sub.manualScanResetAt) : null;
  let used = sub.manualScansToday || 0;
  let resetWindow: Date = resetAt ?? now;
  if (!resetAt || resetAt.getTime() < Date.now() - windowMs) {
    used = 0;
    resetWindow = now;
  }

  if (used >= MANUAL_SCAN_LIMIT_PRO) {
    return { ok: false, reason: "limit-3-per-day" };
  }

  await storage.updateSubscription(sub.id, {
    manualScansToday: used + 1,
    manualScanResetAt: resetWindow as Date,
  });

  const result = await performScan({ ...sub, planTier: user.planTier }, true);
  return { ok: result.ok, reason: result.reason, scan: result.scan };
}

// ─── Scan loop ───────────────────────────────────────────

async function runScanCycle(): Promise<void> {
  try {
    const due = await storage.getDueSubscriptions(new Date());
    if (due.length === 0) return;
    console.log(`[Worker] ${due.length} watchlist entries due for scan`);
    for (const sub of due) {
      try {
        await performScan(sub);
      } catch (err) {
        console.error(`[Worker] Unexpected error scanning ${sub.domain}:`, err);
      }
      // Small spacing between scans to avoid hammering hosts
      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch (err) {
    console.error("[Worker] Scan cycle error:", err);
  }
}

// ─── Weekly digest cron ──────────────────────────────────

async function runDigestCycle(): Promise<void> {
  try {
    const now = new Date();
    // Defensive backfill: ensure every user with at least one watchlist
    // subscription has a user_settings row with default digestEnabled=true.
    // Without this, users who add watchlist entries but never visit
    // /settings/alerts would never appear in getUsersDueForDigest (which
    // inner-joins user_settings) — including the Monday "no changes" digest.
    try {
      const inserted = await storage.backfillUserSettingsForWatchers();
      if (inserted > 0) {
        console.log(`[Worker] Digest backfill: created ${inserted} default user_settings rows`);
      }
    } catch (err) {
      console.error("[Worker] Digest backfill failed (continuing):", err);
    }

    // Only send digests during a Monday 7-12 AM window per user TZ
    const dueUsers = await storage.getUsersDueForDigest(now);
    if (dueUsers.length === 0) return;

    for (const user of dueUsers) {
      const settings = await storage.getUserSettings(user.id);
      if (!settings || !settings.digestEnabled) continue;

      // Compute the user-local hour to gate by Monday 7-12 AM
      let userHour = 8;
      let userDay = 1;
      try {
        const tzFmt = new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          hour: "numeric",
          hour12: false,
          timeZone: settings.timezone || "UTC",
        });
        const parts = tzFmt.formatToParts(now);
        userHour = parseInt(parts.find((p) => p.type === "hour")?.value || "8", 10);
        const wk = parts.find((p) => p.type === "weekday")?.value || "Mon";
        userDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wk);
      } catch {
        // fall through
      }
      // Monday morning gate: weekday=1 and hour 7-11 inclusive
      if (userDay !== 1 || userHour < 7 || userHour > 11) continue;

      await sendDigestToUser(user, settings);
    }
  } catch (err) {
    console.error("[Worker] Digest cycle error:", err);
  }
}

async function sendDigestToUser(user: User, settings: UserSettings): Promise<void> {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const watchlist = await storage.getUserSubscriptions(user.id);
  const events = await storage.getChangeEventsForUser(user.id, weekStart);

  const isPro = user.planTier === "pro";

  const changes: DigestChangeRow[] = events.slice(0, 25).map((e) => ({
    domain: watchlist.find((w) => w.id === e.subscriptionId)?.domain || "—",
    changeType: e.changeType,
    severity: (e.severity as "major" | "minor") || "major",
    provider: e.providerDisplayName || e.provider || "AI provider",
    newConfidence: e.newConfidence,
    priorConfidence: e.priorConfidence,
    detectedAt: e.detectedAt,
    scanUrl: `${APP_URL}/scan/${watchlist.find((w) => w.id === e.subscriptionId)?.domain || ""}`,
    note: e.severity === "minor" ? "May be a temporary detection fluctuation." : undefined,
  }));

  const digestList: DigestWatchlistRow[] = watchlist.map((w) => {
    const detected = (w.providersDetected || []) as Array<{ displayName: string; confidence: "high" | "medium" | "low" }>;
    const highest = detected.reduce<"high" | "medium" | "low" | null>((acc, p) => {
      const r = bandRank(p.confidence);
      const accR = acc ? bandRank(acc) : 0;
      return r > accR ? p.confidence : acc;
    }, null);
    return {
      domain: w.domain,
      providers: detected.map((p) => p.displayName),
      highestConfidence: highest,
      lastChangedAt: w.lastChangedAt,
      changedThisWeek: w.lastChangedAt ? new Date(w.lastChangedAt).getTime() >= weekStart.getTime() : false,
    };
  });

  // Trending: stub for MVP — derived from aggregate change counts in the last 7 days.
  const trending = isPro ? await computeTrendingBullets(weekStart) : [];

  try {
    const sent = await sendWeeklyDigestEmail({
      to: user.email,
      weekStart,
      weekEnd: now,
      changes,
      watchlist: digestList,
      trending,
      isPro,
    });
    // Only mark as sent on confirmed success — otherwise a transient failure would
    // be permanently treated as delivered, dropping the user's digest for a full week.
    if (sent !== false) {
      await storage.markDigestSent(user.id);
    } else {
      console.warn(`[Worker] Digest send returned falsy for ${user.email}; will retry next cycle`);
    }
  } catch (err) {
    console.error(`[Worker] Failed to send digest to ${user.email}:`, err);
    // Intentionally do NOT call markDigestSent — the next cron tick will retry.
  }
}

async function computeTrendingBullets(weekStart: Date): Promise<Array<{ emoji: string; headline: string; body: string }>> {
  // MVP: pull recent change events across all users to count per-provider deltas.
  const recent = await db
    .select()
    .from(changeEvents)
    .where(gte(changeEvents.detectedAt, weekStart));
  if (recent.length < 5) return []; // sample-size guard (tightened in production to 50 per playbook)

  const addCount = new Map<string, number>();
  const removeCount = new Map<string, number>();
  for (const e of recent) {
    if (!e.provider) continue;
    if (e.changeType === "provider_added") addCount.set(e.provider, (addCount.get(e.provider) || 0) + 1);
    if (e.changeType === "provider_removed") removeCount.set(e.provider, (removeCount.get(e.provider) || 0) + 1);
  }

  const sorted = Array.from(addCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return sorted.map(([provider, count]) => ({
    emoji: "📈",
    headline: `${buildDisplayName(provider)} up — detected on ${count} new ${count === 1 ? "domain" : "domains"} this week`,
    body: `${buildDisplayName(provider)} appeared as a new provider on ${count} watched ${count === 1 ? "domain" : "domains"} this week.`,
  }));
}

// ─── Daily bundle cron ───────────────────────────────────

/**
 * For users whose alertDigestMode = "daily_bundle", deliverAlert defers email
 * sends. This cron runs hourly: for each such user, it gathers any unalerted
 * change events from the last ~25h and sends a single grouped email, then
 * marks all included events as alerted.
 */
async function runDailyBundleCycle(): Promise<void> {
  try {
    const now = new Date();
    const sinceWindow = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const minBundleGap = 22 * 60 * 60 * 1000; // don't send a 2nd bundle within 22h

    const dueUsers = await storage.getUsersWithDailyBundleMode();
    if (dueUsers.length === 0) return;

    for (const user of dueUsers) {
      const settings = await storage.getUserSettings(user.id);
      if (!settings || !settings.emailAlertsEnabled || settings.alertDigestMode !== "daily_bundle") continue;
      if (user.notificationsEnabled === false) continue;

      // Throttle: don't send twice within 22h
      if (settings.lastDailyBundleAt && now.getTime() - new Date(settings.lastDailyBundleAt).getTime() < minBundleGap) {
        continue;
      }

      const pending = await storage.getPendingBundleEventsForUser(user.id, sinceWindow);
      if (pending.length === 0) continue;

      const watchlist = await storage.getUserSubscriptions(user.id);
      const isPro = user.planTier === "pro";
      const weekStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const changes: DigestChangeRow[] = pending.slice(0, 25).map((e) => ({
        domain: watchlist.find((w) => w.id === e.subscriptionId)?.domain || "—",
        changeType: e.changeType,
        severity: (e.severity as "major" | "minor") || "major",
        provider: e.providerDisplayName || e.provider || "AI provider",
        newConfidence: e.newConfidence,
        priorConfidence: e.priorConfidence,
        detectedAt: e.detectedAt,
        scanUrl: `${APP_URL}/scan/${watchlist.find((w) => w.id === e.subscriptionId)?.domain || ""}`,
        note: e.severity === "minor" ? "May be a temporary detection fluctuation." : undefined,
      }));

      const digestList: DigestWatchlistRow[] = watchlist.map((w) => {
        const detected = (w.providersDetected || []) as Array<{ displayName: string; confidence: "high" | "medium" | "low" }>;
        const highest = detected.reduce<"high" | "medium" | "low" | null>((acc, p) => {
          const r = bandRank(p.confidence);
          const accR = acc ? bandRank(acc) : 0;
          return r > accR ? p.confidence : acc;
        }, null);
        return {
          domain: w.domain,
          providers: detected.map((p) => p.displayName),
          highestConfidence: highest,
          lastChangedAt: w.lastChangedAt,
          changedThisWeek: w.lastChangedAt ? new Date(w.lastChangedAt).getTime() >= weekStart.getTime() : false,
        };
      });

      try {
        const sent = await sendWeeklyDigestEmail({
          to: user.email,
          weekStart,
          weekEnd: now,
          changes,
          watchlist: digestList,
          trending: [],
          isPro,
          subjectOverride: `Daily AI stack bundle — ${pending.length} ${pending.length === 1 ? "change" : "changes"}`,
        });
        if (sent !== false) {
          await storage.markChangeEventsAlertedBulk(pending.map((e) => e.id));
          await storage.markDailyBundleSent(user.id);
          console.log(`[Worker] Daily bundle sent to ${user.email}: ${pending.length} events`);
        } else {
          console.warn(`[Worker] Daily bundle send returned falsy for ${user.email}; will retry next cycle`);
        }
      } catch (err) {
        console.error(`[Worker] Failed to send daily bundle to ${user.email}:`, err);
      }
    }
  } catch (err) {
    console.error("[Worker] Daily bundle cycle error:", err);
  }
}

// ─── Tracked-company scan cycle (Task #3) ────────────────
//
// The seeded tracked_companies list (50 SaaS products) backs the public
// /stack and /leaderboard pages. Each row is rescanned on a 7-day cadence
// (with the same ±2h jitter as user watchlists). A row that has never been
// scanned (lastScannedAt IS NULL) is treated as immediately due so the first
// boot after deploy backfills every company.
//
// We deliberately scan a small batch per tick (TRACKED_BATCH) so playwright
// load stays bounded if many companies are due simultaneously. Each scan also
// stamps the company's lastScanId / lastScannedAt / nextScanAt and tracks the
// week-over-week providerChangedAt delta used by the leaderboard.
const TRACKED_BATCH = 5;

async function runTrackedCompanyScans(): Promise<void> {
  try {
    const due = await storage.getCompaniesNeedingScan(new Date(), TRACKED_BATCH);
    if (due.length === 0) return;
    console.log(`[Worker] Tracked-company scan: ${due.length} due`);

    for (const company of due) {
      // Atomic optimistic claim — only succeeds if no other tick has the row
      // marked "scanning". Prevents double-scans when two ticks pick the
      // same row up before either flips its status.
      const claimed = await storage.claimTrackedCompanyForScan(company.id);
      if (!claimed) continue;

      try {
        const result = await scanUrl(company.url);
        // Persist a scan row identical in shape to the public /api/scan path
        // so the same Scan UI renders cleanly on /stack/[slug].
        const enriched = {
          ...result,
          scanPhases: { passive: "complete", render: "skipped", probe: "locked" },
          scanMode: "passive",
        } as unknown as InsertScan;

        const savedScan = await storage.createScan(enriched);

        // Compute provider-changed-at: only stamp if the *primary* provider's
        // canonical name flipped (case-insensitive). Confidence-only changes
        // don't count, and a transition into/out of null does count.
        const oldP = (company.priorAiProvider || "").toLowerCase();
        const newP = (savedScan.aiProvider || "").toLowerCase();
        const providerChanged = oldP !== newP;

        // 7-day cadence with ±2h jitter (Free-equivalent — tracked
        // companies are public-facing and don't get the Pro 24h cadence).
        const next = new Date(Date.now() + FREE_CADENCE_MS + (Math.random() * 2 - 1) * JITTER_MS);

        await storage.updateTrackedCompany(company.id, {
          lastScanId: savedScan.id,
          lastScannedAt: new Date(),
          nextScanAt: next,
          scanStatus: "ok",
          priorAiProvider: savedScan.aiProvider,
          priorAiConfidence: savedScan.aiConfidence,
          providerChangedAt: providerChanged ? new Date() : company.providerChangedAt,
        });
      } catch (err) {
        console.error(`[Worker] Tracked scan failed for ${company.slug}:`, err);
        // Failure: shorter retry window so the next tick picks it back up.
        const retryAt = new Date(Date.now() + RETRY_DELAY_MS);
        await storage.updateTrackedCompany(company.id, {
          scanStatus: "failed",
          nextScanAt: retryAt,
        });
      }
    }
  } catch (err) {
    console.error("[Worker] runTrackedCompanyScans error:", err);
  }
}

// ─── Weekly leaderboard snapshot ─────────────────────────
// Runs hourly; only writes a fresh snapshot if the current ISO week
// (e.g. "2026-W17") doesn't already have one. We capture a frozen,
// rank-ordered payload + headline stats so /leaderboard/:week and the
// weekly OG-image route can serve historical data without re-joining live.

function getIsoWeek(d: Date = new Date()): string {
  // Standard ISO 8601 week-numbering: Thursday determines the week.
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function runWeeklySnapshotCycle(): Promise<void> {
  try {
    const week = getIsoWeek();
    const existing = await storage.getLeaderboardSnapshot(week);
    if (existing) return; // already captured this week

    const rows = await storage.getLeaderboardRows();
    if (rows.length === 0) return;

    const providerCounts = new Map<string, number>();
    for (const r of rows) {
      const p = r.lastScan?.aiProvider || "Unknown";
      providerCounts.set(p, (providerCounts.get(p) || 0) + 1);
    }
    const ranked = Array.from(providerCounts.entries()).sort((a, b) => b[1] - a[1]);
    const topProvider = ranked[0]?.[0] ?? null;

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const changesCount = rows.filter(
      (r) => r.providerChangedAt && new Date(r.providerChangedAt) >= cutoff,
    ).length;

    const compactRows = rows.map((r, idx) => ({
      rank: idx + 1,
      slug: r.slug,
      name: r.name,
      domain: r.domain,
      category: r.category,
      ycBatch: r.ycBatch,
      provider: r.lastScan?.aiProvider ?? null,
      confidence: r.lastScan?.aiConfidence ?? null,
      gateway: r.lastScan?.aiGateway ?? null,
      framework: r.lastScan?.framework ?? null,
      hosting: r.lastScan?.hosting ?? null,
      lastScannedAt: r.lastScannedAt,
    }));

    await storage.upsertLeaderboardSnapshot({
      isoWeek: week,
      totalCompanies: rows.length,
      topProvider,
      changesCount,
      payload: {
        capturedAt: new Date().toISOString(),
        providerDistribution: Object.fromEntries(ranked),
        rows: compactRows,
      },
    });
    console.log(`[Worker] Wrote leaderboard snapshot for ${week} (${rows.length} rows, top=${topProvider})`);
  } catch (err) {
    console.error("[Worker] runWeeklySnapshotCycle error:", err);
  }
}

// ─── Stub-page drain — bulk-imported rows that were never scanned ────────
// Programmatic SEO concern: a CSV import can dump 1,000+ rows into
// `tracked_companies` at once. We don't want to fan out 1,000 simultaneous
// fetches, so we drain at most STUB_DRAIN_PER_TICK per tick (default 5)
// with at most STUB_DRAIN_PER_HOST_MAX in-flight per host (default 1).
// Once a row gets its first scan, the regular `runTrackedCompanyScans`
// 7-day cadence loop owns it.
const STUB_DRAIN_PER_TICK = Math.max(1, Number(process.env.STUB_DRAIN_PER_TICK ?? 5));
const STUB_DRAIN_PER_HOST_MAX = Math.max(1, Number(process.env.STUB_DRAIN_PER_HOST_MAX ?? 1));
const STUB_DRAIN_TICK_MS = 5 * 60 * 1000; // every 5 minutes — independent of the 7-day rescan loop

async function runStubDrainCycle(): Promise<void> {
  try {
    const due = await storage.getCompaniesNeedingFirstScan(STUB_DRAIN_PER_TICK, STUB_DRAIN_PER_HOST_MAX);
    if (due.length === 0) return;
    console.log(`[Worker] Stub drain: ${due.length} unscanned (per-host cap=${STUB_DRAIN_PER_HOST_MAX})`);

    for (const company of due) {
      // Same atomic claim as the rescan loop.
      const claimed = await storage.claimTrackedCompanyForScan(company.id);
      if (!claimed) continue;

      try {
        const result = await scanUrl(company.url);
        const enriched = {
          ...result,
          scanPhases: { passive: "complete", render: "skipped", probe: "locked" },
          scanMode: "passive",
        } as unknown as InsertScan;

        const savedScan = await storage.createScan(enriched);
        const next = new Date(Date.now() + FREE_CADENCE_MS + (Math.random() * 2 - 1) * JITTER_MS);
        await storage.updateTrackedCompany(company.id, {
          lastScanId: savedScan.id,
          lastScannedAt: new Date(),
          nextScanAt: next,
          scanStatus: "ok",
          priorAiProvider: savedScan.aiProvider,
          priorAiConfidence: savedScan.aiConfidence,
        });
      } catch (err) {
        console.error(`[Worker] Stub-drain scan failed for ${company.slug}:`, err);
        const retryAt = new Date(Date.now() + RETRY_DELAY_MS);
        await storage.updateTrackedCompany(company.id, {
          scanStatus: "failed",
          nextScanAt: retryAt,
        });
      }
    }
  } catch (err) {
    console.error("[Worker] runStubDrainCycle error:", err);
  }
}

// ─── Public entry point ──────────────────────────────────

export function startBackgroundWorker(): void {
  console.log("[Worker] Background worker starting…");
  // Initial delay to let the server boot
  setTimeout(async () => {
    await runScanCycle();
    await runDigestCycle();
    await runDailyBundleCycle();
    await runTrackedCompanyScans();
    await runStubDrainCycle();
    await runWeeklySnapshotCycle();
  }, 60 * 1000);

  // Scan loop
  setInterval(runScanCycle, WORKER_TICK_MS);
  // Weekly digest loop — checks every 30 minutes for users whose Monday-morning window is open
  setInterval(runDigestCycle, 30 * 60 * 1000);
  // Daily bundle loop — runs hourly to flush deferred events for daily_bundle users
  setInterval(runDailyBundleCycle, 60 * 60 * 1000);
  // Tracked-company scan loop — runs every 10 min, batches 5 due companies per tick
  setInterval(runTrackedCompanyScans, WORKER_TICK_MS);
  // Stub-drain loop — picks up newly-imported, never-scanned companies every 5 min
  setInterval(runStubDrainCycle, STUB_DRAIN_TICK_MS);
  // Weekly snapshot loop — runs hourly; idempotent (no-op if this week's snapshot already exists)
  setInterval(runWeeklySnapshotCycle, 60 * 60 * 1000);

  console.log("[Worker] Background worker scheduled");
}

// Re-export the diff for unit testing if needed
export { computeDiff, normalizeConfidence, scoreToBand };
