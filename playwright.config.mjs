import { defineConfig } from '@playwright/test';
const port=Number(process.env.ANGOURI_TEST_PORT||4174);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('ANGOURI_TEST_PORT must be an integer from 1 to 65535.');
const baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({
  testDir:'tests/browser',timeout:60000,expect:{timeout:20000},workers:1,
  reporter:'list',use:{baseURL,headless:true,reducedMotion:'reduce',trace:'retain-on-failure'},
  projects:[
    {name:'chromium',use:{browserName:'chromium'}},
    {name:'firefox',use:{browserName:'firefox'}},
    {name:'webkit',use:{browserName:'webkit'}}
  ],
  webServer:{command:`node scripts/serve.mjs dist ${port}`,url:baseURL,reuseExistingServer:false}
});
