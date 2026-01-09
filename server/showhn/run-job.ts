import { fetchShowHNProducts } from "./hn-fetcher";
import { runBatchScan, generateAggregateReport, exportToCsv } from "./batch-scanner";
import * as fs from "fs";

async function main() {
  console.log("=".repeat(60));
  console.log("Show HN Stack Report Generator");
  console.log("=".repeat(60));
  console.log("");
  
  const startTime = Date.now();
  
  console.log("[Step 1/4] Fetching Show HN products from Hacker News...");
  await fetchShowHNProducts(100);
  console.log("");
  
  console.log("[Step 2/4] Running batch scans (this may take 10-20 minutes)...");
  await runBatchScan();
  console.log("");
  
  console.log("[Step 3/4] Generating aggregate report...");
  const reportId = await generateAggregateReport();
  console.log("");
  
  console.log("[Step 4/4] Exporting to CSV...");
  const csv = await exportToCsv();
  const csvPath = "./showhn-report.csv";
  fs.writeFileSync(csvPath, csv);
  console.log(`CSV exported to: ${csvPath}`);
  console.log("");
  
  const duration = Math.round((Date.now() - startTime) / 1000 / 60);
  console.log("=".repeat(60));
  console.log(`Complete! Total time: ${duration} minutes`);
  console.log(`Report ID: ${reportId}`);
  console.log(`View report at: /showhn`);
  console.log("=".repeat(60));
}

main().catch(console.error);
