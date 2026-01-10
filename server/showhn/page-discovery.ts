import { chromium, type Browser, type Page } from "playwright";

export type DiscoveredPage = {
  url: string;
  type: "homepage" | "pricing" | "login" | "docs" | "api";
  priority: number;
};

const HIGH_VALUE_PATHS: Record<string, { patterns: string[]; type: DiscoveredPage["type"]; priority: number }> = {
  pricing: {
    patterns: ["/pricing", "/plans", "/pro", "/premium", "/upgrade", "/buy", "/subscribe"],
    type: "pricing",
    priority: 2,
  },
  login: {
    patterns: ["/login", "/signin", "/sign-in", "/signup", "/sign-up", "/register", "/auth"],
    type: "login",
    priority: 3,
  },
  docs: {
    patterns: ["/docs", "/documentation", "/api", "/api-docs", "/developer", "/developers"],
    type: "docs",
    priority: 4,
  },
};

function normalizeUrl(base: string, path: string): string {
  try {
    if (path.startsWith("http")) return path;
    const baseUrl = new URL(base);
    return new URL(path, baseUrl.origin).href;
  } catch {
    return "";
  }
}

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

export async function discoverPages(url: string): Promise<DiscoveredPage[]> {
  const origin = getOrigin(url);
  const pages: DiscoveredPage[] = [
    { url, type: "homepage", priority: 1 }
  ];
  
  const candidateUrls: string[] = [];
  
  for (const [_, config] of Object.entries(HIGH_VALUE_PATHS)) {
    for (const pattern of config.patterns) {
      candidateUrls.push(`${origin}${pattern}`);
    }
  }
  
  let browser: Browser | null = null;
  
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });
    
    const checkedPaths = new Set<string>();
    const foundPages: DiscoveredPage[] = [];
    
    const checkUrl = async (testUrl: string, type: DiscoveredPage["type"], priority: number): Promise<boolean> => {
      const pathname = new URL(testUrl).pathname;
      if (checkedPaths.has(pathname)) return false;
      checkedPaths.add(pathname);
      
      try {
        const page = await context.newPage();
        const response = await page.goto(testUrl, { 
          timeout: 8000, 
          waitUntil: "domcontentloaded" 
        });
        
        const status = response?.status() || 0;
        const finalUrl = page.url();
        await page.close();
        
        if (status >= 200 && status < 400) {
          const finalPathname = new URL(finalUrl).pathname;
          if (finalPathname !== "/" && finalPathname !== pathname) {
            return false;
          }
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };
    
    for (const [category, config] of Object.entries(HIGH_VALUE_PATHS)) {
      if (foundPages.filter(p => p.type === config.type).length > 0) continue;
      
      for (const pattern of config.patterns.slice(0, 2)) {
        const testUrl = `${origin}${pattern}`;
        const exists = await checkUrl(testUrl, config.type, config.priority);
        
        if (exists) {
          foundPages.push({
            url: testUrl,
            type: config.type,
            priority: config.priority,
          });
          break;
        }
      }
    }
    
    await browser.close();
    browser = null;
    
    const allPages = [...pages, ...foundPages];
    return allPages.slice(0, 4);
    
  } catch (error) {
    console.error("[PageDiscovery] Error:", error);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return pages;
  }
}

export async function discoverPagesFromLinks(page: Page, baseUrl: string): Promise<DiscoveredPage[]> {
  const origin = getOrigin(baseUrl);
  const pages: DiscoveredPage[] = [];
  
  try {
    const links = await page.$$eval("a[href]", (els) => 
      els.map(el => ({
        href: el.getAttribute("href") || "",
        text: el.textContent?.toLowerCase().trim() || "",
      }))
    );
    
    const linkKeywords: Record<string, { keywords: string[]; type: DiscoveredPage["type"]; priority: number }> = {
      pricing: { keywords: ["pricing", "plans", "buy", "upgrade", "pro", "premium"], type: "pricing", priority: 2 },
      login: { keywords: ["login", "sign in", "sign up", "register", "auth"], type: "login", priority: 3 },
      docs: { keywords: ["docs", "documentation", "api", "developers"], type: "docs", priority: 4 },
    };
    
    const foundTypes = new Set<string>();
    
    for (const link of links) {
      if (pages.length >= 3) break;
      
      for (const [category, config] of Object.entries(linkKeywords)) {
        if (foundTypes.has(config.type)) continue;
        
        const matchesKeyword = config.keywords.some(kw => 
          link.text.includes(kw) || link.href.toLowerCase().includes(kw)
        );
        
        if (matchesKeyword && link.href) {
          const fullUrl = normalizeUrl(origin, link.href);
          if (fullUrl && fullUrl.startsWith(origin)) {
            pages.push({
              url: fullUrl,
              type: config.type,
              priority: config.priority,
            });
            foundTypes.add(config.type);
            break;
          }
        }
      }
    }
    
  } catch (error) {
    console.error("[PageDiscovery] Link parsing error:", error);
  }
  
  return pages;
}
