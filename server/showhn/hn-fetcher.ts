import { db } from "../storage";
import { showHnProducts } from "@shared/schema";
import { desc } from "drizzle-orm";

const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface HNItem {
  id: number;
  title?: string;
  by?: string;
  time?: number;
  score?: number;
  descendants?: number;
  url?: string;
  text?: string;
  type?: string;
}

function isShowHN(title: string): boolean {
  return title.toLowerCase().startsWith("show hn:") || title.toLowerCase().includes("show hn");
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.href;
  } catch {
    return url;
  }
}

function extractUrlFromText(text: string): string | null {
  if (!text) return null;
  const urlMatch = text.match(/https?:\/\/[^\s<>"]+/i);
  if (urlMatch) {
    const url = urlMatch[0];
    if (!url.includes("news.ycombinator.com") && !url.includes("github.com")) {
      return normalizeUrl(url);
    }
  }
  return null;
}

async function fetchItem(id: number): Promise<HNItem | null> {
  try {
    const response = await fetch(`${HN_API_BASE}/item/${id}.json`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch item ${id}:`, error);
    return null;
  }
}

async function fetchTopStories(): Promise<number[]> {
  const response = await fetch(`${HN_API_BASE}/topstories.json`);
  return await response.json();
}

async function fetchNewStories(): Promise<number[]> {
  const response = await fetch(`${HN_API_BASE}/newstories.json`);
  return await response.json();
}

async function fetchBestStories(): Promise<number[]> {
  const response = await fetch(`${HN_API_BASE}/beststories.json`);
  return await response.json();
}

export async function fetchShowHNProducts(targetCount: number = 100): Promise<void> {
  console.log(`[HN Fetcher] Starting to fetch ${targetCount} Show HN products...`);
  
  const cutoffTime = Date.now() - THIRTY_DAYS_MS;
  const cutoffTimestamp = Math.floor(cutoffTime / 1000);
  
  const [topIds, newIds, bestIds] = await Promise.all([
    fetchTopStories(),
    fetchNewStories(),
    fetchBestStories(),
  ]);
  
  const allIds = Array.from(new Set([...topIds, ...newIds, ...bestIds]));
  console.log(`[HN Fetcher] Found ${allIds.length} unique story IDs to check`);
  
  const showHNItems: Array<{
    item: HNItem;
    productUrl: string;
    domain: string;
  }> = [];
  
  const seenDomains = new Set<string>();
  const batchSize = 50;
  
  for (let i = 0; i < allIds.length && showHNItems.length < targetCount * 2; i += batchSize) {
    const batchIds = allIds.slice(i, i + batchSize);
    const items = await Promise.all(batchIds.map(id => fetchItem(id)));
    
    for (const item of items) {
      if (!item || !item.title || item.type !== "story") continue;
      if (!isShowHN(item.title)) continue;
      if (!item.time || item.time < cutoffTimestamp) continue;
      
      let productUrl = item.url;
      
      if (!productUrl || productUrl.includes("news.ycombinator.com")) {
        const extractedUrl = extractUrlFromText(item.text || "");
        if (extractedUrl) {
          productUrl = extractedUrl;
        } else {
          continue;
        }
      }
      
      productUrl = normalizeUrl(productUrl);
      const domain = extractDomain(productUrl);
      
      if (!domain || domain.includes("github.com") || domain.includes("gitlab.com")) {
        continue;
      }
      
      if (seenDomains.has(domain)) {
        const existing = showHNItems.find(p => p.domain === domain);
        if (existing && (item.score || 0) > (existing.item.score || 0)) {
          const idx = showHNItems.indexOf(existing);
          showHNItems[idx] = { item, productUrl, domain };
        }
        continue;
      }
      
      seenDomains.add(domain);
      showHNItems.push({ item, productUrl, domain });
    }
    
    console.log(`[HN Fetcher] Processed ${Math.min(i + batchSize, allIds.length)} items, found ${showHNItems.length} Show HN products`);
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  showHNItems.sort((a, b) => (b.item.score || 0) - (a.item.score || 0));
  const topProducts = showHNItems.slice(0, targetCount);
  
  console.log(`[HN Fetcher] Selected top ${topProducts.length} products by score`);
  
  for (const product of topProducts) {
    const { item, productUrl, domain } = product;
    
    try {
      await db.insert(showHnProducts).values({
        hnId: String(item.id),
        title: item.title || "Untitled",
        author: item.by || "unknown",
        createdAt: new Date((item.time || 0) * 1000),
        score: String(item.score || 0),
        commentsCount: String(item.descendants || 0),
        hnLink: `https://news.ycombinator.com/item?id=${item.id}`,
        productUrl,
        domain,
        scanStatus: "pending",
      }).onConflictDoNothing();
    } catch (error) {
      console.error(`[HN Fetcher] Failed to insert product ${domain}:`, error);
    }
  }
  
  console.log(`[HN Fetcher] Finished inserting ${topProducts.length} products into database`);
}

export async function getShowHNProducts() {
  return await db.select().from(showHnProducts).orderBy(showHnProducts.score);
}
