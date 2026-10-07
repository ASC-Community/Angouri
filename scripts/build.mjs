import { cp, readdir, stat, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { build } from 'vite';
const root = resolve(import.meta.dirname,'..');
const published = join(root,'bridge/bin/Release/net10.0/publish/wwwroot/_framework');
const publicFramework = join(root,'web/public/_framework');
await stat(published);
// Both paths are fixed children of this repository. Only generated runtime assets are replaced.
if(!publicFramework.startsWith(root+'\\')&&!publicFramework.startsWith(root+'/'))throw Error('Invalid output path');
await rm(publicFramework,{recursive:true,force:true});
// Incremental .NET publishes retain old fingerprinted assemblies. Only ship the
// versions referenced by the current boot manifest embedded in dotnet.js.
const boot=await readFile(join(published,'dotnet.js'),'utf8');
await cp(published,publicFramework,{recursive:true,filter:source=>{
  const name=basename(source).replace(/\.(map|br|gz)$/,'');
  return !/\.[a-z0-9]{8,}\.(wasm|js)$/i.test(name)||boot.includes(name);
}});
// Derive the dotted cucumber “i” from the same artwork used in the wordmark and game.
const cucumber=await readFile(join(root,'web/public/cucumber.svg'),'utf8');
const artwork=cucumber.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<path data-cucumber-part="stem"[^>]*\/>/,'').replace(/[ \t]+$/gm,'').trim();
await writeFile(join(root,'web/public/favicon.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32.86" cy="10" r="4" fill="#2a4334"/><g transform="translate(3 9) scale(.85)">${artwork}</g></svg>\n`);
await build({configFile:join(root,'web/vite.config.ts')});
console.log('Static bundle ready in dist/. Preview with npm run preview.');
if(process.argv.includes('--stage')) {
  // Optional local preview of the same dist artifact used by GitHub Actions.
  for(const name of ['assets','_framework','about']) {
    const target=join(root,name);
    if(!target.startsWith(root+'\\')&&!target.startsWith(root+'/'))throw Error('Invalid publish target');
    await rm(target,{recursive:true,force:true});
  }
  for(const name of await readdir(join(root,'dist')))await cp(join(root,'dist',name),join(root,name),{recursive:true});
  console.log('Staged the static bundle at the repository root for local preview.');
}
