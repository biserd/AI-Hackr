import {readFile,readdir,writeFile} from 'node:fs/promises';
const source=new URL('../../integrations/aihackr-plugin/',import.meta.url);
const crc=bytes=>{let n=0xffffffff;for(const byte of bytes){n^=byte;for(let i=0;i<8;i++)n=n&1?(n>>>1)^0xedb88320:n>>>1;}return(n^0xffffffff)>>>0;};
// A deterministic uncompressed ZIP, built with Node alone (no install scripts).
export async function packagePlugin(destination){
  const files=[];async function walk(dir,prefix=''){for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(item.isDirectory())await walk(new URL(item.name+'/',dir),prefix+item.name+'/');else files.push({name:prefix+item.name,bytes:await readFile(new URL(item.name,dir))});}}await walk(source);
  const local=[],central=[];let offset=0;
  for(const file of files){const name=Buffer.from(file.name),bytes=file.bytes,checksum=crc(bytes),head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(0x0800,6);head.writeUInt16LE(33,12);head.writeUInt32LE(checksum,14);head.writeUInt32LE(bytes.length,18);head.writeUInt32LE(bytes.length,22);head.writeUInt16LE(name.length,26);local.push(head,name,bytes);
    const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x0800,8);entry.writeUInt16LE(33,14);entry.writeUInt32LE(checksum,16);entry.writeUInt32LE(bytes.length,20);entry.writeUInt32LE(bytes.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);central.push(entry,name);offset+=head.length+name.length+bytes.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);await writeFile(destination,Buffer.concat([...local,directory,end]));return files.map(f=>f.name);
}
