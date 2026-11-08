import {readFile,writeFile} from 'node:fs/promises';
import {sourceDigest} from './source-digest.mjs';
const report=JSON.parse(await readFile(new URL('../reports/staging.json',import.meta.url),'utf8'));
if(!report.passed||!report.persistenceAcrossWorkerRedeploy)throw new Error('Live Cloudflare verification and retained-result recovery are required.');
if(!process.env.AIHACKR_STAGING_VERSION)throw new Error('Set AIHACKR_STAGING_VERSION to the verified staging deployment version.');
const receipt={...report,stagingOrigin:report.origin,sourceDigest:await sourceDigest(),portalVerified:true,stagingVersion:process.env.AIHACKR_STAGING_VERSION};
await writeFile(new URL('../release-gate.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
console.log('Recorded the passing Cloudflare live release gate for source '+receipt.sourceDigest+'.');
