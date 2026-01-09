import { storage } from "./storage";
import { scanUrl } from "./scanner";
import { sendChangeNotificationEmail } from "./email";
import type { Subscription, Scan, InsertScan } from "@shared/schema";

const RESCAN_INTERVAL_HOURS = 24;
const RESCAN_INTERVAL_MS = RESCAN_INTERVAL_HOURS * 60 * 60 * 1000;

interface Changes {
  added: string[];
  removed: string[];
  modified: Array<{ tech: string; from: string; to: string }>;
}

function detectChanges(oldScan: Scan | undefined, newScan: any): Changes {
  const changes: Changes = { added: [], removed: [], modified: [] };
  
  if (!oldScan) return changes;
  
  const stringFields = ['framework', 'hosting', 'payments', 'auth', 'analytics', 'aiProvider'] as const;
  
  for (const field of stringFields) {
    const oldVal = (oldScan as any)[field] as string | null;
    const newVal = newScan[field] as string | null;
    
    if (!oldVal && newVal) {
      changes.added.push(`${field}: ${newVal}`);
    } else if (oldVal && !newVal) {
      changes.removed.push(`${field}: ${oldVal}`);
    } else if (oldVal && newVal && oldVal !== newVal) {
      changes.modified.push({ tech: field, from: oldVal, to: newVal });
    }
  }
  
  return changes;
}

function normalizeDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

async function rescanSubscription(subscription: Subscription): Promise<void> {
  console.log(`[Worker] Re-scanning subscription: ${subscription.domain}`);
  
  try {
    const scanResult = await scanUrl(subscription.url);
    
    const previousScans = await storage.getScansByDomain(subscription.domain);
    const latestPreviousScan = previousScans[0];
    
    const changes = detectChanges(latestPreviousScan, scanResult);
    const hasChanges = changes.added.length > 0 || changes.removed.length > 0 || changes.modified.length > 0;
    
    const normalizedScan: InsertScan = {
      url: scanResult.url,
      domain: normalizeDomain(scanResult.url),
      userId: subscription.userId,
      framework: scanResult.framework || null,
      frameworkConfidence: scanResult.frameworkConfidence || null,
      hosting: scanResult.hosting || null,
      hostingConfidence: scanResult.hostingConfidence || null,
      payments: scanResult.payments || null,
      paymentsConfidence: scanResult.paymentsConfidence || null,
      auth: scanResult.auth || null,
      authConfidence: scanResult.authConfidence || null,
      analytics: scanResult.analytics || null,
      analyticsConfidence: scanResult.analyticsConfidence || null,
      support: scanResult.support || null,
      supportConfidence: scanResult.supportConfidence || null,
      aiProvider: scanResult.aiProvider || null,
      aiConfidence: scanResult.aiConfidence || null,
      aiTransport: scanResult.aiTransport || null,
      aiGateway: scanResult.aiGateway || null,
      scanPhases: {
        passive: "complete" as const,
        render: "skipped" as const,
        probe: "locked" as const,
      },
      scanMode: "passive",
      evidence: scanResult.evidence || null,
    };
    
    const savedScan = await storage.createScan(normalizedScan);
    
    if (hasChanges) {
      console.log(`[Worker] Changes detected for ${subscription.domain}:`, changes);
      
      const changeSummary = [
        ...changes.added.map(a => `Added: ${a}`),
        ...changes.removed.map(r => `Removed: ${r}`),
        ...changes.modified.map(m => `Changed ${m.tech}: ${m.from} → ${m.to}`),
      ].join('; ');
      
      await storage.createChangeEvent({
        subscriptionId: subscription.id,
        oldScanId: latestPreviousScan?.id || null,
        newScanId: savedScan.id,
        changeType: 'stack_change',
        changeSummary,
        changes,
        notificationSent: false,
        notificationSentAt: null,
      });
      
      if (subscription.notifyOnChange) {
        const user = await storage.getUser(subscription.userId);
        if (user?.email) {
          console.log(`[Worker] Sending notification email to ${user.email}`);
          const scanPageUrl = `${process.env.APP_URL || 'https://aihackr.dev'}/scan/${subscription.domain}`;
          await sendChangeNotificationEmail(user.email, subscription.domain, changes, scanPageUrl);
        }
      }
    }
    
    await storage.updateSubscription(subscription.id, { 
      lastScannedAt: new Date(),
      lastScanId: savedScan.id,
    });
    
    console.log(`[Worker] Completed re-scan for ${subscription.domain}`);
  } catch (error) {
    console.error(`[Worker] Error re-scanning ${subscription.domain}:`, error);
  }
}

async function runWorkerCycle(): Promise<void> {
  console.log('[Worker] Starting subscription re-scan cycle...');
  
  try {
    const allSubscriptions = await storage.getAllSubscriptions();
    
    const now = new Date();
    const cutoff = new Date(now.getTime() - RESCAN_INTERVAL_MS);
    
    const dueSubscriptions = allSubscriptions.filter((sub: Subscription) => {
      if (!sub.isActive) return false;
      if (!sub.lastScannedAt) return true;
      return new Date(sub.lastScannedAt) < cutoff;
    });
    
    console.log(`[Worker] Found ${dueSubscriptions.length} subscriptions due for re-scan`);
    
    for (const sub of dueSubscriptions) {
      await rescanSubscription(sub);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('[Worker] Completed subscription re-scan cycle');
  } catch (error) {
    console.error('[Worker] Error in worker cycle:', error);
  }
}

export function startBackgroundWorker(): void {
  console.log('[Worker] Background worker starting...');
  
  setTimeout(async () => {
    await runWorkerCycle();
    
    setInterval(runWorkerCycle, 60 * 60 * 1000);
  }, 60 * 1000);
  
  console.log('[Worker] Background worker scheduled');
}
