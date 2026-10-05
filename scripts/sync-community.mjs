import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseCommunity, parseProjects } from './community.mjs';

const endpoint='https://api.github.com/repos/ASC-Community/.github/contents/profile/README.md';
let source,markdown;
if(process.argv[2]==='--from'&&process.argv.length===4) {
  const bytes=await readFile(process.argv[3]);
  if(bytes.length>65536)throw Error('The community profile is too large.');
  markdown=bytes.toString('utf8');
  source={html_url:'https://github.com/ASC-Community/.github/blob/main/profile/README.md',sha:createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')};
} else {
  if(process.argv.length>2)throw Error('Usage: npm run sync:community -- [--from path/to/profile/README.md]');
  const response=await fetch(endpoint,{headers:{Accept:'application/vnd.github+json','User-Agent':'Angouri-community-sync'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Organization README refresh failed: HTTP ${response.status}`);
  source=await response.json();
  if(source.encoding!=='base64'||source.size>65536||!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(source.sha))throw Error('Unexpected organization README response.');
  markdown=Buffer.from(source.content,'base64').toString('utf8');
}
const projects=parseProjects(markdown);
parseCommunity(markdown);
const snapshot={schema:1,source:source.html_url,blobSha:source.sha,markdown};
await mkdir(new URL('../content/',import.meta.url),{recursive:true});
await writeFile(new URL('../content/community.json',import.meta.url),JSON.stringify(snapshot,null,2)+'\n');
console.log(`Saved ${projects.length} projects from organization README ${source.sha.slice(0,12)}: ${projects.map(project=>project.name).join(', ')}`);
