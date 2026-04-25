/**
 * Slack notifications for AIHackr stack-change alerts. Uses
 * user-configured incoming webhooks (no OAuth required for MVP).
 *
 * Block-Kit payloads follow the playbook spec.
 */

import type { Subscription, ChangeEvent } from "@shared/schema";

const APP_URL = process.env.APP_URL || "https://aihackr.com";

interface ProviderState {
  provider: string;
  displayName: string;
  confidence: "high" | "medium" | "low";
  modelHints?: string[];
}

interface SendChangeAlertOptions {
  webhookUrl: string;
  domain: string;
  change: ChangeEvent;
  beforeProviders: ProviderState[];
  afterProviders: ProviderState[];
  scanUrl: string;
}

function confidenceEmoji(level: string | null | undefined): string {
  if (level === "high") return "🟢";
  if (level === "medium") return "🟡";
  return "⚪";
}

function confidenceLabel(level: string | null | undefined): string {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  if (level === "low") return "Low";
  return "—";
}

function formatChangeVerb(changeType: string): string {
  switch (changeType) {
    case "provider_added":
      return "added";
    case "provider_removed":
      return "dropped";
    case "confidence_upgraded":
      return "upgraded confidence on";
    case "confidence_downgraded":
      return "downgraded confidence on";
    case "model_hint_changed":
      return "changed model on";
    default:
      return "changed";
  }
}

export async function sendStackChangeSlack(opts: SendChangeAlertOptions): Promise<boolean> {
  const { webhookUrl, domain, change, beforeProviders, afterProviders, scanUrl } = opts;

  const isMinor = change.severity === "minor";
  const verb = formatChangeVerb(change.changeType);
  const providerLabel = change.providerDisplayName || change.provider || "AI provider";
  const detectedDate = change.detectedAt
    ? new Date(change.detectedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  // Minor (confidence shift) → subdued format per playbook
  if (isMinor) {
    const before = confidenceEmoji(change.priorConfidence) + " " + confidenceLabel(change.priorConfidence);
    const after = confidenceEmoji(change.newConfidence) + " " + confidenceLabel(change.newConfidence);
    const payload = {
      text: `Confidence update — ${domain}: ${providerLabel}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:warning: *Confidence update — ${domain}*\n\n${providerLabel} confidence shifted: ${before} → ${after}\nThis may be a temporary detection fluctuation.`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View Scan" },
              url: scanUrl,
            },
          ],
        },
      ],
    };
    return postWebhook(webhookUrl, payload);
  }

  // Major change — full Block Kit payload per playbook
  const beforeAfterLines = afterProviders.map((p) => {
    const wasInBefore = beforeProviders.some((b) => b.provider === p.provider);
    const tag = wasInBefore ? "STABLE" : "ADDED";
    const emoji = wasInBefore ? "✓" : "✅";
    return `${emoji} \`${tag}\`   ${p.displayName} — ${confidenceEmoji(p.confidence)} ${confidenceLabel(p.confidence)} confidence`;
  });
  // Show removals
  beforeProviders.forEach((b) => {
    const stillThere = afterProviders.some((a) => a.provider === b.provider);
    if (!stillThere) {
      beforeAfterLines.unshift(`❌ \`REMOVED\` ${b.displayName} — was ${confidenceLabel(b.confidence)} confidence`);
    }
  });

  const payload = {
    text: `AI Stack Change: ${domain} ${verb} ${providerLabel}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🔍 AI Stack Change Detected",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${domain}* just ${verb} *${providerLabel}*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Before* → *After*\n${beforeAfterLines.join("\n")}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Provider:* ${providerLabel}` },
          {
            type: "mrkdwn",
            text: `*Confidence:* ${confidenceEmoji(change.newConfidence)} ${confidenceLabel(change.newConfidence)}`,
          },
          { type: "mrkdwn", text: `*Detected:* ${detectedDate}` },
          { type: "mrkdwn", text: `*Change type:* ${change.changeType.replace(/_/g, " ")}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Full Report" },
            url: scanUrl,
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Open Watchlist" },
            url: `${APP_URL}/watchlist`,
          },
        ],
      },
    ],
  };

  return postWebhook(webhookUrl, payload);
}

async function postWebhook(webhookUrl: string, payload: unknown): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[Slack] Webhook failed (${res.status}):`, text);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Slack] Webhook send error:", error);
    return false;
  }
}

/**
 * Test a webhook URL by sending a small confirmation message.
 */
export async function sendSlackTestMessage(webhookUrl: string): Promise<boolean> {
  return postWebhook(webhookUrl, {
    text: "AIHackr Slack alerts are connected ✅",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":white_check_mark: *AIHackr Slack alerts are connected.*\n\nYou'll start getting AI-stack change alerts here when your watched domains change provider.",
        },
      },
    ],
  });
}
