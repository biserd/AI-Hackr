import type { InsertScan } from "@shared/schema";

interface TechSignature {
  name: string;
  patterns: {
    script?: RegExp[];
    meta?: RegExp[];
    text?: RegExp[];
    header?: string[];
  };
}

const techSignatures: Record<string, TechSignature[]> = {
  frameworks: [
    {
      name: "Next.js",
      patterns: {
        script: [/_next\/static/, /__NEXT_DATA__/],
        meta: [/next\.js/i],
      },
    },
    {
      name: "React",
      patterns: {
        script: [/react/, /react-dom/],
        text: [/__REACT/],
      },
    },
    {
      name: "Vue",
      patterns: {
        script: [/vue\.js/, /vue\.runtime/],
      },
    },
    {
      name: "Angular",
      patterns: {
        script: [/angular/, /@angular/],
      },
    },
    {
      name: "Svelte",
      patterns: {
        script: [/svelte/],
      },
    },
  ],
  hosting: [
    {
      name: "Vercel",
      patterns: {
        header: ["x-vercel-id", "x-vercel-cache"],
        script: [/vercel/],
      },
    },
    {
      name: "Netlify",
      patterns: {
        header: ["x-nf-request-id"],
      },
    },
    {
      name: "AWS",
      patterns: {
        header: ["x-amz-cf-id", "x-amz-request-id"],
        script: [/cloudfront/],
      },
    },
    {
      name: "Cloudflare",
      patterns: {
        header: ["cf-ray"],
        script: [/cloudflare/],
      },
    },
  ],
  payments: [
    {
      name: "Stripe",
      patterns: {
        script: [/stripe\.com\/v3/, /js\.stripe\.com/],
      },
    },
    {
      name: "PayPal",
      patterns: {
        script: [/paypal\.com\/sdk/],
      },
    },
  ],
  auth: [
    {
      name: "Clerk",
      patterns: {
        script: [/clerk\./, /@clerk/],
      },
    },
    {
      name: "Auth0",
      patterns: {
        script: [/auth0/],
      },
    },
    {
      name: "Supabase",
      patterns: {
        script: [/supabase/],
      },
    },
  ],
  analytics: [
    {
      name: "Google Analytics",
      patterns: {
        script: [/google-analytics\.com/, /gtag\/js/],
      },
    },
    {
      name: "Segment",
      patterns: {
        script: [/segment\.com/, /analytics\.js/],
      },
    },
    {
      name: "Mixpanel",
      patterns: {
        script: [/mixpanel/],
      },
    },
    {
      name: "Amplitude",
      patterns: {
        script: [/amplitude/],
      },
    },
  ],
  support: [
    {
      name: "Intercom",
      patterns: {
        script: [/intercom/],
      },
    },
    {
      name: "Zendesk",
      patterns: {
        script: [/zendesk/],
      },
    },
  ],
  ai: [
    {
      name: "OpenAI",
      patterns: {
        script: [/openai\.com/, /api\.openai/],
        text: [/gpt-4/, /gpt-3\.5/],
      },
    },
    {
      name: "Anthropic",
      patterns: {
        script: [/anthropic/, /claude/],
        text: [/claude/i],
      },
    },
    {
      name: "Google Gemini",
      patterns: {
        script: [/gemini/, /generativelanguage\.googleapis/],
      },
    },
    {
      name: "Azure OpenAI",
      patterns: {
        script: [/openai\.azure/],
      },
    },
  ],
};

function calculateConfidence(matchCount: number, totalPatterns: number): string {
  const ratio = matchCount / totalPatterns;
  if (ratio >= 0.7) return "High";
  if (ratio >= 0.4) return "Medium";
  return "Low";
}

function detectTech(
  html: string,
  headers: Record<string, string>,
  category: keyof typeof techSignatures
): { name: string; confidence: string } | null {
  const signatures = techSignatures[category];
  let bestMatch: { name: string; matchCount: number; totalPatterns: number } | null = null;

  for (const sig of signatures) {
    let matchCount = 0;
    let totalPatterns = 0;

    // Check script patterns
    if (sig.patterns.script) {
      totalPatterns += sig.patterns.script.length;
      for (const pattern of sig.patterns.script) {
        if (pattern.test(html)) matchCount++;
      }
    }

    // Check meta patterns
    if (sig.patterns.meta) {
      totalPatterns += sig.patterns.meta.length;
      for (const pattern of sig.patterns.meta) {
        if (pattern.test(html)) matchCount++;
      }
    }

    // Check text patterns
    if (sig.patterns.text) {
      totalPatterns += sig.patterns.text.length;
      for (const pattern of sig.patterns.text) {
        if (pattern.test(html)) matchCount++;
      }
    }

    // Check header patterns
    if (sig.patterns.header) {
      totalPatterns += sig.patterns.header.length;
      for (const headerName of sig.patterns.header) {
        if (headers[headerName.toLowerCase()]) matchCount++;
      }
    }

    if (matchCount > 0) {
      if (!bestMatch || matchCount > bestMatch.matchCount) {
        bestMatch = { name: sig.name, matchCount, totalPatterns };
      }
    }
  }

  if (bestMatch) {
    return {
      name: bestMatch.name,
      confidence: calculateConfidence(bestMatch.matchCount, bestMatch.totalPatterns),
    };
  }

  return null;
}

export async function scanUrl(url: string): Promise<Omit<InsertScan, "scannedAt">> {
  try {
    // Normalize URL
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

    // Fetch the webpage
    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "AIHackr Scanner/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Extract detected technologies
    const framework = detectTech(html, headers, "frameworks");
    const hosting = detectTech(html, headers, "hosting");
    const payments = detectTech(html, headers, "payments");
    const auth = detectTech(html, headers, "auth");
    const analytics = detectTech(html, headers, "analytics");
    const support = detectTech(html, headers, "support");
    const ai = detectTech(html, headers, "ai");

    // Extract evidence
    const scriptMatches: string[] = [];
    const scriptRegex = /<script[^>]*src=["']([^"']+)["']/gi;
    let match;
    while ((match = scriptRegex.exec(html)) !== null && scriptMatches.length < 10) {
      scriptMatches.push(match[1]);
    }

    const domains = new Set<string>();
    scriptMatches.forEach((src) => {
      try {
        const urlObj = new URL(src, normalizedUrl);
        domains.add(urlObj.hostname);
      } catch (e) {
        // Ignore invalid URLs
      }
    });

    return {
      url: normalizedUrl,
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
      aiProvider: ai?.name || null,
      aiConfidence: ai?.confidence || null,
      aiTransport: ai ? "Detected via script patterns" : null,
      aiGateway: null,
      evidence: {
        domains: Array.from(domains).slice(0, 10),
        scripts: scriptMatches.slice(0, 10),
        headers: headers,
        patterns: [],
      },
    };
  } catch (error) {
    throw new Error(`Scan failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
