import { db } from "../storage";
import { showHnProducts, scans, showHnReports, type Scan, type ShowHnProduct } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { scanUrl } from "../scanner";
import { browserScan, detectAIFromNetwork, detectFrameworkFromHints } from "../probeScanner";
import { insertScanSchema } from "@shared/schema";

const CONCURRENCY_LIMIT = 5;
const SCAN_DELAY_MS = 2000;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scanProduct(product: typeof showHnProducts.$inferSelect): Promise<string | null> {
  console.log(`[Batch Scanner] Scanning ${product.domain}...`);
  
  try {
    await db.update(showHnProducts)
      .set({ scanStatus: "scanning" })
      .where(eq(showHnProducts.id, product.id));
    
    let scanResult = await scanUrl(product.productUrl);
    
    (scanResult as any).scanPhases = {
      passive: "complete",
      render: "pending",
      probe: "locked",
    };
    (scanResult as any).scanMode = "passive";
    
    try {
      console.log(`[Batch Scanner] Running render scan for ${product.domain}...`);
      const browserSignals = await browserScan(product.productUrl, {
        timeoutMs: 20000,
        blockResources: true,
      });
      
      const aiFromNetwork = detectAIFromNetwork(browserSignals);
      const frameworkFromHints = detectFrameworkFromHints(browserSignals.windowHints);
      
      if (aiFromNetwork.provider && (!scanResult.aiProvider || aiFromNetwork.confidence === "High")) {
        scanResult.aiProvider = aiFromNetwork.provider;
        (scanResult as any).aiConfidence = aiFromNetwork.confidence;
      }
      if (aiFromNetwork.gateway) {
        (scanResult as any).aiGateway = aiFromNetwork.gateway;
      }
      if (frameworkFromHints.framework && !scanResult.framework) {
        scanResult.framework = frameworkFromHints.framework;
        (scanResult as any).frameworkConfidence = frameworkFromHints.confidence;
      }
      
      (scanResult as any).scanPhases = {
        passive: "complete",
        render: "complete",
        probe: "locked",
      };
      (scanResult as any).scanMode = "render";
      
      const existingEvidence = (scanResult as any).evidence || {};
      (scanResult as any).evidence = {
        ...existingEvidence,
        networkDomains: browserSignals.network.domains.slice(0, 50),
        networkPaths: browserSignals.network.paths.slice(0, 30),
        websockets: browserSignals.network.websockets,
      };
      
    } catch (renderError) {
      console.error(`[Batch Scanner] Render scan failed for ${product.domain}:`, renderError);
      (scanResult as any).scanPhases = {
        passive: "complete",
        render: "failed",
        probe: "locked",
      };
    }
    
    const validatedScan = insertScanSchema.parse(scanResult);
    const [savedScan] = await db.insert(scans).values(validatedScan).returning();
    
    await db.update(showHnProducts)
      .set({ 
        scanId: savedScan.id,
        scanStatus: "complete",
      })
      .where(eq(showHnProducts.id, product.id));
    
    console.log(`[Batch Scanner] Completed scan for ${product.domain}: ${savedScan.framework || "No framework"}, ${savedScan.aiProvider || "No AI"}`);
    
    return savedScan.id;
  } catch (error) {
    console.error(`[Batch Scanner] Failed to scan ${product.domain}:`, error);
    
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
  
  console.log(`[Batch Scanner] Found ${pendingProducts.length} products to scan`);
  
  const queue = [...pendingProducts];
  let activeScans = 0;
  let completedScans = 0;
  
  const scanNext = async (): Promise<void> => {
    while (queue.length > 0 && activeScans < CONCURRENCY_LIMIT) {
      const product = queue.shift();
      if (!product) break;
      
      activeScans++;
      
      scanProduct(product)
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
  
  const scanResults = await db.select()
    .from(scans)
    .where(sql`${scans.id} = ANY(${scanIds})`);
  
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
    .leftJoin(scans, eq(showHnProducts.scanId, scans.id))
    .orderBy(desc(sql`CAST(${showHnProducts.score} AS INTEGER)`));
  
  const headers = [
    "HN ID",
    "Title",
    "Author",
    "Score",
    "Comments",
    "Domain",
    "Product URL",
    "HN Link",
    "Framework",
    "Hosting",
    "Payments",
    "Auth",
    "Analytics",
    "AI Provider",
    "Report Link",
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
    scan ? `/scan/${product.domain}` : "",
  ]);
  
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  
  return csv;
}
