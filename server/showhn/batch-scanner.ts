import { db } from "../storage";
import { showHnProducts, scans, showHnReports, type Scan } from "@shared/schema";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { scanUrl } from "../scanner";
import { browserScan, detectAIFromNetwork, detectFrameworkFromHints, type BrowserSignals } from "../probeScanner";
import { insertScanSchema } from "@shared/schema";
import { chromium, type Browser } from "playwright";

const CONCURRENCY_LIMIT = 1;
const SCAN_DELAY_MS = 2000;

const HIGH_VALUE_PATHS = [
  { path: "/pricing", type: "pricing" },
  { path: "/plans", type: "pricing" },
  { path: "/login", type: "auth" },
  { path: "/signin", type: "auth" },
  { path: "/signup", type: "auth" },
  { path: "/sign-up", type: "auth" },
  { path: "/docs", type: "docs" },
  { path: "/api", type: "docs" },
];

const EXTENDED_AI_DOMAINS: Record<string, string> = {
  "api.openai.com": "OpenAI",
  "openai.azure.com": "Azure OpenAI",
  "api.anthropic.com": "Anthropic",
  "generativelanguage.googleapis.com": "Google Gemini",
  "api.groq.com": "Groq",
  "api.cohere.ai": "Cohere",
  "api.mistral.ai": "Mistral",
  "api.replicate.com": "Replicate",
  "api.together.xyz": "Together AI",
  "api.together.ai": "Together AI",
  "api.perplexity.ai": "Perplexity",
  "api.fireworks.ai": "Fireworks AI",
  "api-inference.huggingface.co": "Hugging Face",
  "huggingface.co": "Hugging Face",
  "api.deepseek.com": "DeepSeek",
  "api.cerebras.ai": "Cerebras",
  "api.sambanova.ai": "SambaNova",
  "gateway.ai.cloudflare.com": "Cloudflare AI",
  "workers.ai": "Cloudflare Workers AI",
  "api.stability.ai": "Stability AI",
  "api.elevenlabs.io": "ElevenLabs",
  "api.assemblyai.com": "AssemblyAI",
  "api.deepgram.com": "Deepgram",
  "api.runpod.io": "RunPod",
  "api.modal.com": "Modal",
  "infer.banana.dev": "Banana.dev",
  "api.baseten.co": "Baseten",
  "api.anyscale.com": "Anyscale",
  "api.lepton.ai": "Lepton AI",
};

const AI_SCRIPT_PATTERNS = [
  { pattern: /openai/i, provider: "OpenAI" },
  { pattern: /anthropic/i, provider: "Anthropic" },
  { pattern: /langchain/i, provider: "LangChain" },
  { pattern: /@google\/generative-ai/i, provider: "Google Gemini" },
  { pattern: /ai\.vercel/i, provider: "Vercel AI SDK" },
  { pattern: /llamaindex/i, provider: "LlamaIndex" },
  { pattern: /huggingface/i, provider: "Hugging Face" },
  { pattern: /cohere/i, provider: "Cohere" },
  { pattern: /replicate/i, provider: "Replicate" },
];

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function detectAIFromNetworkExtended(signals: BrowserSignals): {
  provider?: string;
  gateway?: string;
  confidence: string;
  evidence: string[];
} {
  const { domains, paths, responses, requests } = signals.network;
  const evidence: string[] = [];
  
  let provider: string | undefined;
  let gateway: string | undefined;
  let confidence = "Low";

  for (const domain of domains) {
    if (EXTENDED_AI_DOMAINS[domain]) {
      provider = EXTENDED_AI_DOMAINS[domain];
      confidence = "High";
      evidence.push(`Direct API call to ${domain}`);
      break;
    }
    for (const [partial, name] of Object.entries(EXTENDED_AI_DOMAINS)) {
      if (domain.includes(partial.replace("api.", ""))) {
        if (!provider) {
          provider = name;
          confidence = "Medium";
          evidence.push(`Domain match: ${domain}`);
        }
      }
    }
  }

  for (const path of paths) {
    if (path.includes("/v1/chat/completions") || path.includes("/v1/completions")) {
      if (!provider) {
        provider = "OpenAI-compatible";
        confidence = "Medium";
        evidence.push("OpenAI-compatible chat completions endpoint");
      }
    }
    if (path.includes("/v1/messages")) {
      if (!provider) {
        provider = "Anthropic-compatible";
        confidence = "Medium";
        evidence.push("Anthropic-compatible messages endpoint");
      }
    }
    if (path.includes("/chat") && (path.includes("/api") || path.includes("/v1"))) {
      evidence.push(`Chat API endpoint: ${path}`);
    }
  }

  for (const resp of responses) {
    if (resp.headers["x-vercel-ai-provider"]) {
      const aiProvider = resp.headers["x-vercel-ai-provider"];
      if (aiProvider.includes("openai")) provider = "OpenAI";
      else if (aiProvider.includes("anthropic")) provider = "Anthropic";
      else if (aiProvider.includes("google")) provider = "Google Gemini";
      confidence = "High";
      evidence.push(`Vercel AI SDK header: ${aiProvider}`);
    }
    if (resp.headers["anthropic-version"]) {
      provider = "Anthropic";
      confidence = "High";
      evidence.push("Anthropic version header present");
    }
    if (resp.headers["openai-organization"]) {
      provider = "OpenAI";
      confidence = "High";
      evidence.push("OpenAI organization header present");
    }
  }

  const gatewayDomains: Record<string, string> = {
    "gateway.ai.cloudflare.com": "Cloudflare AI Gateway",
    "api.portkey.ai": "Portkey",
    "gateway.helicone.ai": "Helicone",
  };
  
  for (const domain of domains) {
    if (gatewayDomains[domain]) {
      gateway = gatewayDomains[domain];
      evidence.push(`AI Gateway: ${gateway}`);
      break;
    }
  }

  return { provider, gateway, confidence, evidence };
}

function detectAIFromScripts(scriptSrcs: string[], html: string): { provider?: string; evidence: string[] } {
  const evidence: string[] = [];
  let provider: string | undefined;
  
  for (const src of scriptSrcs) {
    for (const pattern of AI_SCRIPT_PATTERNS) {
      if (pattern.pattern.test(src)) {
        provider = pattern.provider;
        evidence.push(`Script: ${src.substring(0, 100)}`);
        break;
      }
    }
    if (provider) break;
  }
  
  const htmlPatterns = [
    { pattern: /openai/i, provider: "OpenAI" },
    { pattern: /anthropic/i, provider: "Anthropic" },
    { pattern: /gpt-4|gpt-3\.5/i, provider: "OpenAI" },
    { pattern: /claude-3|claude-2/i, provider: "Anthropic" },
    { pattern: /gemini-pro|gemini-1\.5/i, provider: "Google Gemini" },
    { pattern: /langchain/i, provider: "LangChain" },
    { pattern: /useChat|useCompletion/i, provider: "Vercel AI SDK" },
  ];
  
  for (const p of htmlPatterns) {
    if (p.pattern.test(html)) {
      if (!provider) provider = p.provider;
      evidence.push(`HTML pattern: ${p.pattern.source}`);
      break;
    }
  }
  
  return { provider, evidence };
}

type PageScanResult = {
  url: string;
  type: string;
  framework?: string;
  aiProvider?: string;
  payments?: string;
  auth?: string;
  analytics?: string;
  hosting?: string;
  evidence: string[];
  networkDomains: string[];
};

function detectIndirectSignals(html: string, scriptSrcs: string[]): {
  payments?: string;
  aiProvider?: string;
  auth?: string;
  evidence: string[];
} {
  const evidence: string[] = [];
  let payments: string | undefined;
  let aiProvider: string | undefined;
  let auth: string | undefined;
  
  const allText = html + " " + scriptSrcs.join(" ");

  const stripePatterns = [
    { pattern: /pk_(live|test)_[a-zA-Z0-9]{10,}/, name: "Stripe public key" },
    { pattern: /js\.stripe\.com/i, name: "Stripe.js script" },
    { pattern: /checkout\.stripe\.com/i, name: "Stripe Checkout" },
    { pattern: /stripe-pricing-table/i, name: "Stripe pricing table" },
    { pattern: /data-stripe/i, name: "Stripe data attribute" },
    { pattern: /Stripe\s*\(/i, name: "Stripe SDK init" },
    { pattern: /new\s+Stripe\s*\(/i, name: "new Stripe()" },
    { pattern: /redirectToCheckout/i, name: "Stripe redirectToCheckout" },
    { pattern: /createCheckoutSession/i, name: "Stripe checkout session" },
    { pattern: /stripe\.elements/i, name: "Stripe Elements" },
    { pattern: /stripePromise/i, name: "Stripe promise" },
    { pattern: /@stripe\/stripe-js/i, name: "@stripe/stripe-js" },
    { pattern: /stripe-button/i, name: "Stripe button class" },
  ];
  
  for (const { pattern, name } of stripePatterns) {
    if (pattern.test(allText)) {
      payments = "Stripe";
      evidence.push(`Stripe: ${name}`);
      break;
    }
  }

  if (!payments) {
    if (/paddle\.js|paddle\.com|data-paddle/i.test(allText)) {
      payments = "Paddle";
      evidence.push("Paddle SDK detected");
    } else if (/lemonsqueezy|lemon-squeezy|data-lemon/i.test(allText)) {
      payments = "Lemon Squeezy";
      evidence.push("Lemon Squeezy detected");
    } else if (/gumroad\.com|gumroad-button/i.test(allText)) {
      payments = "Gumroad";
      evidence.push("Gumroad detected");
    } else if (/chargebee\.com|chargebee\.js/i.test(allText)) {
      payments = "Chargebee";
      evidence.push("Chargebee detected");
    } else if (/recurly\.com|recurly\.js/i.test(allText)) {
      payments = "Recurly";
      evidence.push("Recurly detected");
    }
  }

  const aiPatterns = [
    { pattern: /openai|gpt-4|gpt-3\.5|chatgpt|dall-e/i, provider: "OpenAI" },
    { pattern: /anthropic|claude-3|claude-2|claude-instant/i, provider: "Anthropic" },
    { pattern: /gemini|generativelanguage\.googleapis|google-ai/i, provider: "Google Gemini" },
    { pattern: /groq\.com|api\.groq|llama-3/i, provider: "Groq" },
    { pattern: /together\.ai|togetherai|together\.xyz/i, provider: "Together AI" },
    { pattern: /replicate\.com|replicate\.delivery/i, provider: "Replicate" },
    { pattern: /cohere\.ai|cohere\.com|command-r/i, provider: "Cohere" },
    { pattern: /mistral\.ai|mistral-/i, provider: "Mistral" },
    { pattern: /perplexity\.ai/i, provider: "Perplexity" },
    { pattern: /fireworks\.ai/i, provider: "Fireworks AI" },
    { pattern: /huggingface|hf\.co|transformers\.js/i, provider: "Hugging Face" },
    { pattern: /deepseek/i, provider: "DeepSeek" },
    { pattern: /cerebras/i, provider: "Cerebras" },
    { pattern: /stability\.ai|stablediffusion/i, provider: "Stability AI" },
    { pattern: /elevenlabs|eleven-labs/i, provider: "ElevenLabs" },
    { pattern: /assemblyai/i, provider: "AssemblyAI" },
    { pattern: /langchain|@langchain/i, provider: "LangChain" },
    { pattern: /llamaindex|llama-index|llama_index/i, provider: "LlamaIndex" },
    { pattern: /litellm|lite-llm/i, provider: "LiteLLM" },
    { pattern: /openrouter\.ai|openrouter/i, provider: "OpenRouter" },
    { pattern: /portkey\.ai|portkey/i, provider: "Portkey" },
    { pattern: /helicone\.ai|helicone/i, provider: "Helicone" },
    { pattern: /bedrock|aws.*ai|amazon.*titan/i, provider: "AWS Bedrock" },
    { pattern: /vertex\.ai|vertexai|aiplatform\.googleapis/i, provider: "Google Vertex" },
    { pattern: /azure\.openai|openai\.azure/i, provider: "Azure OpenAI" },
    { pattern: /pinecone/i, provider: "Pinecone" },
    { pattern: /chroma|chromadb/i, provider: "Chroma" },
    { pattern: /weaviate/i, provider: "Weaviate" },
    { pattern: /qdrant/i, provider: "Qdrant" },
    { pattern: /useChat|useCompletion|ai\/react|@ai-sdk/i, provider: "Vercel AI SDK" },
  ];
  
  for (const { pattern, provider } of aiPatterns) {
    if (pattern.test(allText)) {
      if (!aiProvider) aiProvider = provider;
      evidence.push(`AI: ${provider} detected`);
      break;
    }
  }

  const authPatterns = [
    { pattern: /clerk\.com|clerk\.dev|@clerk|__clerk/i, provider: "Clerk" },
    { pattern: /auth0\.com|auth0-js|@auth0/i, provider: "Auth0" },
    { pattern: /supabase\.(io|com|co)|@supabase/i, provider: "Supabase" },
    { pattern: /firebase\.google|firebaseapp|@firebase/i, provider: "Firebase" },
    { pattern: /next-auth|nextauth|authjs\.dev/i, provider: "NextAuth" },
    { pattern: /kinde\.com|@kinde/i, provider: "Kinde" },
    { pattern: /lucia-auth|lucia\.auth/i, provider: "Lucia" },
    { pattern: /workos\.com|@workos/i, provider: "WorkOS" },
    { pattern: /stytch\.com|@stytch/i, provider: "Stytch" },
    { pattern: /magic\.link|@magic-sdk/i, provider: "Magic" },
    { pattern: /privy\.io|@privy/i, provider: "Privy" },
  ];
  
  for (const { pattern, provider } of authPatterns) {
    if (pattern.test(allText)) {
      if (!auth) auth = provider;
      evidence.push(`Auth: ${provider} detected`);
      break;
    }
  }

  for (const src of scriptSrcs) {
    if (/stripe/i.test(src) && !payments) {
      payments = "Stripe";
      evidence.push(`Script src: ${src}`);
    }
    if (/paddle/i.test(src) && !payments) {
      payments = "Paddle";
      evidence.push(`Script src: ${src}`);
    }
    if (/openai|anthropic|ai\.google|langchain/i.test(src) && !aiProvider) {
      aiProvider = "AI SDK";
      evidence.push(`AI script src: ${src}`);
    }
  }

  return { payments, aiProvider, auth, evidence };
}

async function probePageForDynamicContent(
  page: Awaited<ReturnType<Awaited<ReturnType<Browser["newContext"]>>["newPage"]>>,
  pageType: string
): Promise<{ newDomains: string[]; evidence: string[]; postClickHtml?: string }> {
  const evidence: string[] = [];
  const requestsAfterProbe: string[] = [];
  let postClickHtml: string | undefined;
  
  const captureRequest = (req: { url: () => string }) => {
    try {
      const url = new URL(req.url());
      if (!requestsAfterProbe.includes(url.hostname)) {
        requestsAfterProbe.push(url.hostname);
      }
      if (/stripe|paddle|lemonsqueezy|openai|anthropic|clerk|auth0|supabase/i.test(url.hostname)) {
        evidence.push(`Network after probe: ${url.hostname}`);
      }
    } catch {}
  };
  
  page.on("request", captureRequest);

  try {
    if (pageType === "pricing" || pageType === "homepage") {
      const paymentButtonSelectors = [
        '[data-stripe]',
        '[data-paddle]',
        'button:has-text("Subscribe")',
        'button:has-text("Buy now")',
        'button:has-text("Get started")',
        'button:has-text("Start free")',
        'button:has-text("Try free")',
        'button:has-text("Upgrade")',
        'a:has-text("Subscribe")',
        'a:has-text("Buy")',
        'a:has-text("Upgrade")',
        '.pricing-cta',
        '.buy-button',
        '.checkout-button',
      ];
      
      for (const selector of paymentButtonSelectors) {
        try {
          const btn = page.locator(selector).first();
          if (await btn.isVisible({ timeout: 300 })) {
            const originalUrl = page.url();
            
            await btn.click({ timeout: 2000 }).catch(() => {});
            evidence.push(`Clicked: ${selector}`);
            
            await page.waitForTimeout(1500);
            
            const newUrl = page.url();
            if (newUrl !== originalUrl) {
              if (/stripe|checkout|pay|billing/i.test(newUrl)) {
                evidence.push(`Navigated to payment: ${newUrl}`);
              }
              await page.goBack().catch(() => {});
              await page.waitForTimeout(500);
            }
            
            postClickHtml = await page.content().catch(() => "");
            break;
          }
        } catch {}
      }
    }

    if (pageType === "homepage" || pageType === "docs") {
      const aiInteractionSelectors = [
        'textarea[placeholder*="message" i]',
        'textarea[placeholder*="ask" i]',
        'textarea[placeholder*="chat" i]',
        'textarea[placeholder*="type" i]',
        'input[placeholder*="ask" i]',
        'input[placeholder*="search" i]',
        '[data-testid*="chat"]',
        '[data-testid*="prompt"]',
        '.chat-input',
        '#prompt',
      ];
      
      for (const selector of aiInteractionSelectors) {
        try {
          const el = page.locator(selector).first();
          if (await el.isVisible({ timeout: 300 })) {
            await el.click({ timeout: 1000 }).catch(() => {});
            await el.type("test", { delay: 50 }).catch(() => {});
            evidence.push(`Typed in AI input: ${selector}`);
            await page.waitForTimeout(1000);
            
            postClickHtml = await page.content().catch(() => "");
            break;
          }
        } catch {}
      }
    }

    if (pageType === "auth") {
      const authButtonSelectors = [
        'button:has-text("Sign in with Google")',
        'button:has-text("Continue with Google")',
        'button:has-text("Sign in with GitHub")',
        'button:has-text("Continue with GitHub")',
        'button:has-text("Sign in")',
        'button:has-text("Log in")',
        '[data-clerk]',
        '.auth0-lock-submit',
        '[data-provider="google"]',
        '[data-provider="github"]',
      ];
      
      for (const selector of authButtonSelectors) {
        try {
          const btn = page.locator(selector).first();
          if (await btn.isVisible({ timeout: 300 })) {
            await btn.hover({ timeout: 500 });
            evidence.push(`Found auth button: ${selector}`);
            await page.waitForTimeout(500);
            break;
          }
        } catch {}
      }
    }

    await page.waitForTimeout(800);

  } catch (error) {
    evidence.push(`Probe error: ${String(error).slice(0, 100)}`);
  }
  
  page.off("request", captureRequest);
  
  return { newDomains: requestsAfterProbe, evidence, postClickHtml };
}

async function discoverValidPages(
  baseUrl: string,
  context: Awaited<ReturnType<Browser["newContext"]>>
): Promise<Array<{ url: string; type: string }>> {
  const origin = new URL(baseUrl).origin;
  const pages: Array<{ url: string; type: string }> = [{ url: baseUrl, type: "homepage" }];
  const checkedTypes = new Set<string>();
  
  const pathsByType: Record<string, string[]> = {
    pricing: ["/pricing", "/plans", "/pro", "/upgrade"],
    auth: ["/login", "/signin", "/signup", "/sign-up", "/register"],
    docs: ["/docs", "/api", "/documentation", "/developers"],
  };
  
  for (const [type, paths] of Object.entries(pathsByType)) {
    if (checkedTypes.has(type)) continue;
    
    for (const path of paths) {
      const testUrl = `${origin}${path}`;
      try {
        const page = await context.newPage();
        const resp = await page.goto(testUrl, { timeout: 8000, waitUntil: "domcontentloaded" });
        const status = resp?.status() || 0;
        const finalUrl = page.url();
        await page.close();
        
        if (status >= 200 && status < 400) {
          const finalPath = new URL(finalUrl).pathname;
          if (finalPath !== "/" && !pages.some(p => p.url === testUrl)) {
            pages.push({ url: testUrl, type });
            checkedTypes.add(type);
            break;
          }
        }
      } catch {
        continue;
      }
    }
    
    if (pages.length >= 4) break;
  }
  
  return pages;
}

async function scanMultiplePages(
  baseUrl: string,
  browser: Browser
): Promise<PageScanResult[]> {
  const results: PageScanResult[] = [];
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  
  console.log(`[MultiPage] Discovering pages for ${baseUrl}...`);
  const pagesToScan = await discoverValidPages(baseUrl, context);
  console.log(`[MultiPage] Found ${pagesToScan.length} pages to scan: ${pagesToScan.map(p => p.type).join(", ")}`);
  
  for (const pageInfo of pagesToScan) {
    try {
      const page = await context.newPage();
      
      const requests: BrowserSignals["network"]["requests"] = [];
      const responses: BrowserSignals["network"]["responses"] = [];
      
      page.on("request", (req) => {
        if (requests.length >= 200) return;
        requests.push({
          url: req.url(),
          method: req.method(),
          resourceType: req.resourceType(),
        });
      });
      
      page.on("response", async (resp) => {
        if (responses.length >= 200) return;
        responses.push({
          url: resp.url(),
          status: resp.status(),
          contentType: resp.headers()["content-type"] ?? null,
          headers: resp.headers(),
        });
      });
      
      await page.route("**/*", (route) => {
        const rt = route.request().resourceType();
        if (rt === "image" || rt === "font" || rt === "media") return route.abort();
        return route.continue();
      });
      
      const mainResp = await page.goto(pageInfo.url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      
      if (!mainResp || mainResp.status() >= 400) {
        await page.close();
        continue;
      }
      
      await page.waitForTimeout(1500);
      
      const html = await page.content();
      const scriptSrcs = await page.$$eval("script[src]", els => 
        els.map(el => el.getAttribute("src") || "")
      );
      
      const domains = Array.from(new Set([
        ...requests.map(r => { try { return new URL(r.url).hostname; } catch { return ""; } }),
        ...responses.map(r => { try { return new URL(r.url).hostname; } catch { return ""; } }),
      ])).filter(Boolean);
      
      const paths = Array.from(new Set([
        ...requests.map(r => { try { return new URL(r.url).pathname; } catch { return ""; } }),
      ])).filter(Boolean);
      
      const browserSignals: BrowserSignals = {
        finalUrl: page.url(),
        mainResponse: {
          status: mainResp.status(),
          headers: mainResp.headers(),
        },
        html,
        scriptSrcs,
        meta: {},
        cookies: [],
        windowHints: {},
        network: { requests, responses, websockets: [], domains, paths },
      };
      
      const aiFromNetwork = detectAIFromNetworkExtended(browserSignals);
      const aiFromScripts = detectAIFromScripts(scriptSrcs, html);
      const indirectSignals = detectIndirectSignals(html, scriptSrcs);
      
      console.log(`[Probe] Running probe scan for ${pageInfo.url} (${pageInfo.type})...`);
      const probeResults = await probePageForDynamicContent(page, pageInfo.type);
      
      let postClickSignals: ReturnType<typeof detectIndirectSignals> | undefined;
      if (probeResults.postClickHtml && probeResults.postClickHtml !== html) {
        postClickSignals = detectIndirectSignals(probeResults.postClickHtml, []);
        if (postClickSignals.evidence.length > 0) {
          console.log(`[Probe] Post-click detection found: ${postClickSignals.evidence.join(", ")}`);
        }
      }
      
      const allDomains = [...domains, ...probeResults.newDomains];
      const allEvidence = [
        ...aiFromNetwork.evidence, 
        ...aiFromScripts.evidence,
        ...indirectSignals.evidence,
        ...probeResults.evidence,
        ...(postClickSignals?.evidence || []),
      ];
      
      const result: PageScanResult = {
        url: pageInfo.url,
        type: pageInfo.type,
        aiProvider: aiFromNetwork.provider || aiFromScripts.provider || indirectSignals.aiProvider || postClickSignals?.aiProvider,
        payments: indirectSignals.payments || postClickSignals?.payments,
        auth: indirectSignals.auth || postClickSignals?.auth,
        evidence: allEvidence,
        networkDomains: allDomains,
      };
      
      const probedDomains = [...domains, ...probeResults.newDomains];
      
      if (pageInfo.type === "pricing" || pageInfo.type === "homepage") {
        if (!result.payments && probedDomains.some(d => d.includes("stripe") || d.includes("js.stripe.com"))) {
          result.payments = "Stripe";
          result.evidence.push("Stripe JS loaded after probe");
        }
        if (!result.payments && probedDomains.some(d => d.includes("paddle"))) {
          result.payments = "Paddle";
          result.evidence.push("Paddle detected after probe");
        }
        if (!result.payments && probedDomains.some(d => d.includes("lemonsqueezy"))) {
          result.payments = "Lemon Squeezy";
          result.evidence.push("Lemon Squeezy detected after probe");
        }
        if (!result.payments && probedDomains.some(d => d.includes("gumroad"))) {
          result.payments = "Gumroad";
          result.evidence.push("Gumroad detected after probe");
        }
      }
      
      if (pageInfo.type === "auth" || pageInfo.type === "homepage") {
        if (!result.auth && probedDomains.some(d => d.includes("clerk"))) {
          result.auth = "Clerk";
          result.evidence.push("Clerk auth detected after probe");
        }
        if (!result.auth && probedDomains.some(d => d.includes("auth0"))) {
          result.auth = "Auth0";
          result.evidence.push("Auth0 detected after probe");
        }
        if (!result.auth && probedDomains.some(d => d.includes("supabase"))) {
          result.auth = "Supabase";
          result.evidence.push("Supabase detected after probe");
        }
        if (!result.auth && probedDomains.some(d => d.includes("firebase"))) {
          result.auth = "Firebase";
          result.evidence.push("Firebase detected after probe");
        }
        if (!result.auth && (html.includes("next-auth") || html.includes("NextAuth"))) {
          result.auth = "NextAuth";
          result.evidence.push("NextAuth detected");
        }
      }
      
      results.push(result);
      await page.close();
      
    } catch (error) {
      console.log(`[MultiPage] Failed to scan ${pageInfo.url}: ${error}`);
    }
  }
  
  await context.close();
  return results;
}

function mergePageResults(pageResults: PageScanResult[]): Partial<Scan> {
  const merged: Partial<Scan> = {};
  const allEvidence: string[] = [];
  const allDomains: string[] = [];
  
  for (const page of pageResults) {
    if (page.aiProvider && !merged.aiProvider) {
      merged.aiProvider = page.aiProvider;
    }
    if (page.payments && !merged.payments) {
      merged.payments = page.payments;
    }
    if (page.auth && !merged.auth) {
      merged.auth = page.auth;
    }
    if (page.analytics && !merged.analytics) {
      merged.analytics = page.analytics;
    }
    if (page.hosting && !merged.hosting) {
      merged.hosting = page.hosting;
    }
    
    allEvidence.push(...page.evidence.map(e => `[${page.type}] ${e}`));
    allDomains.push(...page.networkDomains);
  }
  
  return {
    ...merged,
    evidence: {
      pageSnapshots: pageResults.map(p => ({
        url: p.url,
        type: p.type,
        detections: p.evidence,
      })),
      networkDomains: Array.from(new Set(allDomains)).slice(0, 100),
      multiPageScan: true,
    } as any,
  };
}

async function scanProductMultiPage(product: typeof showHnProducts.$inferSelect): Promise<string | null> {
  console.log(`[Batch Scanner] Multi-page scanning ${product.domain}...`);
  
  let browser: Browser | null = null;
  
  try {
    await db.update(showHnProducts)
      .set({ scanStatus: "scanning" })
      .where(eq(showHnProducts.id, product.id));
    
    let scanResult = await scanUrl(product.productUrl);
    
    (scanResult as any).scanPhases = {
      passive: "complete",
      render: "pending",
      probe: "pending",
    };
    (scanResult as any).scanMode = "passive";
    
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    
    console.log(`[Batch Scanner] Running multi-page render scan for ${product.domain}...`);
    const pageResults = await scanMultiplePages(product.productUrl, browser);
    
    await browser.close();
    browser = null;
    
    const merged = mergePageResults(pageResults);
    
    if (merged.aiProvider) {
      scanResult.aiProvider = merged.aiProvider;
      (scanResult as any).aiConfidence = "High";
    }
    if (merged.payments && !scanResult.payments) {
      scanResult.payments = merged.payments;
    }
    if (merged.auth && !scanResult.auth) {
      scanResult.auth = merged.auth;
    }
    if (merged.analytics && !scanResult.analytics) {
      scanResult.analytics = merged.analytics;
    }
    
    (scanResult as any).scanPhases = {
      passive: "complete",
      render: "complete",
      probe: "complete",
    };
    (scanResult as any).scanMode = "full-probe";
    (scanResult as any).evidence = merged.evidence;
    
    const validatedScan = insertScanSchema.parse(scanResult);
    const [savedScan] = await db.insert(scans).values(validatedScan).returning();
    
    await db.update(showHnProducts)
      .set({ 
        scanId: savedScan.id,
        scanStatus: "complete",
      })
      .where(eq(showHnProducts.id, product.id));
    
    const pagesScanned = pageResults.length;
    console.log(`[Batch Scanner] Completed ${product.domain}: ${pagesScanned} pages, ${savedScan.framework || "No framework"}, ${savedScan.aiProvider || "No AI"}`);
    
    return savedScan.id;
  } catch (error) {
    console.error(`[Batch Scanner] Failed to scan ${product.domain}:`, error);
    
    if (browser) {
      await browser.close().catch(() => {});
    }
    
    await db.update(showHnProducts)
      .set({ scanStatus: "failed" })
      .where(eq(showHnProducts.id, product.id));
    
    return null;
  }
}

export async function runBatchScan(): Promise<void> {
  const pendingProducts = await db.select()
    .from(showHnProducts)
    .where(eq(showHnProducts.scanStatus, "pending"));
  
  console.log(`[Batch Scanner] Found ${pendingProducts.length} products to scan (multi-page mode)`);
  
  const queue = [...pendingProducts];
  let activeScans = 0;
  let completedScans = 0;
  
  const scanNext = async (): Promise<void> => {
    while (queue.length > 0 && activeScans < CONCURRENCY_LIMIT) {
      const product = queue.shift();
      if (!product) break;
      
      activeScans++;
      
      scanProductMultiPage(product)
        .then(() => {
          completedScans++;
          activeScans--;
          console.log(`[Batch Scanner] Progress: ${completedScans}/${pendingProducts.length}`);
        })
        .catch(() => {
          activeScans--;
        });
      
      await delay(SCAN_DELAY_MS);
    }
    
    if (queue.length > 0) {
      await delay(1000);
      await scanNext();
    }
  };
  
  await scanNext();
  
  while (activeScans > 0) {
    await delay(1000);
  }
  
  console.log(`[Batch Scanner] Batch scan complete. ${completedScans} scans completed.`);
}

export async function generateAggregateReport(): Promise<string> {
  console.log("[Report] Generating aggregate report...");
  
  const products = await db.select()
    .from(showHnProducts)
    .where(eq(showHnProducts.scanStatus, "complete"));
  
  const scanIds = products.map(p => p.scanId).filter((id): id is string => id !== null);
  
  if (scanIds.length === 0) {
    console.log("[Report] No completed scans found");
    throw new Error("No completed scans to generate report from");
  }
  
  const scanResults = await db.select()
    .from(scans)
    .where(inArray(scans.id, scanIds));
  
  const countByField = (field: keyof Scan): Array<{ name: string; count: number; percentage: number }> => {
    const counts: Record<string, number> = {};
    for (const scan of scanResults) {
      const value = scan[field] as string | null;
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    }
    
    const total = scanResults.length;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }));
  };
  
  const aiSignalCount = scanResults.filter(s => s.aiProvider !== null).length;
  const aiSignalPercentage = Math.round((aiSignalCount / scanResults.length) * 100);
  
  const stackCombos: Record<string, number> = {};
  for (const scan of scanResults) {
    const combo = [scan.framework, scan.hosting].filter(Boolean).join(" + ");
    if (combo) {
      stackCombos[combo] = (stackCombos[combo] || 0) + 1;
    }
  }
  
  const topStackCombos = Object.entries(stackCombos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([stack, count]) => ({ stack, count }));
  
  const aggregateStats = {
    topFrameworks: countByField("framework"),
    topHosting: countByField("hosting"),
    topPayments: countByField("payments"),
    topAuth: countByField("auth"),
    topAnalytics: countByField("analytics"),
    topAiProviders: countByField("aiProvider"),
    aiSignalPercentage,
    topStackCombos,
  };
  
  const dates = products.map(p => p.createdAt);
  const dateRangeStart = new Date(Math.min(...dates.map(d => d.getTime())));
  const dateRangeEnd = new Date(Math.max(...dates.map(d => d.getTime())));
  
  const [report] = await db.insert(showHnReports).values({
    productCount: String(products.length),
    dateRangeStart,
    dateRangeEnd,
    aggregateStats,
  }).returning();
  
  console.log(`[Report] Report generated with ID: ${report.id}`);
  return report.id;
}

export async function exportToCsv(): Promise<string> {
  const products = await db.select({
    product: showHnProducts,
    scan: scans,
  })
    .from(showHnProducts)
    .leftJoin(scans, sql`${showHnProducts.scanId} = ${scans.id}`)
    .orderBy(desc(sql`CAST(${showHnProducts.score} AS INTEGER)`));
  
  const headers = [
    "HN ID", "Title", "Author", "Score", "Comments", "Domain",
    "Product URL", "HN Link", "Framework", "Hosting", "Payments",
    "Auth", "Analytics", "AI Provider"
  ];
  
  const rows = products.map(({ product, scan }) => [
    product.hnId,
    `"${(product.title || "").replace(/"/g, '""')}"`,
    product.author,
    product.score,
    product.commentsCount,
    product.domain,
    product.productUrl,
    product.hnLink,
    scan?.framework || "",
    scan?.hosting || "",
    scan?.payments || "",
    scan?.auth || "",
    scan?.analytics || "",
    scan?.aiProvider || "",
  ]);
  
  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}
