// ════════════════════════════════════════════════════════════════════════════
// Intelligence-grade interpretation of a Scan row.
//
// One source of truth for the verdict, executive summary, intelligence
// scores, findings, and recommended actions surfaced on:
//   • /scan/:domain         (live scan card — client/src/pages/card.tsx)
//   • /stack/:slug          (canonical company profile — stack-detail.tsx)
//
// The page UIs render different chrome (CTAs, profile header, embed badge,
// public-context block) but the intelligence reads are computed identically
// here so that two views of the same scan never tell the user different
// stories.
// ════════════════════════════════════════════════════════════════════════════

import type { Scan } from "@shared/schema";

// Hosting names whose presence means we're looking at the edge layer rather
// than the origin server. Used to soften "no public AI calls" verdicts —
// behind a CDN/WAF the origin's network footprint may simply not be
// observable from a passive HTML fetch.
export function isCdnProvider(hosting: string | null | undefined): boolean {
  if (!hosting) return false;
  const cdnProviders = ["Cloudflare", "Fastly", "Akamai", "CloudFront", "KeyCDN", "StackPath", "Bunny CDN"];
  return cdnProviders.some((cdn) => hosting.toLowerCase().includes(cdn.toLowerCase()));
}

// ── Verdict types ─────────────────────────────────────────────────────────
// Six discrete buckets (per the product brief). We keep them as a tagged
// union rather than a free-form score so the report copy, executive
// summary, and recommended actions stay tightly aligned per state.
export type VerdictKind =
  | "detected" // provider observed in browser-visible signals
  | "behind_login_likely" // AI-positioned + an auth provider detected → likely gated behind sign-in
  | "hidden_likely" // AI-positioned, no auth signal, no provider → likely backend-proxied
  | "insufficient_depth" // AI-positioned but probe scan hasn't run yet
  | "scan_blocked" // passive scan returned essentially nothing — bot-blocked or 4xx/5xx
  | "no_ai"; // not AI-positioned and nothing AI was observed

export type VerdictBadge = {
  label: string;
  tone: "primary" | "secondary" | "warning" | "neutral";
};

export type Verdict = {
  kind: VerdictKind;
  title: string;
  description: string;
  bestNextAction: string;
  badges: VerdictBadge[];
};

export const BADGE_TONE_CLASSES: Record<VerdictBadge["tone"], string> = {
  primary: "bg-primary/15 text-primary border-primary/30",
  secondary: "bg-secondary/15 text-secondary border-secondary/30",
  warning: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

// Cheap heuristic for whether the *brand* markets itself as AI-powered.
// The /scan view only has the hostname; the /stack view also has the
// company description and category, which we accept via `extraText` so
// pages like /stack/perplexity (whose hostname doesn't contain "ai", "gpt",
// etc.) still flip on AI-positioned heuristics from the description.
export function appearsAiPositioned(hostname: string, scan: Scan, extraText = ""): boolean {
  const tokens = [
    "ai", "gpt", "chat", "bot", "copilot", "agent", "llm",
    "intelli", "neural", "generative", "ml", "machine learning",
    "answer engine", "search engine",
  ];
  const lowered = `${hostname} ${extraText}`.toLowerCase();
  if (tokens.some((t) => lowered.includes(t))) return true;
  if (scan.evidence?.probeDiagnostics?.chatUiFound) return true;
  return false;
}

// Six-bucket classifier. Order matters: provider-detected short-circuits
// everything; "scan_blocked" only fires when literally no stack signal
// landed; behind_login_likely outranks hidden_likely so a site with a
// visible auth provider gets the more specific label.
export function computeVerdict(
  scan: Scan,
  hostname: string,
  isCdn: boolean,
  extraText = "",
): Verdict {
  const badges: VerdictBadge[] = [];
  if (isCdn) badges.push({ label: `Origin protected by ${scan.hosting}`, tone: "neutral" });

  // ── 1. Provider detected ───────────────────────────────────────────────
  if (scan.aiProvider) {
    badges.push({ label: `${scan.aiProvider} detected`, tone: "primary" });
    if (scan.aiConfidence) badges.push({ label: `${scan.aiConfidence} confidence`, tone: "secondary" });
    if (scan.aiGateway) badges.push({ label: `Gateway: ${scan.aiGateway}`, tone: "secondary" });
    return {
      kind: "detected",
      title: `AI provider detected: ${scan.aiProvider}`,
      description: `We observed public signals suggesting this SaaS uses ${scan.aiProvider}, with ${(scan.aiConfidence || "Medium").toLowerCase()} confidence. Review the evidence trail below and compare this stack against competitors.`,
      bestNextAction: "Compare this SaaS against competitors or estimate model cost impact in LLM Margin.",
      badges,
    };
  }

  // ── 2. Scan blocked ────────────────────────────────────────────────────
  const evidencePatterns = scan.evidence?.patterns?.length ?? 0;
  const noStackAtAll = !scan.framework && !scan.hosting && !scan.analytics && !scan.auth && evidencePatterns < 3;
  if (noStackAtAll) {
    badges.push({ label: "Scan blocked or limited", tone: "warning" });
    badges.push({ label: "Retry with browser rendering", tone: "secondary" });
    return {
      kind: "scan_blocked",
      title: "Scan was blocked or returned almost no signal",
      description:
        "We could not extract meaningful technology signals from this site during the passive scan. This usually means the site is behind a bot-blocker, returned a non-HTML response, or required JavaScript rendering. The result is not a reliable read on AI usage either way.",
      bestNextAction: "Retry with browser rendering or run an authenticated probe.",
      badges,
    };
  }

  const aiPositioned = appearsAiPositioned(hostname, scan, extraText);

  // ── 3. AI-positioned site, but the deep probe never ran ────────────────
  const probeFinished = scan.scanPhases?.probe === "complete" || scan.scanMode === "probe";
  if (aiPositioned && !probeFinished) {
    badges.push({ label: "Browser-visible AI not found", tone: "warning" });
    badges.push({ label: "AI possible — probe not run", tone: "secondary" });
    return {
      kind: "insufficient_depth",
      title: "AI possible, but not enough interaction observed",
      description:
        "This product appears to market AI features, but the passive scan only looked at the public landing page. We did not interact with any chat, generate, or analyze flows yet. Run the AI Probe to test deeper interactions and see whether AI calls fire on user actions.",
      bestNextAction: "Run an AI Probe on the product's core AI interaction.",
      badges,
    };
  }

  // ── 4. AI-positioned + auth provider detected → behind-login likely ────
  if (aiPositioned && scan.auth) {
    badges.push({ label: "Browser-visible AI not found", tone: "warning" });
    badges.push({ label: `${scan.auth} auth detected`, tone: "secondary" });
    badges.push({ label: "AI behind login likely", tone: "primary" });
    return {
      kind: "behind_login_likely",
      title: "AI likely lives behind login",
      description: `We did not observe browser-visible AI calls on the public surface, but ${scan.auth} authentication is in use and the product is positioned around AI. The most likely explanation is that AI features are gated behind sign-in. We cannot evaluate them without access to an authenticated session.`,
      bestNextAction: "Run an authenticated probe with a user-provided session.",
      badges,
    };
  }

  // ── 5. AI-positioned, no auth signal → backend-proxied likely ─────────
  if (aiPositioned) {
    badges.push({ label: "Browser-visible AI not found", tone: "warning" });
    badges.push({ label: "Backend-proxied AI likely", tone: "primary" });
    badges.push({ label: "Probe recommended", tone: "warning" });
    return {
      kind: "hidden_likely",
      title: "AI likely, provider hidden from public scan",
      description:
        "This product is AI-native, but AIHackr did not observe browser-visible provider calls during this scan. The most likely explanation is that prompts and model routing are handled server-side, through internal infrastructure, through a backend proxy, or behind authenticated product flows.",
      bestNextAction: "Run an interactive or authenticated probe, or add this company to Watchlist for future stack changes.",
      badges,
    };
  }

  // ── 6. Plain-old "no AI here" ─────────────────────────────────────────
  badges.push({ label: "No AI evidence found", tone: "neutral" });
  return {
    kind: "no_ai",
    title: "No AI stack detected",
    description:
      "We did not find AI provider, model, gateway, streaming, or chat UI signals during this scan, and the product is not visibly positioned around AI. This site likely does not use AI in any user-facing way.",
    bestNextAction: "Add to Watchlist if you want to be alerted when this changes.",
    badges,
  };
}

export function computeExecutiveSummary(scan: Scan, hostname: string, verdict: Verdict): string {
  const commodity = [scan.hosting, scan.analytics].filter(Boolean).join(" and ");
  const commodityClause = commodity ? `${commodity} ${commodity.includes(" and ") ? "were" : "was"} detected, but` : "";

  switch (verdict.kind) {
    case "detected":
      return `AIHackr observed public signals on ${hostname} suggesting this SaaS uses ${scan.aiProvider} with ${(scan.aiConfidence || "Medium").toLowerCase()} confidence${scan.aiGateway ? `, routed through ${scan.aiGateway}` : ""}. Review the evidence trail to see exactly which scripts, headers, and network calls were observed, then compare this stack against competitors or estimate cost-per-user impact in LLM Margin.`;
    case "scan_blocked":
      return `AIHackr could not extract a reliable technology fingerprint from ${hostname}. The site likely returned a bot-block page, required JavaScript rendering, or refused our request. We cannot judge AI usage from this scan — try the rendered or authenticated probe to get a real read.`;
    case "insufficient_depth":
      return `${hostname} is positioned around AI features, but this scan only looked at the public landing page. We have not interacted with any chat, generate, or analyze flow yet. Run the AI Probe so we can fingerprint the actual AI requests that fire on user actions.`;
    case "behind_login_likely":
      return `AIHackr did not detect browser-visible AI calls on ${hostname}'s public surface, but ${scan.auth} authentication is wired up and the product is AI-positioned. The most likely explanation is that AI features only render after sign-in. An authenticated probe is needed to fingerprint them.`;
    case "hidden_likely":
      return `AIHackr did not detect browser-visible AI provider calls on ${hostname}, even though the product appears to market AI features. The most likely explanation is that AI calls are proxied through the app's own backend, hiding the underlying provider. ${commodityClause} no OpenAI, Anthropic, Google, Mistral, gateway, streaming, or chat UI signals were observed. Run an AI Probe on the core AI flow to test deeper interactions.`;
    case "no_ai":
    default:
      return `AIHackr did not detect AI calls on ${hostname}, and the product is not visibly positioned around AI. ${commodityClause} no AI provider, gateway, streaming, or chat UI signals were observed. This site is unlikely to use AI in a user-facing way today — add it to your Watchlist if you want to be alerted the moment that changes.`;
  }
}

// ── Intelligence scores ───────────────────────────────────────────────────
// Five separate scores instead of one combined number — each answers a
// different decision question. Derived from fields already on the Scan row.
export type IntelligenceScore = { label: string; value: number; caption: string };

export function computeIntelligenceScores(scan: Scan, verdict: Verdict): IntelligenceScore[] {
  const phases = scan.scanPhases as { passive?: string; render?: string; probe?: string } | null;

  let aiUsage = 0;
  if (scan.aiProvider) aiUsage = 95;
  else if (scan.aiGateway || scan.aiTransport) aiUsage = 70;
  else if (scan.evidence?.probeDiagnostics?.chatUiFound) aiUsage = 60;
  else if (verdict.kind === "behind_login_likely" || verdict.kind === "hidden_likely") aiUsage = 55;
  else if (verdict.kind === "insufficient_depth") aiUsage = 35;
  else aiUsage = 8;

  const confMap: Record<string, number> = { high: 95, medium: 70, low: 45 };
  const provider = scan.aiProvider
    ? confMap[(scan.aiConfidence || "medium").toLowerCase()] ?? 60
    : 0;

  let gateway = 0;
  if (scan.aiGateway) gateway = 90;
  else if (phases?.probe === "complete") gateway = 45;
  else gateway = 20;

  const diag = scan.evidence?.probeDiagnostics;
  let visibility = 25;
  if (phases?.render === "complete") visibility += 25;
  if (diag?.chatUiFound) visibility += 15;
  if ((diag?.elementsClicked ?? 0) > 0) visibility += 15;
  if ((diag?.externalDomains ?? 0) > 5) visibility += 10;
  if ((scan.evidence?.networkPaths?.length ?? 0) > 5) visibility += 10;
  visibility = Math.min(visibility, 100);
  if (verdict.kind === "scan_blocked") visibility = 10;

  let depth = 25;
  if (phases?.render === "complete") depth = 60;
  if (phases?.probe === "complete" || scan.scanMode === "probe") depth = 100;

  return [
    {
      label: "AI Usage",
      value: aiUsage,
      caption: aiUsage >= 80 ? "Strong evidence AI is in use" : aiUsage >= 50 ? "AI likely, evidence incomplete" : "Little or no AI evidence",
    },
    {
      label: "Provider",
      value: provider,
      caption: provider >= 80 ? `${scan.aiProvider} identified` : provider > 0 ? "Tentative provider read" : "Provider not identified",
    },
    {
      label: "Gateway",
      value: gateway,
      caption: gateway >= 80 ? `Routed via ${scan.aiGateway}` : gateway >= 40 ? "No gateway observed in probe" : "Not yet evaluated",
    },
    {
      label: "Visibility",
      value: visibility,
      caption: visibility >= 70 ? "Most of the page was observable" : visibility >= 40 ? "Partial coverage of the product" : "Limited or blocked observation",
    },
    {
      label: "Scan Depth",
      value: depth,
      caption: depth >= 100 ? "Passive + Render + Probe" : depth >= 60 ? "Passive + Render" : "Passive only",
    },
  ];
}

// ── Findings: "What we found" / "What we did NOT find" ─────────────────
export type FindingsLists = { found: string[]; missing: string[] };

export function computeFindings(scan: Scan, isCdn: boolean): FindingsLists {
  const found: string[] = [];
  const missing: string[] = [];

  if (scan.aiProvider) {
    found.push(`AI provider signals consistent with ${scan.aiProvider}`);
    if (scan.aiGateway) found.push(`AI gateway routing through ${scan.aiGateway}`);
    if (scan.aiTransport) found.push(`${scan.aiTransport} streaming transport observed`);
    if (scan.evidence?.probeDiagnostics?.chatUiFound) found.push("Chat UI detected on the page");
  } else {
    found.push("No direct browser-visible AI provider calls observed");
    if (!scan.aiTransport) found.push("No browser-side streaming transport observed");
    if (!scan.evidence?.probeDiagnostics?.chatUiFound) found.push("No chat UI signature found during scan");
  }
  if (scan.framework) found.push(`${scan.framework} frontend framework detected`);
  if (scan.hosting) found.push(`${scan.hosting} ${isCdn ? "edge protection" : "hosting"} detected`);
  if (scan.analytics) found.push(`${scan.analytics} analytics detected`);
  if (scan.payments) found.push(`${scan.payments} payments detected`);
  if (scan.auth) found.push(`${scan.auth} auth detected`);
  if (scan.support) found.push(`${scan.support} support tooling detected`);

  if (!scan.aiProvider) {
    missing.push("No OpenAI browser calls");
    missing.push("No Anthropic browser calls");
    missing.push("No Google Gemini browser calls");
    missing.push("No Mistral / Cohere browser calls");
    missing.push("No Azure OpenAI / Bedrock browser calls");
    missing.push("No Vercel AI SDK / LangChain / LlamaIndex frontend signature");
    if (!scan.aiGateway) missing.push("No AI gateway endpoint observed");
    if (!scan.aiTransport) missing.push("No SSE / WebSocket streaming signal observed");
    missing.push("No public model identifier exposed");
  }

  return { found, missing };
}

// ── Recommendations ──────────────────────────────────────────────────────
export type Recommendation = {
  title: string;
  href?: string;
  external?: boolean;
  emphasis?: "primary" | "secondary";
};

export function computeRecommendations(verdict: Verdict, scan: Scan, hostname: string): Recommendation[] {
  const llmMarginUrl = buildLlmMarginUrl(scan, hostname);
  const compareUrl = `/compare?domains=${encodeURIComponent(hostname)}`;
  switch (verdict.kind) {
    case "detected":
      return [
        { title: "Compare this stack against competitors", href: compareUrl, emphasis: "primary" },
        { title: "Estimate cost-per-user in LLM Margin", href: llmMarginUrl, external: true, emphasis: "secondary" },
        { title: "Add to Watchlist for model/provider migration alerts" },
        { title: "Browse the leaderboard to see who else uses this provider", href: "/leaderboard" },
      ];
    case "scan_blocked":
      return [
        { title: "Retry with browser rendering", emphasis: "primary" },
        { title: "Run an authenticated probe to bypass bot blocks", emphasis: "secondary" },
        { title: "Add to Watchlist — we'll keep retrying on the rescan cadence" },
      ];
    case "insufficient_depth":
      return [
        { title: "Run AI Probe on the product's core AI interaction", emphasis: "primary" },
        { title: "Compare against 3 similar AI products", href: compareUrl, emphasis: "secondary" },
        { title: "Add to Watchlist to detect future stack changes" },
      ];
    case "behind_login_likely":
      return [
        { title: "Run an authenticated probe with a user-provided session", emphasis: "primary" },
        { title: "Compare against competitors with public AI surfaces", href: compareUrl, emphasis: "secondary" },
        { title: "Model possible provider-cost scenarios in LLM Margin", href: llmMarginUrl, external: true },
        { title: "Add to Watchlist for stack changes" },
      ];
    case "hidden_likely":
      return [
        { title: "Run AI Probe to fingerprint the backend request shape", emphasis: "primary" },
        { title: "Compare against 3 similar AI products", href: compareUrl, emphasis: "secondary" },
        { title: "Model possible provider-cost scenarios in LLM Margin", href: llmMarginUrl, external: true },
        { title: "Add to Watchlist to detect future stack changes" },
      ];
    case "no_ai":
    default:
      return [
        { title: "Add to Watchlist — get alerted if AI features ship", emphasis: "primary" },
        { title: "Compare against AI-positioned competitors", href: compareUrl, emphasis: "secondary" },
        { title: "Browse the leaderboard for AI-active SaaS in this category", href: "/leaderboard" },
      ];
  }
}

export function buildLlmMarginUrl(
  scan: Scan,
  hostname: string,
  utmMedium = "scan_report",
): string {
  const base = "https://llmmargin.com/";
  const params = new URLSearchParams();
  params.set("utm_source", "aihackr");
  params.set("utm_medium", utmMedium);
  if (scan.aiProvider) {
    params.set("utm_campaign", "stack_to_margin");
    params.set("provider", scan.aiProvider);
    if (scan.inferredModel) params.set("model", scan.inferredModel);
  } else {
    params.set("utm_campaign", "unknown_stack_to_margin");
  }
  params.set("domain", hostname);
  return `${base}?${params.toString()}`;
}
