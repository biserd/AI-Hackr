import { chromium, type Browser, type Page, type Request, type Response } from "playwright";
import { AI_GATEWAY_SIGNATURES, PAYLOAD_SIGNATURES, SPEED_FINGERPRINTS } from "./signatures";

interface NetworkCapture {
  url: string;
  method: string;
  contentType?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  timing?: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

interface AIInteraction {
  promptSent: string;
  responseReceived: string;
  ttft: number;
  tps: number;
  totalTime: number;
  tokenCount: number;
}

interface ProbeResult {
  networkRequests: NetworkCapture[];
  aiInteraction?: AIInteraction;
  detectedGateway?: { name: string; confidence: string };
  detectedPayloadProvider?: string;
  inferredModel?: string;
  html: string;
  headers: Record<string, string>;
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

function detectGatewayFromHeaders(headers: Record<string, string>): { name: string; confidence: string } | null {
  for (const sig of AI_GATEWAY_SIGNATURES) {
    const headerValue = headers[sig.headerKey.toLowerCase()];
    if (headerValue) {
      return { name: sig.name, confidence: sig.confidence };
    }
  }
  return null;
}

function detectPayloadProvider(body: string): string | null {
  for (const sig of PAYLOAD_SIGNATURES) {
    if (sig.pattern.test(body)) {
      return sig.provider;
    }
  }
  return null;
}

function inferModelFromSpeed(tps: number, ttft: number): string {
  if (ttft > 3000 && tps > 50) {
    return "Reasoning Model (o1 / DeepSeek R1)";
  }
  
  for (const fp of SPEED_FINGERPRINTS) {
    if (tps >= fp.minTps && tps < fp.maxTps) {
      return `${fp.provider} - ${fp.model || "Unknown Model"}`;
    }
  }
  
  return "Unknown";
}

function approximateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function probeScan(url: string): Promise<ProbeResult> {
  let browser: Browser | null = null;
  const networkRequests: NetworkCapture[] = [];
  let html = "";
  let headers: Record<string, string> = {};
  let detectedGateway: { name: string; confidence: string } | null = null;
  let detectedPayloadProvider: string | null = null;
  let aiInteraction: AIInteraction | undefined;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      userAgent: "AIHackr/1.0 Probe Scanner",
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    const requestTimings = new Map<string, number>();

    page.on("request", (request: Request) => {
      const reqUrl = request.url();
      requestTimings.set(reqUrl, Date.now());
      
      const capture: NetworkCapture = {
        url: reqUrl,
        method: request.method(),
        requestHeaders: request.headers(),
      };
      networkRequests.push(capture);
    });

    page.on("response", async (response: Response) => {
      const respUrl = response.url();
      const startTime = requestTimings.get(respUrl);
      const endTime = Date.now();
      
      const respHeaders = response.headers();
      
      const gateway = detectGatewayFromHeaders(respHeaders);
      if (gateway && !detectedGateway) {
        detectedGateway = gateway;
      }

      const existing = networkRequests.find(r => r.url === respUrl);
      if (existing) {
        existing.responseHeaders = respHeaders;
        existing.contentType = respHeaders["content-type"];
        if (startTime) {
          existing.timing = {
            startTime,
            endTime,
            duration: endTime - startTime,
          };
        }

        try {
          const contentType = respHeaders["content-type"] || "";
          if (contentType.includes("application/json") || 
              contentType.includes("text/event-stream") ||
              contentType.includes("text/plain")) {
            const body = await response.text();
            existing.responseBody = body.substring(0, 5000);
            
            const provider = detectPayloadProvider(body);
            if (provider && !detectedPayloadProvider) {
              detectedPayloadProvider = provider;
            }
          }
        } catch {}
      }
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    const pageHeaders = await page.evaluate(() => {
      const meta: Record<string, string> = {};
      document.querySelectorAll("meta").forEach((m) => {
        const name = m.getAttribute("name") || m.getAttribute("property");
        const content = m.getAttribute("content");
        if (name && content) meta[name] = content;
      });
      return meta;
    });
    headers = pageHeaders;

    html = await page.content();

    await page.waitForTimeout(2000);

    const chatInputSelector = await findChatInput(page);
    
    if (chatInputSelector) {
      const sendButtonSelector = await findSendButton(page);
      
      try {
        const testPrompt = "Hi";
        const startTime = Date.now();
        let firstTokenTime: number | null = null;
        let responseText = "";
        
        await page.fill(chatInputSelector, testPrompt);
        
        const networkPromise = new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 15000);
          
          page.on("response", async (response: Response) => {
            const contentType = response.headers()["content-type"] || "";
            if (contentType.includes("text/event-stream") || 
                contentType.includes("application/json")) {
              if (!firstTokenTime) {
                firstTokenTime = Date.now();
              }
              
              try {
                const body = await response.text();
                responseText += body;
              } catch {}
            }
          });
          
          setTimeout(() => {
            clearTimeout(timeout);
            resolve();
          }, 10000);
        });

        if (sendButtonSelector) {
          await page.click(sendButtonSelector);
        } else {
          await page.keyboard.press("Enter");
        }

        await networkPromise;
        
        const endTime = Date.now();
        const ttft = firstTokenTime ? firstTokenTime - startTime : 0;
        const totalTime = endTime - startTime;
        const tokenCount = approximateTokenCount(responseText);
        const generationTime = totalTime - ttft;
        const tps = generationTime > 0 ? (tokenCount / (generationTime / 1000)) : 0;

        aiInteraction = {
          promptSent: testPrompt,
          responseReceived: responseText.substring(0, 500),
          ttft,
          tps: Math.round(tps),
          totalTime,
          tokenCount,
        };
      } catch (interactionError) {
        console.error("Chat interaction failed:", interactionError);
      }
    }

    await browser.close();
    browser = null;

    return {
      networkRequests: networkRequests.slice(0, 50),
      aiInteraction,
      detectedGateway: detectedGateway || undefined,
      detectedPayloadProvider: detectedPayloadProvider || undefined,
      inferredModel: aiInteraction ? inferModelFromSpeed(aiInteraction.tps, aiInteraction.ttft) : undefined,
      html,
      headers,
    };
  } catch (error) {
    console.error("Probe scan error:", error);
    
    if (browser) {
      await browser.close();
    }
    
    return {
      networkRequests,
      html,
      headers,
    };
  }
}

export function mergeProbeResults(passiveResult: any, probeResult: ProbeResult): any {
  const merged = { ...passiveResult };

  if (probeResult.detectedGateway) {
    merged.aiGateway = probeResult.detectedGateway.name;
  }

  if (probeResult.detectedPayloadProvider && !merged.aiProvider) {
    merged.aiProvider = probeResult.detectedPayloadProvider;
    merged.aiConfidence = "High";
  }

  if (probeResult.aiInteraction) {
    merged.ttft = `${probeResult.aiInteraction.ttft}ms`;
    merged.tps = `${probeResult.aiInteraction.tps} tokens/sec`;
    merged.inferredModel = probeResult.inferredModel;
  }

  merged.scanMode = "probe";

  merged.evidence = {
    ...merged.evidence,
    networkRequests: probeResult.networkRequests.map(r => ({
      url: r.url,
      method: r.method,
      contentType: r.contentType,
    })).slice(0, 20),
    payloadSignatures: probeResult.detectedPayloadProvider ? [probeResult.detectedPayloadProvider] : [],
    timingMetrics: probeResult.aiInteraction ? {
      ttft: probeResult.aiInteraction.ttft,
      tps: probeResult.aiInteraction.tps,
      totalTime: probeResult.aiInteraction.totalTime,
    } : undefined,
  };

  return merged;
}
