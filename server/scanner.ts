import { SIGNATURE_DB, AI_SIGNATURES, type TechSignature, type AISignature, type EvidenceRule } from "./signatures";

interface ScanSignals {
  url: string;
  finalUrl: string;
  html: string;
  headers: Record<string, string>;
  cookies: string[];
  scriptSrcs: string[];
  metaTags: Record<string, string>;
  domain: string;
}

interface EvidenceReceipt {
  type: string;
  pattern: string;
  match: string;
  weight: number;
}

interface DetectionResult {
  id: string;
  name: string;
  category: string;
  confidence: "High" | "Medium" | "Low";
  score: number;
  evidence: EvidenceReceipt[];
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  try {
    const parsed = new URL(url);
    return parsed.href;
  } catch {
    return url;
  }
}

function extractSignals(html: string, headers: Record<string, string>, url: string): ScanSignals {
  const scriptSrcRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  const scriptSrcs: string[] = [];
  let match;
  while ((match = scriptSrcRegex.exec(html)) !== null) {
    scriptSrcs.push(match[1]);
  }

  const metaTags: Record<string, string> = {};
  const metaRegex = /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']+)["']/gi;
  while ((match = metaRegex.exec(html)) !== null) {
    metaTags[match[1]] = match[2];
  }

  const cookies: string[] = [];
  const setCookie = headers["set-cookie"];
  if (setCookie) {
    cookies.push(...setCookie.split(",").map(c => c.trim()));
  }

  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {}

  return {
    url,
    finalUrl: url,
    html,
    headers,
    cookies,
    scriptSrcs,
    metaTags,
    domain,
  };
}

function matchRule(rule: EvidenceRule, signals: ScanSignals): EvidenceReceipt | null {
  const regex = new RegExp(rule.pattern, "i");
  
  switch (rule.type) {
    case "html": {
      const match = signals.html.match(regex);
      if (match) {
        return {
          type: "html",
          pattern: rule.pattern,
          match: match[0].substring(0, 100),
          weight: rule.weight,
        };
      }
      break;
    }
    case "script_src": {
      for (const src of signals.scriptSrcs) {
        if (regex.test(src)) {
          return {
            type: "script_src",
            pattern: rule.pattern,
            match: src,
            weight: rule.weight,
          };
        }
      }
      break;
    }
    case "header": {
      if (rule.key) {
        const headerValue = signals.headers[rule.key.toLowerCase()];
        if (headerValue && regex.test(headerValue)) {
          return {
            type: "header",
            pattern: `${rule.key}: ${rule.pattern}`,
            match: `${rule.key}: ${headerValue}`,
            weight: rule.weight,
          };
        }
        if (headerValue && rule.pattern === ".*") {
          return {
            type: "header",
            pattern: `${rule.key} exists`,
            match: `${rule.key}: ${headerValue}`,
            weight: rule.weight,
          };
        }
      }
      break;
    }
    case "cookie": {
      for (const cookie of signals.cookies) {
        if (regex.test(cookie)) {
          return {
            type: "cookie",
            pattern: rule.pattern,
            match: cookie.substring(0, 50),
            weight: rule.weight,
          };
        }
      }
      break;
    }
    case "meta": {
      for (const [name, content] of Object.entries(signals.metaTags)) {
        if (regex.test(name) || regex.test(content)) {
          return {
            type: "meta",
            pattern: rule.pattern,
            match: `${name}=${content}`,
            weight: rule.weight,
          };
        }
      }
      break;
    }
    case "dns": {
      if (regex.test(signals.domain)) {
        return {
          type: "dns",
          pattern: rule.pattern,
          match: signals.domain,
          weight: rule.weight,
        };
      }
      break;
    }
  }
  
  return null;
}

function detectTech(signature: TechSignature | AISignature, signals: ScanSignals): DetectionResult | null {
  const evidence: EvidenceReceipt[] = [];
  let totalScore = 0;

  for (const rule of signature.rules) {
    const receipt = matchRule(rule, signals);
    if (receipt) {
      evidence.push(receipt);
      totalScore += receipt.weight;
    }
  }

  const cappedScore = Math.min(totalScore, 1.0);

  if (cappedScore >= signature.thresholds.medium) {
    let confidence: "High" | "Medium" | "Low";
    if (cappedScore >= signature.thresholds.high) {
      confidence = "High";
    } else {
      confidence = "Medium";
    }

    return {
      id: signature.id,
      name: signature.name,
      category: "category" in signature ? signature.category : "ai",
      confidence,
      score: cappedScore,
      evidence,
    };
  }

  return null;
}

function detectAllTechnologies(signals: ScanSignals): DetectionResult[] {
  const results: DetectionResult[] = [];

  for (const sig of SIGNATURE_DB) {
    const result = detectTech(sig, signals);
    if (result) {
      results.push(result);
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

function detectAIProviders(signals: ScanSignals): DetectionResult[] {
  const results: DetectionResult[] = [];

  for (const sig of AI_SIGNATURES) {
    const result = detectTech(sig, signals);
    if (result) {
      results.push(result);
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export async function scanUrl(inputUrl: string) {
  const url = normalizeUrl(inputUrl);
  
  let html = "";
  let headers: Record<string, string> = {};
  
  console.log(`[Scanner] Starting passive scan for: ${url}`);
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });
    
    clearTimeout(timeoutId);
    
    console.log(`[Scanner] Received response: ${response.status} from ${response.url}`);
    
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    
    const contentType = headers["content-type"] || "";
    if (contentType.includes("text/html") || contentType.includes("application/xhtml") || !contentType) {
      html = await response.text();
      console.log(`[Scanner] Fetched HTML: ${html.length} bytes`);
      if (html.length > 5 * 1024 * 1024) {
        html = html.substring(0, 5 * 1024 * 1024);
      }
    }
  } catch (error) {
    console.error("[Scanner] Fetch error:", error);
  }
  
  const fetchTime = Date.now() - startTime;
  console.log(`[Scanner] Fetch completed in ${fetchTime}ms`);

  const signals = extractSignals(html, headers, url);
  const techDetections = detectAllTechnologies(signals);
  const aiDetections = detectAIProviders(signals);

  const findBestByCategory = (category: string): DetectionResult | undefined => {
    return techDetections.find(d => d.category === category);
  };

  const framework = findBestByCategory("framework");
  const hosting = findBestByCategory("hosting") || findBestByCategory("cdn");
  const payments = findBestByCategory("payments");
  const auth = findBestByCategory("auth");
  const analytics = findBestByCategory("analytics");
  const support = findBestByCategory("support");
  const aiProvider = aiDetections[0];

  const allEvidence: EvidenceReceipt[] = [];
  const allDetections = [...techDetections, ...aiDetections];
  [framework, hosting, payments, auth, analytics, support, aiProvider].forEach(d => {
    if (d) allEvidence.push(...d.evidence);
  });

  const evidenceDomains = new Set<string>();
  const evidencePatterns = new Set<string>();
  
  allEvidence.forEach(e => {
    if (e.type === "dns" || e.type === "script_src") {
      try {
        const urlMatch = e.match.match(/https?:\/\/([^\/]+)/);
        if (urlMatch) evidenceDomains.add(urlMatch[1]);
        else if (e.type === "dns") evidenceDomains.add(e.match);
      } catch {}
    }
    evidencePatterns.add(`${e.type}: ${e.pattern}`);
  });

  // Generate grouped detections by technology
  const groupedDetections: Record<string, { confidence: string; score?: number; patterns: string[] }> = {};
  allDetections.forEach(d => {
    groupedDetections[d.name] = {
      confidence: d.confidence,
      score: d.score,
      patterns: d.evidence.map(e => `${e.type}: ${e.pattern}`),
    };
  });

  // Generate third-party services grouped by category
  const thirdPartyServices: Record<string, { services: string[]; domains: string[] }> = {};
  const serviceCategories: Record<string, { category: string; services: string[] }> = {
    analytics: { category: "Analytics", services: [] },
    fonts: { category: "Fonts", services: [] },
    cdn: { category: "CDN / Performance", services: [] },
    payments: { category: "Payments", services: [] },
    auth: { category: "Authentication", services: [] },
    support: { category: "Support", services: [] },
    ai: { category: "AI Providers", services: [] },
  };

  allDetections.forEach(d => {
    if (d.category === "analytics") {
      serviceCategories.analytics.services.push(d.name);
    } else if (d.category === "cdn") {
      serviceCategories.cdn.services.push(d.name);
    } else if (d.category === "payments") {
      serviceCategories.payments.services.push(d.name);
    } else if (d.category === "auth") {
      serviceCategories.auth.services.push(d.name);
    } else if (d.category === "support") {
      serviceCategories.support.services.push(d.name);
    }
  });

  aiDetections.forEach(d => {
    serviceCategories.ai.services.push(d.name);
  });

  // Detect fonts
  if (signals.html.includes("fonts.googleapis.com") || signals.scriptSrcs.some(s => s.includes("fonts.googleapis.com"))) {
    serviceCategories.fonts.services.push("Google Fonts");
  }

  Object.entries(serviceCategories).forEach(([key, val]) => {
    if (val.services.length > 0) {
      thirdPartyServices[val.category] = {
        services: val.services,
        domains: [],
      };
    }
  });

  return {
    url,
    framework: framework?.name || null,
    frameworkConfidence: framework?.confidence || null,
    hosting: hosting?.name || null,
    hostingConfidence: hosting?.confidence || null,
    payments: payments?.name || null,
    paymentsConfidence: payments?.confidence || null,
    auth: auth?.name || null,
    authConfidence: auth?.confidence || null,
    analytics: analytics?.name || null,
    analyticsConfidence: analytics?.confidence || null,
    support: support?.name || null,
    supportConfidence: support?.confidence || null,
    aiProvider: aiProvider?.name || null,
    aiConfidence: aiProvider?.confidence || null,
    aiTransport: null,
    aiGateway: null,
    evidence: {
      domains: Array.from(evidenceDomains),
      patterns: Array.from(evidencePatterns),
      groupedDetections,
      thirdPartyServices,
    },
  };
}

import type { BrowserSignals } from "./probeScanner";

export function mergeWithBrowserSignals(
  passiveResult: any,
  browserSignals: BrowserSignals,
  aiFromNetwork: { provider?: string; gateway?: string; confidence: string },
  frameworkFromHints: { framework?: string; confidence: string }
): any {
  const merged: any = { ...passiveResult };

  if (frameworkFromHints.framework && (!merged.framework || frameworkFromHints.confidence === "High")) {
    merged.framework = frameworkFromHints.framework;
    merged.frameworkConfidence = frameworkFromHints.confidence as "High" | "Medium" | "Low";
  }

  if (aiFromNetwork.provider && (!merged.aiProvider || aiFromNetwork.confidence === "High")) {
    merged.aiProvider = aiFromNetwork.provider;
    merged.aiConfidence = aiFromNetwork.confidence as "High" | "Medium" | "Low";
  }

  if (aiFromNetwork.gateway) {
    merged.aiGateway = aiFromNetwork.gateway;
  }

  merged.scanMode = "probe";

  const aiNetworkDomains = browserSignals.network.domains.filter(d => 
    d.includes("openai") || 
    d.includes("anthropic") || 
    d.includes("google") ||
    d.includes("groq") ||
    d.includes("cohere") ||
    d.includes("mistral") ||
    d.includes("replicate") ||
    d.includes("together") ||
    d.includes("perplexity") ||
    d.includes("fireworks") ||
    d.includes("stripe") ||
    d.includes("auth0") ||
    d.includes("clerk") ||
    d.includes("supabase") ||
    d.includes("firebase")
  );

  const relevantPaths = browserSignals.network.paths.filter(p => 
    p.includes("/v1/") || 
    p.includes("/api/") || 
    p.includes("/chat/") ||
    p.includes("/completions")
  ).slice(0, 20);

  const windowHintsList = Object.entries(browserSignals.windowHints)
    .filter(([_, v]) => v)
    .map(([k]) => k);

  // Check if chat UI was found
  const chatUiFound = windowHintsList.some(h => 
    h.includes("chat") || h.includes("message") || h.includes("conversation")
  ) || browserSignals.network.paths.some(p => 
    p.includes("/chat") || p.includes("/message") || p.includes("/completion")
  );

  merged.evidence = {
    domains: [
      ...(merged.evidence?.domains || []),
      ...aiNetworkDomains,
    ],
    patterns: merged.evidence?.patterns || [],
    groupedDetections: merged.evidence?.groupedDetections || {},
    thirdPartyServices: merged.evidence?.thirdPartyServices || {},
    networkDomains: browserSignals.network.domains.slice(0, 50),
    networkPaths: relevantPaths,
    websockets: browserSignals.network.websockets,
    windowHints: windowHintsList,
    probeDiagnostics: {
      pageLoaded: true,
      elementsClicked: 0,
      elementsAttempted: 3,
      chatUiFound,
      totalRequests: browserSignals.network.domains.length * 3 + browserSignals.network.paths.length,
      externalDomains: browserSignals.network.domains.length,
    },
  };

  return merged;
}
