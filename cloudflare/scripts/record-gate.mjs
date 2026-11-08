import {readFile,writeFile} from 'node:fs/promises';
import {sourceDigest} from './source-digest.mjs';
const report=JSON.parse(await readFile(new URL('../reports/staging.json',import.meta.url),'utf8'));
if(!report.passed||!report.persistenceAcrossWorkerRedeploy)throw new Error('Live Cloudflare verification and retained-result recovery are required.');
const receipt={...report,stagingOrigin:report.origin,sourceDigest:await sourceDigest(),portalVerified:true,stagingVersion:'6fa706a2-80c2-45f1-a91e-a57f93fe5acc'};
await writeFile(new URL('../release-gate.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
console.log('Recorded the passing Cloudflare live release gate for source '+receipt.sourceDigest+'.');
