import { chromium } from '@playwright/test';

// Let the installed Playwright package select its matching browser revision on
// every platform. PLAYWRIGHT_BROWSERS_PATH still works through Playwright itself.
export const launchChromium=(options={})=>chromium.launch({headless:true,...options});
export const previewURL=(fallback='http://127.0.0.1:4174')=>process.env.ANGOURI_BASE_URL||fallback;
