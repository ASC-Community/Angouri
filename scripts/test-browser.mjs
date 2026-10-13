import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const args=process.argv.slice(2);
if(!args.some(arg=>['--list','--help','-h'].includes(arg))) {
  for(const file of ['index.html','engine-worker.js','_framework/dotnet.js']) {
    try {await stat(new URL(`../dist/${file}`,import.meta.url));}
    catch {throw Error(`Missing dist/${file}. Run npm run build before npm run test:browser:prebuilt.`);}
  }
}

// Independent checkouts use independent servers. A race for the released port
// fails in Playwright (reuseExistingServer is false), never tests another site.
const port=process.env.ANGOURI_TEST_PORT||await new Promise((resolve,reject)=>{
  const probe=createServer();
  probe.once('error',reject);
  probe.listen(0,'127.0.0.1',()=>{
    const port=probe.address().port;
    probe.close(error=>error?reject(error):resolve(String(port)));
  });
});
console.log(`Browser tests: http://127.0.0.1:${port} (isolated prebuilt dist/)`);
const child=spawn(process.execPath,[createRequire(import.meta.url).resolve('@playwright/test/cli'),'test',...args],{
  cwd:root,stdio:'inherit',env:{...process.env,ANGOURI_TEST_PORT:port}
});
const handlers=new Map(['SIGINT','SIGTERM'].map(signal=>[signal,()=>child.kill(signal)]));
for(const [signal,handler] of handlers)process.on(signal,handler);
try {
  process.exitCode=await new Promise((resolve,reject)=>{
    child.once('error',reject);
    child.once('exit',code=>resolve(code??1));
  });
} finally {
  for(const [signal,handler] of handlers)process.off(signal,handler);
}
