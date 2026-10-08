import {test,expect} from '@playwright/test';
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id){await page.goto('/about/');await page.goto(`/#level=${id}&view=flight`);await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');}
const viewports=[{width:1440,height:900},{width:1146,height:610},{width:320,height:568},{width:844,height:390}];

test('the 1.2 chapter, title and visible sentence share the viewport centre',async({page})=>{
  await ready(page,2);
  for(const viewport of viewports){
    await page.setViewportSize(viewport);
    for(const selector of ['#level-category','#level-title','#level-hint']){
      const element=page.locator(selector);if(!await element.isVisible())continue;
      const offset=await element.evaluate(el=>{const rect=el.getBoundingClientRect();return Math.abs(rect.x+rect.width/2-document.documentElement.clientWidth/2);});
      expect(offset,`${selector} at ${viewport.width}`).toBeLessThan(.1);
    }
  }
  await page.locator('[data-op="A"]').click();await idle(page);
  const offset=await page.locator('#level-title').evaluate(el=>{const rect=el.getBoundingClientRect();return Math.abs(rect.x+rect.width/2-document.documentElement.clientWidth/2);});
  expect(offset).toBeLessThan(.1);
});

test('Hints and discovery findings use the same recipe guidance area across views and sizes',async({page})=>{
  await ready(page,8);await page.locator('[data-op="N"]').click();await idle(page);
  await expect(page.locator('#recipe-guidance #feedback')).toHaveClass(/discovery-feedback/);
  await expect(page.locator('#recipe-guidance #hints-open')).toBeHidden();
  await ready(page,25);await expect(page.locator('#recipe-guidance #hints-open')).toBeVisible();
  await expect(page.locator('.puzzle-heading #ideas-open')).toBeVisible();
  for(const viewport of viewports){
    await page.setViewportSize(viewport);
    for(const view of ['flight','function','flow']){
      await page.locator(`#tab-${view}`).click();
      const bounds=await page.locator('#hints-open').evaluate(button=>{
        const b=button.getBoundingClientRect(),dock=button.closest('.play-dock').getBoundingClientRect(),action=document.querySelector('.dock-actions').getBoundingClientRect();
        return {inside:b.left>=dock.left&&b.right<=dock.right&&b.top>=dock.top&&b.bottom<=dock.bottom,overlap:Math.min(b.right,action.right)>Math.max(b.left,action.left)&&Math.min(b.bottom,action.bottom)>Math.max(b.top,action.top),pageOverflow:document.documentElement.scrollWidth-innerWidth};
      });
      expect(bounds).toEqual({inside:true,overlap:false,pageOverflow:0});
    }
  }
  await page.locator('#hints-open').focus();await page.keyboard.press('Space');await expect(page.locator('#hints-dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#hints-open')).toBeFocused();
});
