import { test, expect } from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.route('https://img.shields.io/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="20"/>'}));
});

for(const javaScriptEnabled of [true,false]) {
  test.describe(`About with JavaScript ${javaScriptEnabled?'enabled':'disabled'}`,()=>{
    test.use({javaScriptEnabled});
    test('links follow native Tab order without the game focus trap',async({page})=>{
      await page.goto('/about/');
      if(javaScriptEnabled)await page.evaluate(()=>{
        window.aboutTabKeys=[];
        window.addEventListener('keydown',event=>{if(event.key==='Tab')window.aboutTabKeys.push(event);});
      });
      const links=page.locator('a[href]');
      const contentsEnd=await links.evaluateAll(links=>links.findIndex(link=>link.getAttribute('href')==='#contributions'));
      expect(contentsEnd).toBeGreaterThan(1);
      await expect(links.first()).toHaveAccessibleName('Angouri home');
      await expect(links.nth(1)).toHaveAccessibleName('Back to the playground →');
      for(let index=0;index<=contentsEnd;index++) {
        await page.keyboard.press('Tab');await expect(links.nth(index)).toBeFocused();
      }
      // About is an ordinary document: unlike the game, its endpoints do not
      // wrap focus. Explicit tabindex also supports WebKit's default setting.
      for(let index=contentsEnd-1;index>=0;index--) {
        await page.keyboard.press('Shift+Tab');await expect(links.nth(index)).toBeFocused();
      }
      await page.keyboard.press('Shift+Tab');
      await expect(links.last()).not.toBeFocused();
      await links.last().focus();await page.keyboard.press('Tab');
      await expect(links.first()).not.toBeFocused();
      // Headless Firefox retains the endpoint even on a plain document. Test
      // native default handling, rather than requiring BODY to become active.
      if(javaScriptEnabled)expect(await page.evaluate(()=>window.aboutTabKeys.length>0&&window.aboutTabKeys.every(event=>!event.defaultPrevented))).toBe(true);
    });
  });
}

test.describe('game without JavaScript',()=>{
  test.use({javaScriptEnabled:false});
  test('the initial fallback and About route fit the viewport',async({page})=>{
    for(const viewport of [{width:390,height:844},{width:667,height:375},{width:320,height:568}]) {
      await page.setViewportSize(viewport);await page.goto('/');
      const fallback=page.locator('.no-script'),link=fallback.getByRole('link');
      await expect(fallback).toBeVisible();await expect(page.locator('.game-shell')).toBeHidden();
      await expect(fallback).toContainText('This game needs JavaScript.');
      const bounds=await fallback.boundingBox(),linkBounds=await link.boundingBox();
      expect(bounds.y).toBe(0);expect(bounds.height).toBeLessThanOrEqual(viewport.height);
      expect(linkBounds.x).toBeGreaterThanOrEqual(0);expect(linkBounds.y).toBeGreaterThanOrEqual(0);
      expect(linkBounds.x+linkBounds.width).toBeLessThanOrEqual(viewport.width);
      expect(linkBounds.y+linkBounds.height).toBeLessThanOrEqual(viewport.height);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.keyboard.press('Tab');await expect(link).toBeFocused();
      await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/about\/$/);
      await expect(page.getByRole('heading',{name:'About Angouri',exact:true})).toBeVisible();
    }
  });
});
