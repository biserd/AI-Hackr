import { Resend } from "resend";
import type { Subscription, ChangeEvent } from "@shared/schema";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "AIHackr <hello@aihackr.com>";
const FROM_ALERTS = "AIHackr Alerts <hello@aihackr.com>";
const FROM_DIGEST = "AIHackr Weekly <hello@aihackr.com>";
const ADMIN_EMAIL = "hello@bigappledigital.nyc";
const APP_URL = process.env.APP_URL || "https://aihackr.com";

// ─────────────────────────────────────────────────────────
// Magic link (unchanged)
// ─────────────────────────────────────────────────────────
export async function sendMagicLinkEmail(email: string, magicLink: string): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Sign in to AIHackr",
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 40px 20px; margin: 0; line-height: 1.6;">
          <div style="max-width: 480px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 14px; margin-bottom: 16px;">
                <span style="font-size: 24px; color: white; font-weight: bold;">A</span>
              </div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #0f172a;">AIHackr</h1>
            </div>
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px;">
              <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #0f172a;">Welcome back</h2>
              <p style="margin: 0 0 28px; color: #64748b; font-size: 15px;">Click the button below to securely sign in. This link expires in 15 minutes.</p>
              <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px;">Sign in to AIHackr</a>
              <div style="margin-top: 28px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 13px; color: #94a3b8;">If you didn't request this email, you can safely ignore it.</p>
              </div>
            </div>
            <div style="margin-top: 32px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #94a3b8;">AI provider intelligence for SaaS</p>
              <p style="margin: 0; font-size: 12px; color: #cbd5e1;">aihackr.com</p>
            </div>
          </div>
        </body></html>
      `,
    });
    if (error) {
      console.error("[Email] Magic link send failed:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Email] Magic link error:", error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Stack-change alert (per playbook spec §3.1)
// ─────────────────────────────────────────────────────────
export interface ProviderStateForEmail {
  provider: string;
  displayName: string;
  confidence: "high" | "medium" | "low";
  modelHints?: string[];
}

export interface StackChangeAlertOptions {
  to: string;
  domain: string;
  change: ChangeEvent;
  beforeProviders: ProviderStateForEmail[];
  afterProviders: ProviderStateForEmail[];
  evidenceSignals: string[];
  scanUrl: string;
  priorScanAt: Date | string | null;
}

function confidenceLabel(level: string | null | undefined): string {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  if (level === "low") return "Low";
  return "—";
}

function changeVerb(changeType: string): string {
  switch (changeType) {
    case "provider_added":
      return "just added";
    case "provider_removed":
      return "just dropped";
    case "confidence_upgraded":
      return "upgraded confidence on";
    case "confidence_downgraded":
      return "downgraded confidence on";
    case "model_hint_changed":
      return "changed model hints on";
    default:
      return "changed";
  }
}

/**
 * Subject-line formula from playbook:
 *   [AIHackr] {domain} just {change_verb} {Provider}     (major)
 *   [AIHackr] {domain} — confidence update on {Provider} (minor)
 */
function buildSubject(opts: StackChangeAlertOptions): string {
  const { domain, change } = opts;
  const provider = change.providerDisplayName || change.provider || "AI provider";
  if (change.severity === "minor") {
    return `[AIHackr] ${domain} — confidence update on ${provider}`;
  }
  if (change.changeType === "provider_added") {
    return `[AIHackr] ${domain} just added ${provider}`;
  }
  if (change.changeType === "provider_removed") {
    return `[AIHackr] ${domain} just dropped ${provider}`;
  }
  return `[AIHackr] ${domain} — AI stack change detected`;
}

export async function sendStackChangeAlertEmail(opts: StackChangeAlertOptions): Promise<boolean> {
  try {
    const { to, domain, change, beforeProviders, afterProviders, evidenceSignals, scanUrl, priorScanAt } = opts;
    const subject = buildSubject(opts);
    const isMinor = change.severity === "minor";
    const detectedAt = change.detectedAt
      ? new Date(change.detectedAt).toLocaleString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
          timeZoneName: "short",
        })
      : "";
    const priorScanLabel = priorScanAt
      ? new Date(priorScanAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "—";

    // Build the "What changed" rows
    const rows: string[] = [];
    afterProviders.forEach((p) => {
      const wasBefore = beforeProviders.find((b) => b.provider === p.provider);
      const isNew = !wasBefore;
      const tag = isNew ? "✅ NEW" : "✓ Still";
      const color = isNew ? "#166534" : "#475569";
      rows.push(`
        <tr>
          <td style="padding: 8px 0; color: ${color}; font-weight: 600; font-size: 14px;">${tag}</td>
          <td style="padding: 8px 12px; color: #0f172a; font-size: 14px;">${p.displayName}${p.modelHints?.length ? ` (${p.modelHints[0]})` : ""}</td>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px; text-align: right;">${confidenceLabel(p.confidence)} confidence</td>
        </tr>
      `);
    });
    beforeProviders.forEach((b) => {
      if (!afterProviders.find((a) => a.provider === b.provider)) {
        rows.push(`
          <tr>
            <td style="padding: 8px 0; color: #dc2626; font-weight: 600; font-size: 14px;">❌ REMOVED</td>
            <td style="padding: 8px 12px; color: #0f172a; font-size: 14px;">${b.displayName}</td>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px; text-align: right;">was ${confidenceLabel(b.confidence)}</td>
          </tr>
        `);
      }
    });

    const evidenceList = evidenceSignals.length
      ? `<ul style="margin: 0 0 20px; padding-left: 20px; color: #475569; font-size: 13px;">${evidenceSignals.map((s) => `<li style="margin-bottom: 6px;">${s}</li>`).join("")}</ul>`
      : "";

    const minorNote = isMinor
      ? `<div style="background: #fef3c7; border-left: 3px solid #f59e0b; padding: 12px 14px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #92400e;">
           <strong>Note:</strong> This may be a temporary detection change. We recommend verifying before acting.
         </div>`
      : "";

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 40px 20px; margin: 0; line-height: 1.5;">
        <div style="max-width: 560px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #0f172a;">AIHackr Stack Alert</h1>
          </div>

          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px;">
            <p style="margin: 0 0 16px; color: #64748b; font-size: 14px;">AI stack change detected on</p>
            <h2 style="margin: 0 0 8px; font-size: 22px; color: #0f172a;">${domain}</h2>
            <p style="margin: 0 0 24px; color: #475569; font-size: 15px;">${domain} ${changeVerb(change.changeType)} <strong>${change.providerDisplayName || change.provider || ""}</strong>.</p>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
              <h3 style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">What changed</h3>
              <table style="width: 100%; border-collapse: collapse;">${rows.join("")}</table>
            </div>

            <div style="margin: 20px 0; font-size: 13px; color: #94a3b8;">
              <div><strong style="color: #475569;">Detected:</strong> ${detectedAt}</div>
              <div><strong style="color: #475569;">Prior scan:</strong> ${priorScanLabel}</div>
            </div>

            ${minorNote}

            ${evidenceList ? `<h3 style="margin: 24px 0 8px; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Evidence signals</h3>${evidenceList}` : ""}

            <div style="margin: 28px 0 4px; text-align: center;">
              <a href="${scanUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 13px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; margin-right: 8px;">View Full Scan Report →</a>
              <a href="${APP_URL}/watchlist" style="display: inline-block; color: #6366f1; text-decoration: none; padding: 13px 18px; font-weight: 600; font-size: 14px;">View Watchlist →</a>
            </div>
          </div>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 16px 20px; margin-top: 16px; font-size: 13px; color: #64748b; line-height: 1.55;">
            <strong style="color: #475569;">Why this matters:</strong> Detecting a new LLM provider often signals a new product feature, a model swap, or an infrastructure change — usually within 2–4 weeks of the deployment going live.
          </div>

          <div style="margin-top: 24px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 6px;">You're receiving this because you added ${domain} to your AIHackr watchlist with alerts on.</p>
            <p style="margin: 0;">
              <a href="${APP_URL}/settings/alerts" style="color: #6366f1;">Manage alert settings</a>
              &nbsp;·&nbsp;
              <a href="${APP_URL}/settings/alerts" style="color: #6366f1;">Unsubscribe from alerts</a>
            </p>
            <p style="margin: 8px 0 0; color: #cbd5e1;">AIHackr · aihackr.com</p>
          </div>
        </div>
      </body></html>
    `;

    const { error } = await resend.emails.send({
      from: FROM_ALERTS,
      to,
      subject,
      html,
    });
    if (error) {
      console.error("[Email] Stack-change alert failed:", error);
      return false;
    }
    console.log(`[Email] Stack-change alert sent to ${to} for ${domain}`);
    return true;
  } catch (error) {
    console.error("[Email] Stack-change alert error:", error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Site unreachable notification
// ─────────────────────────────────────────────────────────
export async function sendSiteUnreachableEmail(
  to: string,
  domain: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_ALERTS,
      to,
      subject: `[AIHackr] ${domain} is unreachable`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background:#f8fafc; padding:40px 20px;">
          <div style="max-width:480px; margin:0 auto; background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:32px;">
            <h2 style="margin:0 0 12px; color:#0f172a; font-size:20px;">${domain} is unreachable</h2>
            <p style="color:#475569; font-size:14px; line-height:1.6;">
              We've been unable to reach <strong>${domain}</strong> for 3 consecutive scans. Monitoring will continue, but we won't send change alerts while the site is unreachable.
            </p>
            <p style="color:#475569; font-size:14px; line-height:1.6;">
              If this is unexpected, the site may be temporarily down or blocking automated traffic.
            </p>
            <a href="${APP_URL}/watchlist" style="display:inline-block; margin-top:16px; background:#6366f1; color:white; text-decoration:none; padding:11px 20px; border-radius:8px; font-weight:600; font-size:14px;">Open Watchlist</a>
          </div>
        </body></html>
      `,
    });
    if (error) {
      console.error("[Email] Unreachable notice failed:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Email] Unreachable notice error:", error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Weekly digest (per playbook spec §4)
// ─────────────────────────────────────────────────────────
export interface DigestChangeRow {
  domain: string;
  changeType: string; // provider_added | provider_removed | confidence_upgraded | confidence_downgraded | model_hint_changed
  severity: "major" | "minor";
  provider: string;
  newConfidence: string | null;
  priorConfidence: string | null;
  detectedAt: Date | string;
  scanUrl: string;
  note?: string;
}

export interface DigestWatchlistRow {
  domain: string;
  providers: string[]; // display names
  highestConfidence: "high" | "medium" | "low" | null;
  lastChangedAt: Date | string | null;
  changedThisWeek: boolean;
}

export interface DigestTrendingBullet {
  emoji: string;
  headline: string; // e.g., "Anthropic up +18%"
  body: string;
}

export interface WeeklyDigestOptions {
  to: string;
  weekStart: Date;
  weekEnd: Date;
  changes: DigestChangeRow[];
  watchlist: DigestWatchlistRow[];
  trending: DigestTrendingBullet[]; // empty for free plan
  isPro: boolean;
  intro?: string;
}

/**
 * Subject-line formula:
 *   "Your AI Stack Digest: {N} change{s} across {M} watched {domain/domains} this week"
 *   When 0 changes: "Your AI Stack Digest: No changes this week — here's what's trending"
 *   When highlighting one big change: "Your AI Stack Digest: {domain} added {Provider} — and {N-1} more changes"
 */
function buildDigestSubject(opts: WeeklyDigestOptions): string {
  const n = opts.changes.length;
  const m = opts.watchlist.length;
  if (n === 0) {
    return `Your AI Stack Digest: No changes this week — here's what's trending`;
  }
  if (n === 1) {
    const c = opts.changes[0];
    if (c.changeType === "provider_added") {
      return `Your AI Stack Digest: ${c.domain} added ${c.provider} this week`;
    }
    return `Your AI Stack Digest: 1 change across ${m} watched ${m === 1 ? "domain" : "domains"} this week`;
  }
  // Cherry-pick the biggest provider_added change for the headline variant occasionally
  const headlineChange = opts.changes.find((c) => c.changeType === "provider_added");
  if (headlineChange && n <= 4) {
    return `Your AI Stack Digest: ${headlineChange.domain} added ${headlineChange.provider} — and ${n - 1} more changes`;
  }
  return `Your AI Stack Digest: ${n} changes across ${m} watched ${m === 1 ? "domain" : "domains"} this week`;
}

function formatRange(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)}–${fmt(end)}, ${end.getFullYear()}`;
}

function formatChangeBullet(c: DigestChangeRow): string {
  const detected = new Date(c.detectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  let icon = "";
  let label = "";
  let color = "#475569";
  switch (c.changeType) {
    case "provider_added":
      icon = "✅ ADDED";
      label = `${c.provider} — ${confidenceLabel(c.newConfidence)} confidence`;
      color = "#166534";
      break;
    case "provider_removed":
      icon = "❌ REMOVED";
      label = `${c.provider} — was ${confidenceLabel(c.priorConfidence)} confidence`;
      color = "#dc2626";
      break;
    case "confidence_upgraded":
      icon = "🔄 UPGRADED";
      label = `${c.provider}: ${confidenceLabel(c.priorConfidence)} → ${confidenceLabel(c.newConfidence)}`;
      color = "#0369a1";
      break;
    case "confidence_downgraded":
      icon = "⚠️ CONFIDENCE CHANGE";
      label = `${c.provider} ${confidenceLabel(c.priorConfidence)} → ${confidenceLabel(c.newConfidence)}`;
      color = "#b45309";
      break;
    case "model_hint_changed":
      icon = "🔄 MODEL CHANGE";
      label = `${c.provider} model updated`;
      color = "#0369a1";
      break;
    default:
      icon = "•";
      label = c.provider;
  }
  const noteHtml = c.note
    ? `<div style="font-size:12px; color:#94a3b8; font-style:italic; margin:2px 0 4px;">${c.note}</div>`
    : "";
  return `
    <li style="margin-bottom:18px; padding-left:0;">
      <div style="font-weight:600; color:#0f172a; font-size:15px;">${c.domain}</div>
      <div style="color:${color}; font-size:13px; margin:3px 0;"><strong>${icon}</strong> ${label}</div>
      ${noteHtml}
      <div style="font-size:12px; color:#94a3b8;">Detected: ${detected} · <a href="${c.scanUrl}" style="color:#6366f1; text-decoration:none;">View full report →</a></div>
    </li>
  `;
}

export async function sendWeeklyDigestEmail(opts: WeeklyDigestOptions): Promise<boolean> {
  try {
    const subject = buildDigestSubject(opts);
    const range = formatRange(opts.weekStart, opts.weekEnd);
    const n = opts.changes.length;
    const m = opts.watchlist.length;

    const intro = opts.intro || (
      n > 0
        ? `Your watchlist had ${n} change${n === 1 ? "" : "s"} this week.`
        : `No changes detected on your watchlist this week. Here's what's trending across the SaaS tools we monitor.`
    );

    const changesSection = n > 0
      ? `
        <h3 style="margin:28px 0 14px; font-size:13px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">CHANGES THIS WEEK (${n} of ${m} ${m === 1 ? "domain" : "domains"})</h3>
        <ol style="margin:0; padding-left:20px;">${opts.changes.map(formatChangeBullet).join("")}</ol>
      `
      : "";

    const watchlistRows = opts.watchlist.map((w) => `
      <tr>
        <td style="padding:6px 8px; color:#0f172a; font-size:13px; border-bottom:1px solid #f1f5f9;">${w.domain}${w.changedThisWeek ? ` <span style="color:#16a34a; font-size:11px; font-weight:600;">← NEW</span>` : ""}</td>
        <td style="padding:6px 8px; color:#475569; font-size:13px; border-bottom:1px solid #f1f5f9;">${w.providers.length ? w.providers.join(", ") : "<span style='color:#94a3b8'>None detected</span>"}</td>
        <td style="padding:6px 8px; color:#64748b; font-size:13px; border-bottom:1px solid #f1f5f9;">${w.highestConfidence ? confidenceLabel(w.highestConfidence) : "—"}</td>
        <td style="padding:6px 8px; color:#94a3b8; font-size:13px; border-bottom:1px solid #f1f5f9;">${w.lastChangedAt ? new Date(w.lastChangedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</td>
      </tr>
    `).join("");

    const watchlistSection = m > 0 ? `
      <h3 style="margin:32px 0 12px; font-size:13px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">YOUR WATCHLIST AT A GLANCE (${m} ${m === 1 ? "domain" : "domains"})</h3>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left; padding:6px 8px; color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; border-bottom:1px solid #e2e8f0;">Domain</th>
            <th style="text-align:left; padding:6px 8px; color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; border-bottom:1px solid #e2e8f0;">Providers</th>
            <th style="text-align:left; padding:6px 8px; color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; border-bottom:1px solid #e2e8f0;">Confidence</th>
            <th style="text-align:left; padding:6px 8px; color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; border-bottom:1px solid #e2e8f0;">Last Changed</th>
          </tr>
        </thead>
        <tbody>${watchlistRows}</tbody>
      </table>
      <p style="margin:14px 0 0;"><a href="${APP_URL}/watchlist" style="color:#6366f1; text-decoration:none; font-weight:600; font-size:13px;">View Full Watchlist →</a></p>
    ` : "";

    const trendingSection = (opts.isPro && opts.trending.length > 0) ? `
      <h3 style="margin:36px 0 12px; font-size:13px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">TRENDING IN AI STACKS THIS WEEK</h3>
      <div style="font-size:13px; color:#64748b; margin-bottom:14px;">Across all domains monitored by AIHackr this week:</div>
      ${opts.trending.map((t) => `
        <div style="margin-bottom:18px;">
          <div style="font-weight:600; color:#0f172a; font-size:14px;">${t.emoji} ${t.headline}</div>
          <div style="font-size:13px; color:#475569; margin-top:4px; line-height:1.55;">${t.body}</div>
        </div>
      `).join("")}
      <div style="font-size:11px; color:#94a3b8; margin-top:8px; line-height:1.5;">These trends are aggregated anonymously across AIHackr's full domain database. Individual company data is never shared.</div>
    ` : (opts.isPro ? `
      <div style="margin-top:32px; padding:18px; background:#f1f5f9; border-radius:12px; font-size:13px; color:#64748b;">
        Trending insights will appear once we have enough scans this week to surface a statistically meaningful signal (minimum 50 domains per signal).
      </div>
    ` : "");

    const ctaSection = `
      <div style="margin-top:32px; text-align:center;">
        <a href="${APP_URL}/watchlist" style="display:inline-block; background:linear-gradient(135deg, #6366f1, #8b5cf6); color:white; text-decoration:none; padding:12px 22px; border-radius:10px; font-weight:600; font-size:14px; margin-right:8px;">Add More Domains to Watchlist →</a>
        ${opts.isPro ? "" : `<a href="${APP_URL}/settings/alerts" style="display:inline-block; color:#6366f1; text-decoration:none; padding:12px 18px; font-weight:600; font-size:14px;">Upgrade to Pro for Daily Scans →</a>`}
      </div>
    `;

    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color:#f8fafc; color:#1e293b; padding:40px 20px; margin:0; line-height:1.5;">
        <div style="max-width:600px; margin:0 auto;">
          <div style="text-align:center; margin-bottom:24px;">
            <h1 style="margin:0 0 4px; font-size:22px; font-weight:700; color:#0f172a;">AIHackr Weekly Digest</h1>
            <p style="margin:0; font-size:13px; color:#94a3b8;">Week of ${range}</p>
          </div>

          <div style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:32px;">
            <p style="margin:0 0 16px; color:#475569; font-size:15px; line-height:1.6;">${intro}</p>
            ${changesSection}
            ${watchlistSection}
            ${trendingSection}
            ${ctaSection}
          </div>

          <div style="margin-top:24px; text-align:center; font-size:12px; color:#94a3b8;">
            <p style="margin:0 0 6px;">Sent because you have an AIHackr watchlist. This digest sends every Monday at 8 AM in your account timezone.</p>
            <p style="margin:0;">
              <a href="${APP_URL}/settings/alerts" style="color:#6366f1;">Manage digest settings</a>
              &nbsp;·&nbsp;
              <a href="${APP_URL}/settings/alerts" style="color:#6366f1;">Unsubscribe</a>
            </p>
            <p style="margin:8px 0 0; color:#cbd5e1;">AIHackr · aihackr.com</p>
          </div>
        </div>
      </body></html>
    `;

    const { error } = await resend.emails.send({
      from: FROM_DIGEST,
      to: opts.to,
      subject,
      html,
    });
    if (error) {
      console.error("[Email] Weekly digest send failed:", error);
      return false;
    }
    console.log(`[Email] Weekly digest sent to ${opts.to}`);
    return true;
  } catch (error) {
    console.error("[Email] Weekly digest error:", error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Legacy change notification (kept for any existing callers)
// ─────────────────────────────────────────────────────────
export async function sendChangeNotificationEmail(
  email: string,
  domain: string,
  changes: {
    added: string[];
    removed: string[];
    modified: Array<{ tech: string; from: string; to: string }>;
  },
  scanUrl: string
): Promise<boolean> {
  try {
    const changesList: string[] = [];
    if (changes.added.length > 0) changesList.push(`<li><strong>Added:</strong> ${changes.added.join(", ")}</li>`);
    if (changes.removed.length > 0) changesList.push(`<li><strong>Removed:</strong> ${changes.removed.join(", ")}</li>`);
    if (changes.modified.length > 0) changesList.push(`<li><strong>Changed:</strong> ${changes.modified.map((m) => `${m.tech}: ${m.from} → ${m.to}`).join(", ")}</li>`);
    const { error } = await resend.emails.send({
      from: FROM_ALERTS,
      to: email,
      subject: `[AIHackr] Stack changes on ${domain}`,
      html: `<div style="font-family:sans-serif;"><h3>Stack changes detected on ${domain}</h3><ul>${changesList.join("")}</ul><a href="${scanUrl}">View full scan</a></div>`,
    });
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Admin notifications (unchanged)
// ─────────────────────────────────────────────────────────
export async function sendAdminNewScanNotification(
  domain: string,
  url: string,
  userEmail?: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New scan: ${domain}`,
      html: `<div style="font-family:sans-serif;"><h3>New Scan</h3><p>${domain} (${url}) by ${userEmail || "Anonymous"} at ${new Date().toISOString()}</p></div>`,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendAdminMagicLinkNotification(userEmail: string): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `Magic link requested: ${userEmail}`,
      html: `<div style="font-family:sans-serif;"><p>Magic link requested by ${userEmail} at ${new Date().toISOString()}</p></div>`,
    });
    return !error;
  } catch {
    return false;
  }
}
