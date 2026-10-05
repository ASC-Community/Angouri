import { defineConfig } from '@playwright/test';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
let executablePath;
if(process.platform==='win32') {
  const cache=join(process.env.LOCALAPPDATA,'ms-playwright');
  if(existsSync(cache)) {const builds=readdirSync(cache).filter(s=>/^chromium-\d+$/.test(s)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));if(builds[0])executablePath=join(cache,builds[0],'chrome-win64/chrome.exe');}
}
export default defineConfig({
  testDir:'tests/browser',timeout:60000,expect:{timeout:20000},workers:1,
  reporter:'list',use:{baseURL:'http://127.0.0.1:4174',headless:true,reducedMotion:'reduce',trace:'retain-on-failure'},
  projects:[
    {name:'chromium',use:{browserName:'chromium',launchOptions:executablePath?{executablePath}:undefined}},
    {name:'firefox',use:{browserName:'firefox'}},
    {name:'webkit',use:{browserName:'webkit'}}
  ],
  webServer:{command:'node scripts/serve.mjs dist 4174',url:'http://127.0.0.1:4174',reuseExistingServer:true}
});
