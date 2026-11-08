import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../reports/staging.json',import.meta.url);const report=JSON.parse(await readFile(file,'utf8'));
if(!report.passed||!report.retainedCrawlId)throw new Error('A successful live staging run must precede redeployment and retained-result verification.');
const key=process.env.AIHACKR_API_KEY??JSON.parse(await readFile(new URL('../../.local/cloudflare-workspace.json',import.meta.url),'utf8')).staging;
const response=await fetch(report.origin+'/v2/crawl/'+report.retainedCrawlId,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
assert.equal(response.status,200);const result=await response.json();assert.equal(result.status,'completed');assert.equal(result.data.length,2);
report.persistenceAcrossWorkerRedeploy=true;report.redeployVerifiedAt=new Date().toISOString();await writeFile(file,JSON.stringify(report,null,2));
console.log('PASS completed crawl results survived Worker redeployment.');
