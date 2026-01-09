import { chromium, type Browser, type Page } from "playwright";
import { AI_GATEWAY_SIGNATURES, PAYLOAD_SIGNATURES, SPEED_FINGERPRINTS } from "./signatures";

export type BrowserSignals = {
  finalUrl: string;
  mainResponse: {
    status: number | null;
    headers: Record<string, string>;
  };
  html: string;
  scriptSrcs: string[];
  meta: Record<string, string[]>;
  cookies: { name: string; value: string; domain?: string; path?: string }[];
  windowHints: Record<string, boolean>;
  network: {
    requests: Array<{
      url: string;
      method: string;
      resourceType: string;
    }>;
    responses: Array<{
      url: string;
      status: number;
      contentType: string | null;
      headers: Record<string, string>;
    }>;
    websockets: string[];
    domains: string[];
    paths: string[];
  };
};

type BrowserScanOptions = {
  timeoutMs?: number;
  maxHtmlChars?: number;
  maxNetworkEntries?: number;
  blockResources?: boolean;
};

const BROWSER_DEFAULTS: Required<BrowserScanOptions> = {
  timeoutMs: 15000,
  maxHtmlChars: 2_000_000,
  maxNetworkEntries: 400,
  blockResources: true,
};

function safeLower(s: string | undefined | null): string {
  return (s ?? "").toLowerCase();
}

function getDomain(u: string): string {
  try { return new URL(u).hostname; } catch { return ""; }
}

function getPath(u: string): string {
  try { return new URL(u).pathname; } catch { return ""; }
}

export async function browserScan(url: string, opts: BrowserScanOptions = {}): Promise<BrowserSignals> {
  const o = { ...BROWSER_DEFAULTS, ...opts };

  let browser: Browser | null = null;
  try {
    console.log(`[BrowserScan] Launching browser for: ${url}`);
    const startTime = Date.now();

    browser = await chromium.launch({ 
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

    if (o.blockResources) {
      await page.route("**/*", (route) => {
        const rt = route.request().resourceType();
        if (rt === "image" || rt === "font" || rt === "media") return route.abort();
        return route.continue();
      });
    }

    const reqs: BrowserSignals["network"]["requests"] = [];
    const resps: BrowserSignals["network"]["responses"] = [];
    const ws: string[] = [];

    page.on("request", (req) => {
      if (reqs.length >= o.maxNetworkEntries) return;
      reqs.push({
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
      });
    });

    page.on("response", async (resp) => {
      if (resps.length >= o.maxNetworkEntries) return;
      const headers = resp.headers();
      resps.push({
        url: resp.url(),
        status: resp.status(),
        contentType: headers["content-type"] ?? null,
        headers: headers,
      });
    });

    page.on("websocket", (socket) => {
      ws.push(socket.url());
    });

    const mainResp = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: o.timeoutMs,
    });

    await page.waitForTimeout(1500);

    let html = await page.content();
    if (html.length > o.maxHtmlChars) html = html.slice(0, o.maxHtmlChars);

    const scriptSrcs = await page.$$eval("script[src]", (els) =>
      els.map((e) => (e as HTMLScriptElement).src).filter(Boolean)
    );

    const meta = await page.$$eval("meta", (els) => {
      const out: Record<string, string[]> = {};
      for (const el of els) {
        const name = el.getAttribute("name") || el.getAttribute("property") || el.getAttribute("http-equiv");
        const content = el.getAttribute("content");
        if (!name || !content) continue;
        (out[name] ||= []).push(content);
      }
      return out;
    });

    const windowHints = await page.evaluate(() => {
      const w = window as any;
      return {
        __NEXT_DATA__: Boolean(w.__NEXT_DATA__),
        __NUXT__: Boolean(w.__NUXT__),
        Shopify: Boolean(w.Shopify),
        __GATSBY: Boolean(w.__GATSBY),
        __remixContext: Boolean(w.__remixContext),
        __svelte: Boolean(w.__svelte),
        Angular: Boolean((w as any).getAllAngularRootElements),
        Vue: Boolean((document as any).__vue_app__),
        Streamlit: Boolean(document.querySelector('[data-testid="stAppViewContainer"]')),
        Gradio: Boolean(document.querySelector('.gradio-container')),
      };
    });

    const cookies = (await context.cookies()).map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    }));

    const mainHeaders = (mainResp ? mainResp.headers() : {}) as Record<string, string>;

    const domains = Array.from(
      new Set([
        ...reqs.map((r) => getDomain(r.url)).filter(Boolean),
        ...resps.map((r) => getDomain(r.url)).filter(Boolean),
      ])
    );

    const paths = Array.from(
      new Set([
        ...reqs.map((r) => getPath(r.url)).filter(Boolean),
        ...resps.map((r) => getPath(r.url)).filter(Boolean),
      ])
    );

    const elapsed = Date.now() - startTime;
    console.log(`[BrowserScan] Completed in ${elapsed}ms - ${reqs.length} requests, ${html.length} bytes HTML`);

    await browser.close();
    browser = null;

    return {
      finalUrl: page.url(),
      mainResponse: {
        status: mainResp ? mainResp.status() : null,
        headers: Object.fromEntries(Object.entries(mainHeaders).map(([k, v]) => [safeLower(k), v])),
      },
      html,
      scriptSrcs,
      meta,
      cookies,
      windowHints,
      network: {
        requests: reqs,
        responses: resps,
        websockets: ws,
        domains,
        paths,
      },
    };
  } catch (error) {
    console.error("[BrowserScan] Error:", error);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return {
      finalUrl: url,
      mainResponse: { status: null, headers: {} },
      html: "",
      scriptSrcs: [],
      meta: {},
      cookies: [],
      windowHints: {},
      network: { requests: [], responses: [], websockets: [], domains: [], paths: [] },
    };
  }
}

interface AIInteraction {
  promptSent: string;
  responseReceived: string;
  ttft: number;
  tps: number;
  totalTime: number;
  tokenCount: number;
}

const CHAT_SELECTORS = [
  'input[placeholder*="message" i]',
  'input[placeholder*="ask" i]',
  'input[placeholder*="chat" i]',
  'input[placeholder*="type" i]',
  'textarea[placeholder*="message" i]',
  'textarea[placeholder*="ask" i]',
  'textarea[placeholder*="chat" i]',
  '[data-testid*="chat" i] input',
  '[data-testid*="chat" i] textarea',
  '[class*="chat" i] input',
  '[class*="chat" i] textarea',
  '[role="textbox"]',
];

const SEND_BUTTON_SELECTORS = [
  'button[type="submit"]',
  'button[aria-label*="send" i]',
  'button[aria-label*="submit" i]',
  '[data-testid*="send" i]',
  '[class*="send" i] button',
  'button:has(svg)',
];

async function findChatInput(page: Page): Promise<string | null> {
  for (const selector of CHAT_SELECTORS) {
    try {
      const element = await page.$(selector);
      if (element && await element.isVisible()) {
        return selector;
      }
    } catch {}
  }
  return null;
}

async function findSendButton(page: Page): Promise<string | null> {
  for (const selector of SEND_BUTTON_SELECTORS) {
    try {
      const element = await page.$(selector);
      if (element && await element.isVisible()) {
        return selector;
      }
    } catch {}
  }
  return null;
}

function approximateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function interactionProbe(url: string): Promise<{
  aiInteraction?: AIInteraction;
  newNetworkCalls: Array<{ url: string; method: string; contentType?: string }>;
  detectedProvider?: string;
  inferredModel?: string;
}> {
  let browser: Browser | null = null;
  const newNetworkCalls: Array<{ url: string; method: string; contentType?: string }> = [];

  try {
    console.log(`[InteractionProbe] Starting for: ${url}`);
    
    browser = await chromium.launch({ 
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);

    const chatInputSelector = await findChatInput(page);
    
    if (!chatInputSelector) {
      console.log("[InteractionProbe] No chat input found");
      await browser.close();
      return { newNetworkCalls };
    }

    console.log(`[InteractionProbe] Found chat input: ${chatInputSelector}`);
    const sendButtonSelector = await findSendButton(page);

    let detectedProvider: string | undefined;
    let firstTokenTime: number | null = null;
    let responseText = "";
    const startTime = Date.now();

    page.on("response", async (response) => {
      const respUrl = response.url();
      const contentType = response.headers()["content-type"] || "";
      
      newNetworkCalls.push({
        url: respUrl,
        method: response.request().method(),
        contentType,
      });

      if (respUrl.includes("api.openai.com") || respUrl.includes("openai.azure.com")) {
        detectedProvider = "OpenAI";
      } else if (respUrl.includes("api.anthropic.com")) {
        detectedProvider = "Anthropic";
      } else if (respUrl.includes("generativelanguage.googleapis.com")) {
        detectedProvider = "Google Gemini";
      } else if (respUrl.includes("/v1/chat/completions") || respUrl.includes("/v1/completions")) {
        detectedProvider = detectedProvider || "OpenAI-compatible";
      }

      if (contentType.includes("text/event-stream") || contentType.includes("application/json")) {
        if (!firstTokenTime) {
          firstTokenTime = Date.now();
        }
        try {
          const body = await response.text();
          responseText += body;
          
          for (const sig of PAYLOAD_SIGNATURES) {
            if (sig.pattern.test(body)) {
              detectedProvider = sig.provider;
              break;
            }
          }
        } catch {}
      }
    });

    try {
      await page.fill(chatInputSelector, "Hi");
      
      if (sendButtonSelector) {
        await page.click(sendButtonSelector);
      } else {
        await page.keyboard.press("Enter");
      }

      await page.waitForTimeout(8000);
    } catch (interactionError) {
      console.log("[InteractionProbe] Interaction failed:", interactionError);
    }

    const endTime = Date.now();
    const ttft = firstTokenTime ? firstTokenTime - startTime : 0;
    const totalTime = endTime - startTime;
    const tokenCount = approximateTokenCount(responseText);
    const generationTime = totalTime - ttft;
    const tps = generationTime > 0 ? (tokenCount / (generationTime / 1000)) : 0;

    let inferredModel: string | undefined;
    if (tokenCount > 0) {
      for (const fp of SPEED_FINGERPRINTS) {
        if (tps >= fp.minTps && tps < fp.maxTps) {
          inferredModel = `${fp.provider} - ${fp.model || "Unknown Model"}`;
          break;
        }
      }
      if (!inferredModel) {
        if (ttft > 3000 && tps > 50) {
          inferredModel = "Reasoning Model (o1 / DeepSeek R1)";
        }
      }
    }

    await browser.close();
    browser = null;

    const aiInteraction: AIInteraction | undefined = tokenCount > 0 ? {
      promptSent: "Hi",
      responseReceived: responseText.substring(0, 500),
      ttft,
      tps: Math.round(tps),
      totalTime,
      tokenCount,
    } : undefined;

    console.log(`[InteractionProbe] Completed - provider=${detectedProvider}, tokens=${tokenCount}, tps=${Math.round(tps)}`);

    return {
      aiInteraction,
      newNetworkCalls,
      detectedProvider,
      inferredModel,
    };
  } catch (error) {
    console.error("[InteractionProbe] Error:", error);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return { newNetworkCalls };
  }
}

export function detectAIFromNetwork(signals: BrowserSignals): {
  provider?: string;
  gateway?: string;
  confidence: string;
} {
  const { domains, paths, responses } = signals.network;

  const aiDomains: Record<string, string> = {
    "api.openai.com": "OpenAI",
    "openai.azure.com": "OpenAI (Azure)",
    "api.anthropic.com": "Anthropic",
    "generativelanguage.googleapis.com": "Google Gemini",
    "api.groq.com": "Groq",
    "api.cohere.ai": "Cohere",
    "api.mistral.ai": "Mistral",
    "api.replicate.com": "Replicate",
    "api.together.ai": "Together AI",
    "api.perplexity.ai": "Perplexity",
    "api.fireworks.ai": "Fireworks AI",
  };

  const gatewayDomains: Record<string, string> = {
    "gateway.ai.cloudflare.com": "Cloudflare AI Gateway",
    "api.portkey.ai": "Portkey",
    "gateway.helicone.ai": "Helicone",
    "api.braintrust.dev": "Braintrust",
  };

  let provider: string | undefined;
  let gateway: string | undefined;
  let confidence = "Low";

  for (const domain of domains) {
    if (aiDomains[domain]) {
      provider = aiDomains[domain];
      confidence = "High";
      break;
    }
    for (const [partial, name] of Object.entries(aiDomains)) {
      if (domain.includes(partial.replace("api.", ""))) {
        provider = name;
        confidence = "Medium";
      }
    }
  }

  for (const domain of domains) {
    if (gatewayDomains[domain]) {
      gateway = gatewayDomains[domain];
      break;
    }
  }

  for (const path of paths) {
    if (path.includes("/v1/chat/completions") || path.includes("/v1/completions")) {
      if (!provider) {
        provider = "OpenAI-compatible";
        confidence = "Medium";
      }
    }
    if (path.includes("/v1/messages")) {
      if (!provider) {
        provider = "Anthropic-compatible";
        confidence = "Medium";
      }
    }
  }

  for (const sig of AI_GATEWAY_SIGNATURES) {
    for (const resp of responses) {
      const headerValue = resp.headers[sig.headerKey.toLowerCase()];
      if (headerValue) {
        gateway = sig.name;
        break;
      }
    }
    if (gateway) break;
  }

  for (const resp of responses) {
    if (resp.headers["x-vercel-ai-provider"]) {
      const aiProvider = resp.headers["x-vercel-ai-provider"];
      if (aiProvider.includes("openai")) provider = "OpenAI";
      else if (aiProvider.includes("anthropic")) provider = "Anthropic";
      else if (aiProvider.includes("google")) provider = "Google Gemini";
      confidence = "High";
    }
    if (resp.headers["anthropic-version"]) {
      provider = "Anthropic";
      confidence = "High";
    }
    if (resp.headers["openai-organization"]) {
      provider = "OpenAI";
      confidence = "High";
    }
  }

  return { provider, gateway, confidence };
}

export function detectFrameworkFromHints(hints: BrowserSignals["windowHints"]): {
  framework?: string;
  confidence: string;
} {
  if (hints.__NEXT_DATA__) return { framework: "Next.js", confidence: "High" };
  if (hints.__NUXT__) return { framework: "Nuxt", confidence: "High" };
  if (hints.Shopify) return { framework: "Shopify", confidence: "High" };
  if (hints.__GATSBY) return { framework: "Gatsby", confidence: "High" };
  if (hints.__remixContext) return { framework: "Remix", confidence: "High" };
  if (hints.__svelte) return { framework: "Svelte", confidence: "High" };
  if (hints.Angular) return { framework: "Angular", confidence: "High" };
  if (hints.Vue) return { framework: "Vue.js", confidence: "High" };
  if (hints.Streamlit) return { framework: "Streamlit", confidence: "High" };
  if (hints.Gradio) return { framework: "Gradio", confidence: "High" };
  return { confidence: "Low" };
}
