import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,relative} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function sourceDigest(){
  const files=[];
  async function walk(directory){for(const item of await readdir(directory,{withFileTypes:true})){if(['node_modules','.build','reports'].includes(item.name))continue;const path=join(directory,item.name);if(item.isDirectory())await walk(path);else if(item.name!=='release-gate.json'&&/\.(mjs|ts|json|html|css)$/.test(item.name))files.push(path);}}
  await walk(join(root,'cloudflare'));await walk(join(root,'web'));files.push(join(root,'wrangler.jsonc'),join(root,'package.json'));
  const hash=createHash('sha256');
  for(const path of files.sort()){hash.update(relative(root,path).replaceAll('\\','/'));hash.update('\0');hash.update((await readFile(path,'utf8')).replaceAll('\r\n','\n'));hash.update('\0');}
  return hash.digest('hex');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(await sourceDigest());
